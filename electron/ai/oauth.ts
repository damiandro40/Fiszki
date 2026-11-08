import { createPublicKey, verify as verifySignature, timingSafeEqual } from 'node:crypto'
import { createServer, type Server } from 'node:http'

export const AUTH_ORIGIN = 'https://auth.openai.com'
const TOKEN_URL = `${AUTH_ORIGIN}/api/accounts/oauth/token`
export const AUTH_URL = `${AUTH_ORIGIN}/api/accounts/authorize`
export const RESOURCE = 'https://api.openai.com/v1'
export const SCOPES = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct'
export const base64url = (value: Buffer) => value.toString('base64url')
const constantTimeMatch = (left: string, right: string) => {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

export const grantedPlanUsage = (scope: string) => scope.split(/\s+/).includes('chatgpt.tokens.use.direct') && scope.split(/\s+/).includes('resource.invoke')

export const requestJson = async (url: string, init: RequestInit, timeoutMs = 20000): Promise<Record<string, any>> => {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  const raw = await response.text()
  let data: Record<string, any> = {}
  try { data = JSON.parse(raw) } catch { /* Non-JSON error response */ }
  if (!response.ok) {
    const message = typeof data.error_description === 'string' ? data.error_description :
      typeof data.error?.message === 'string' ? data.error.message : String(data.error || `HTTP ${response.status}`)
    throw new Error(`OpenAI: ${message.slice(0, 350)}`)
  }
  return data
}

export const tokenRequest = (params: URLSearchParams) => requestJson(TOKEN_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: params
})

export const verifyIdToken = async (jwt: string, clientId: string, nonce?: string) => {
  const parts = jwt.split('.')
  if (parts.length !== 3) throw new Error('Niepoprawny token tożsamości.')
  let header: Record<string, any>
  let claims: Record<string, any>
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
  } catch { throw new Error('Niepoprawny format tokena tożsamości.') }
  if (!['RS256', 'ES256'].includes(header.alg) || typeof header.kid !== 'string') throw new Error('Nieobsługiwany podpis tokena.')
  const discovery = await requestJson(`${AUTH_ORIGIN}/.well-known/openid-configuration`, { method: 'GET' })
  const jwksUrl = String(discovery.jwks_uri || '')
  if (!jwksUrl.startsWith(`${AUTH_ORIGIN}/`)) throw new Error('Niezaufane źródło kluczy OpenAI.')
  const jwks = await requestJson(jwksUrl, { method: 'GET' })
  const jwk = (Array.isArray(jwks.keys) ? jwks.keys : []).find((key: any) => key.kid === header.kid && (!key.alg || key.alg === header.alg))
  if (!jwk) throw new Error('Nie znaleziono klucza podpisu OpenAI.')
  const key = createPublicKey({ key: jwk, format: 'jwk' })
  const signed = Buffer.from(`${parts[0]}.${parts[1]}`)
  const signature = Buffer.from(parts[2], 'base64url')
  const signatureValid = header.alg === 'ES256'
    ? verifySignature('sha256', signed, { key, dsaEncoding: 'ieee-p1363' }, signature)
    : verifySignature('RSA-SHA256', signed, key, signature)
  if (!signatureValid) throw new Error('Niepoprawny podpis tożsamości OpenAI.')
  const now = Math.floor(Date.now() / 1000)
  if (claims.iss !== AUTH_ORIGIN || !(typeof claims.aud === 'string' ? claims.aud === clientId : Array.isArray(claims.aud) && claims.aud.includes(clientId)) ||
    (Array.isArray(claims.aud) && claims.aud.length > 1 && claims.azp !== clientId) ||
    typeof claims.exp !== 'number' || claims.exp <= now - 60 ||
    typeof claims.iat !== 'number' || claims.iat > now + 60 ||
    (typeof claims.nbf === 'number' && claims.nbf > now + 60) ||
    typeof claims.sub !== 'string' || !claims.sub) throw new Error('Niepoprawne dane tożsamości OpenAI.')
  if (nonce !== undefined && claims.nonce !== nonce) throw new Error('Niepoprawny nonce tokena tożsamości.')
  return { subject: claims.sub as string, email: typeof claims.email === 'string' ? claims.email : '', name: typeof claims.name === 'string' ? claims.name : '' }
}

interface CallbackResult { code: string, clientId?: string }

export const listenForCode = async (state: string) => {
  let resolver: (value: CallbackResult) => void = () => {}
  let rejecter: (reason: Error) => void = () => {}
  const result = new Promise<CallbackResult>((resolve, reject) => { resolver = resolve; rejecter = reject })
  const server: Server = createServer((req, res) => {
    const host = req.headers.host
    if (host !== `127.0.0.1:${(server.address() as { port: number }).port}`) { res.writeHead(400).end(); return }
    const pathname = new URL(req.url || '/', `http://${host}`)
    if (req.method !== 'GET' || pathname.pathname !== '/auth/callback') { res.writeHead(404).end(); return }
    const matches = constantTimeMatch(pathname.searchParams.get('state') || '', state)
    if (!matches) { res.writeHead(400).end('Invalid OAuth state'); return }
    const error = pathname.searchParams.get('error')
    const code = pathname.searchParams.get('code')
    const clientId = pathname.searchParams.get('client_id') || undefined
    const success = !error && !!code
    // Browsers may keep loopback HTTP connections alive for minutes. Do not let
    // an idle callback socket delay the finished OAuth flow in Electron.
    res.shouldKeepAlive = false
    res.writeHead(success ? 200 : 400, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'close'
    })
    res.end(`<html lang="pl"><meta charset="utf-8"><title>Fiszki</title><body style="background:#10131c;color:#fff;font:16px system-ui;padding:40px">${success ? 'Połączono z Fiszki. Możesz zamknąć tę kartę.' : 'Autoryzacja nie została ukończona. Wróć do aplikacji.'}</body></html>`)
    if (error || !code) rejecter(new Error(error === 'access_denied' ? 'Anulowano autoryzację ChatGPT.' : `Nie udało się zalogować: ${error || 'brak kodu'}`))
    else resolver({ code, clientId })
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve() })
  })
  const redirectUri = `http://127.0.0.1:${(server.address() as { port: number }).port}/auth/callback`
  return {
    result,
    redirectUri,
    close: () => new Promise<void>(resolve => {
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        clearTimeout(fallback)
        resolve()
      }
      // `close()` can wait for a persistent browser connection even after the
      // callback code and tokens are received. Never block UI finalization.
      const fallback = setTimeout(() => {
        server.closeAllConnections()
        finish()
      }, 1200)
      server.close(finish)
      server.closeIdleConnections()
    })
  }
}

