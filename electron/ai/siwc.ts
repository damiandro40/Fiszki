import { safeStorage, shell, app } from 'electron'
import { randomUUID, randomBytes, createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { AiModel, AiSession, AiRequest, AiAuthPhase } from '../../src/types/model'
import { AUTH_ORIGIN, AUTH_URL, RESOURCE, SCOPES, base64url, requestJson, tokenRequest, listenForCode, verifyIdToken, grantedPlanUsage } from './oauth'
export { verifyIdToken, grantedPlanUsage } from './oauth'

const MAX_OUTPUT = 650_000

interface Credentials {
  clientId: string
  subject: string
  email: string
  name: string
  accessToken: string
  refreshToken: string
  idToken: string
  scope: string
  expiresAt: number
}
interface PersistedAccount {
  version: 1
  registrationId: string | null
  credentials: Credentials | null
}

const emptyAccount = (): PersistedAccount => ({ version: 1, registrationId: null, credentials: null })
const hostFile = () => join(app.getPath('userData'), 'chatgpt-host.json')
const accountFile = () => join(app.getPath('userData'), 'chatgpt-credentials.bin')
const asError = (error: unknown) => error instanceof Error ? error : new Error(String(error))

export class ChatGPTConnection {
  private state: PersistedAccount | null = null
  private refreshPromise: Promise<void> | null = null
  private signingIn = false
  private running: AbortController | null = null

  private async read() {
    if (this.state) return this.state
    try {
      const buffer = await fs.readFile(accountFile())
      if (!safeStorage.isEncryptionAvailable() || (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')) throw new Error('System nie udostępnia bezpiecznego magazynu poświadczeń.')
      const decoded = JSON.parse(safeStorage.decryptString(buffer)) as PersistedAccount
      if (decoded.version !== 1) throw new Error('Nieobsługiwany format poświadczeń.')
      this.state = decoded
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      this.state = emptyAccount()
    }
    return this.state!
  }

  private async persist(state: PersistedAccount) {
    if (!safeStorage.isEncryptionAvailable() || (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')) throw new Error('Bezpieczne szyfrowanie danych nie jest dostępne w systemie.')
    const destination = accountFile()
    await fs.mkdir(app.getPath('userData'), { recursive: true })
    const temp = `${destination}.${randomUUID()}.tmp`
    try {
      await fs.writeFile(temp, safeStorage.encryptString(JSON.stringify(state)), { mode: 0o600 })
      await fs.rename(temp, destination)
    } finally { await fs.rm(temp, { force: true }).catch(() => {}) }
    this.state = state
  }

  private async hostId() {
    try {
      const parsed = JSON.parse(await fs.readFile(hostFile(), 'utf8'))
      if (typeof parsed.id === 'string' && /^urn:uuid:[0-9a-f-]{36}$/i.test(parsed.id)) return parsed.id as string
    } catch { /* Not registered */ }
    const id = `urn:uuid:${randomUUID()}`
    await fs.mkdir(app.getPath('userData'), { recursive: true })
    await fs.writeFile(hostFile(), JSON.stringify({ id }), { flag: 'wx', mode: 0o600 }).catch(async (error: NodeJS.ErrnoException) => {
      if (error.code !== 'EEXIST') throw error
    })
    const saved = JSON.parse(await fs.readFile(hostFile(), 'utf8')) as { id: string }
    return saved.id
  }

  async status(): Promise<AiSession> {
    const credentials = (await this.read()).credentials
    return { connected: !!credentials, sharing: !!credentials && grantedPlanUsage(credentials.scope), email: credentials?.email || null, name: credentials?.name || null }
  }

  async signIn(onProgress: (phase: AiAuthPhase) => void = () => {}): Promise<AiSession> {
    if (!safeStorage.isEncryptionAvailable() || (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')) {
      throw new Error('System nie udostępnia bezpiecznego magazynu poświadczeń. Logowanie zostało zablokowane.')
    }
    if (this.signingIn) throw new Error('Logowanie jest już w toku.')
    this.signingIn = true
    let listener: Awaited<ReturnType<typeof listenForCode>> | null = null
    let timeout: NodeJS.Timeout | null = null
    try {
      const saved = await this.read()
      const state = base64url(randomBytes(32))
      const nonce = base64url(randomBytes(32))
      const verifier = base64url(randomBytes(64))
      listener = await listenForCode(state)
      onProgress('browser')
      const clientId = saved.credentials?.clientId || saved.registrationId || 'dynamic_agent_client'
      const url = new URL(AUTH_URL)
      const params: Record<string, string> = {
        client_id: clientId, response_type: 'code', redirect_uri: listener.redirectUri, scope: SCOPES,
        resource: RESOURCE, state, nonce, code_challenge_method: 'S256',
        code_challenge: base64url(createHash('sha256').update(verifier).digest()), ext_agent_host_id: await this.hostId()
      }
      if (clientId === 'dynamic_agent_client') params.agent_name_hint = 'Fiszki'
      else if (saved.credentials) {
        params.id_token_hint = saved.credentials.idToken
        if (saved.credentials.email) params.login_hint = saved.credentials.email
      }
      Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))
      const opened = await shell.openExternal(url.toString())
      void opened
      const callback = await Promise.race([
        listener.result,
        new Promise<CallbackResult>((_resolve, reject) => { timeout = setTimeout(() => reject(new Error('Logowanie wygasło. Spróbuj ponownie.')), 180_000) })
      ])
      onProgress('callback')
      const issuedId = clientId === 'dynamic_agent_client' ? callback.clientId : clientId
      if (!issuedId || issuedId === 'dynamic_agent_client' || (clientId !== 'dynamic_agent_client' && callback.clientId && callback.clientId !== clientId)) {
        throw new Error('Serwer zwrócił nieprawidłowy identyfikator aplikacji.')
      }
      // Retain registration even if the one-time authorization code expires.
      await this.persist({ ...saved, registrationId: issuedId })
      onProgress('tokens')
      const tokens = await tokenRequest(new URLSearchParams({
        grant_type: 'authorization_code', client_id: issuedId, code: callback.code,
        code_verifier: verifier, redirect_uri: listener.redirectUri, resource: RESOURCE
      }))
      if (typeof tokens.id_token !== 'string' || typeof tokens.access_token !== 'string' || typeof tokens.refresh_token !== 'string') throw new Error('Niekompletna odpowiedź logowania OpenAI.')
      const identity = await verifyIdToken(tokens.id_token, issuedId, nonce)
      onProgress('verified')
      if (saved.credentials && saved.credentials.subject !== identity.subject) throw new Error('Wybrano inne konto ChatGPT niż powiązane z tą instalacją. Rozłącz je przed zmianą.')
      const credentials: Credentials = {
        clientId: issuedId, subject: identity.subject, email: identity.email, name: identity.name,
        accessToken: tokens.access_token, refreshToken: tokens.refresh_token, idToken: tokens.id_token,
        scope: typeof tokens.scope === 'string' ? tokens.scope : '',
        expiresAt: Date.now() + Math.max(60, Number(tokens.expires_in) || 3600) * 1000
      }
      await this.persist({ version: 1, credentials, registrationId: issuedId })
      return this.status()
    } finally {
      this.signingIn = false
      if (timeout) clearTimeout(timeout)
      if (listener) await listener.close()
    }
  }

  async disconnect(): Promise<void> {
    this.running?.abort()
    const saved = await this.read()
    const credentials = saved.credentials
    if (credentials) {
      try {
        const discovery = await requestJson(`${AUTH_ORIGIN}/.well-known/openid-configuration`, { method: 'GET' })
        const endpoint = String(discovery.revocation_endpoint || '')
        if (endpoint.startsWith(`${AUTH_ORIGIN}/`)) {
          await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ token: credentials.refreshToken, token_type_hint: 'refresh_token', client_id: credentials.clientId }), signal: AbortSignal.timeout(8000) })
        }
      } catch { /* Local disconnect still succeeds; remote revocation not guaranteed */ }
    }
    // Signing out intentionally forgets the issued registration, so a different account can be connected later.
    await this.persist({ version: 1, credentials: null, registrationId: null })
  }

  private async refresh() {
    if (this.refreshPromise) return this.refreshPromise
    this.refreshPromise = (async () => {
      const saved = await this.read()
      const old = saved.credentials
      if (!old) throw new Error('Połącz konto ChatGPT, aby kontynuować.')
      const tokens = await tokenRequest(new URLSearchParams({
        grant_type: 'refresh_token', client_id: old.clientId, refresh_token: old.refreshToken, resource: RESOURCE
      }))
      if (typeof tokens.access_token !== 'string' || typeof tokens.refresh_token !== 'string') throw new Error('Odświeżenie sesji nie powiodło się. Zaloguj się ponownie.')
      const newIdentity = typeof tokens.id_token === 'string' ? await verifyIdToken(tokens.id_token, old.clientId) : null
      if (newIdentity && newIdentity.subject !== old.subject) throw new Error('Niezgodna tożsamość odświeżonego konta.')
      const next = { ...old, accessToken: tokens.access_token, refreshToken: tokens.refresh_token,
        idToken: typeof tokens.id_token === 'string' ? tokens.id_token : old.idToken,
        scope: typeof tokens.scope === 'string' ? tokens.scope : old.scope,
        expiresAt: Date.now() + Math.max(60, Number(tokens.expires_in) || 3600) * 1000 }
      await this.persist({ ...saved, credentials: next })
    })().finally(() => { this.refreshPromise = null })
    return this.refreshPromise
  }

  private async accessToken() {
    const current = (await this.read()).credentials
    if (!current || !grantedPlanUsage(current.scope)) throw new Error('Konto ChatGPT nie udzieliło dostępu do korzystania z planu. Połącz je ponownie i zaakceptuj uprawnienia.')
    if (current.expiresAt < Date.now() + 120_000) await this.refresh()
    return (await this.read()).credentials!.accessToken
  }

  async models(): Promise<AiModel[]> {
    const token = await this.accessToken()
    const response = await requestJson(`${RESOURCE}/models`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } })
    if (!Array.isArray(response.models)) return []
    return response.models.filter((model: any) => model.visibility === 'list' && typeof model.slug === 'string')
      .map((model: any) => ({ id: String(model.slug), name: String(model.display_name || model.slug) }))
  }

  cancel() { this.running?.abort() }

  async send(request: AiRequest, onDelta: (delta: string) => void): Promise<string> {
    if (this.running) throw new Error('Poprzednia odpowiedź jeszcze trwa.')
    const controller = new AbortController()
    this.running = controller
    const timer = setTimeout(() => controller.abort(), 120_000)
    try {
      const token = await this.accessToken()
      const response = await fetch(`${RESOURCE}/responses`, { method: 'POST', signal: controller.signal,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: request.model, input: request.messages.map(message => {
          const attachments = message.attachments || []
          return {
            role: message.role,
            content: message.role === 'assistant' || !attachments.length
              ? message.content
              : [
                  { type: 'input_text', text: [message.content, ...attachments.filter(item => item.text).map(item => `[Załącznik: ${item.name}]\n${item.text}`)].filter(Boolean).join('\n\n') || 'Przeanalizuj załączone materiały.' },
                  ...attachments.filter(item => item.dataUrl).map(item => ({ type: 'input_image', image_url: item.dataUrl!, detail: 'auto' })),
                  ...attachments.filter(item => item.fileData).map(item => ({ type: 'input_file', filename: item.name, file_data: item.fileData!, detail: 'low' }))
                ]
          }
        }), instructions: request.instructions,
          store: false, stream: true }) })
      if (!response.ok || !response.body) {
        const raw = (await response.text()).slice(0, 1000)
        throw new Error(`OpenAI HTTP ${response.status}: ${raw}`)
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let pending = ''
      let text = ''
      let completed = false
      const processEvent = (record: string) => {
        const data = record.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
        if (!data || data === '[DONE]') return
        let payload: Record<string, any>
        try { payload = JSON.parse(data) } catch { return }
        if (payload.type === 'response.output_text.delta' && typeof payload.delta === 'string') {
          if (text.length + payload.delta.length > MAX_OUTPUT) throw new Error('Odpowiedź AI jest zbyt długa.')
          text += payload.delta
          onDelta(payload.delta)
        }
        if (payload.type === 'response.failed' || payload.type === 'response.incomplete' || payload.type === 'error') {
          const reason = payload.response?.error || payload.error
          const providerCode = typeof reason?.code === 'string' ? `${reason.code}: ` : ''
          throw new Error(`${providerCode}${String(reason?.message || 'Model nie ukończył odpowiedzi.')}`)
        }
        if (payload.type === 'response.completed') {
          completed = true
        }
      }
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          pending += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
          const records = pending.split('\n\n')
          pending = records.pop() || ''
          records.forEach(processEvent)
        }
        if (pending.trim()) processEvent(pending)
      } finally { reader.releaseLock() }
      if (!completed) throw new Error('Połączenie przerwano przed ukończeniem odpowiedzi.')
      return text
    } catch (error) {
      if (controller.signal.aborted) throw new Error('Odpowiedź anulowana lub przekroczono limit czasu.')
      throw asError(error)
    } finally {
      clearTimeout(timer)
      this.running = null
    }
  }
}
