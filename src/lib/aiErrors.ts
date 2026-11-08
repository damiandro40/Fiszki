/**
 * Public-facing errors from the optional AI integration.
 * Never render raw server/IPC errors: they may contain internal endpoint details.
 */
export type AiErrorCode =
  | 'LIMIT'
  | 'RATE_LIMIT'
  | 'AUTH'
  | 'PERMISSION'
  | 'NETWORK'
  | 'TIMEOUT'
  | 'UNAVAILABLE'
  | 'CANCELLED'
  | 'SECURE_STORAGE'
  | 'INVALID_RESPONSE'
  | 'UNKNOWN'

export interface AiErrorInfo {
  code: AiErrorCode
  message: string
  usageLimited: boolean
}

const messages: Record<AiErrorCode, string> = {
  LIMIT: 'Wykorzystano dostępny limit ChatGPT dla połączonych aplikacji. Spróbuj ponownie po jego odnowieniu lub sprawdź limity w ustawieniach ChatGPT.',
  RATE_LIMIT: 'Wysłano zbyt wiele zapytań w krótkim czasie. Spróbuj ponownie za chwilę.',
  AUTH: 'Połączenie z ChatGPT wygasło lub wymaga ponownej autoryzacji. Rozłącz konto i połącz je ponownie.',
  PERMISSION: 'Połączone konto nie ma wymaganych uprawnień do tej funkcji. Sprawdź dostęp swojego planu.',
  NETWORK: 'Nie można połączyć się z OpenAI. Sprawdź internet i spróbuj ponownie.',
  TIMEOUT: 'Serwer odpowiada zbyt długo. Spróbuj ponownie.',
  UNAVAILABLE: 'Usługa AI jest chwilowo niedostępna. Spróbuj ponownie później.',
  CANCELLED: 'Operacja została przerwana.',
  SECURE_STORAGE: 'System nie udostępnia bezpiecznego miejsca na dane logowania. Nie można połączyć konta na tym urządzeniu.',
  INVALID_RESPONSE: 'Nie udało się poprawnie odczytać odpowiedzi AI. Spróbuj ponownie lub poproś o mniejszą liczbę fiszek.',
  UNKNOWN: 'Nie udało się wykonać operacji AI. Spróbuj ponownie. Jeśli problem powraca, ponownie połącz konto.'
}

const knownCodes = new Set<string>(Object.keys(messages))

const getRaw = (error: unknown): string => error instanceof Error ? error.message : String(error)

export const describeAiError = (error: unknown): AiErrorInfo => {
  const raw = getRaw(error)
  const lower = raw.toLowerCase()
  const transported = raw.match(/FS_AI_ERROR:([A-Z_]+)/)
  let code: AiErrorCode = 'UNKNOWN'

  if (transported && knownCodes.has(transported[1])) {
    code = transported[1] as AiErrorCode
  } else if (lower.includes('subscription_sharing_usage_limit_exceeded') ||
    (lower.includes('subscription sharing') && lower.includes('usage limit')) ||
    lower.includes('chatgpt.tokens.usage_limit')) {
    code = 'LIMIT'
  } else if (/\b429\b|rate_limit|too many requests|rate limit/.test(lower)) {
    code = 'RATE_LIMIT'
  } else if (/\b401\b|invalid_grant|invalid_token|token expired|unauthorized|token wygas|autoryzacj.*wygas/.test(lower)) {
    code = 'AUTH'
  } else if (/\b403\b|insufficient_scope|permission_denied|brak zgody|nie udzieliło dostępu/.test(lower)) {
    code = 'PERMISSION'
  } else if (/safe.storage|safestorage|secure storage|bezpieczn.*(szyfrowan|magazyn)|bezpiecznego magazynu/.test(lower)) {
    code = 'SECURE_STORAGE'
  } else if (/\b(5\d\d)\b|service_unavailable|overloaded|bad gateway/.test(lower)) {
    code = 'UNAVAILABLE'
  } else if (/abort|timeout|timed out|czas.u|limit czasu|wygasło.*logowanie/.test(lower)) {
    code = 'TIMEOUT'
  } else if (/fetch failed|network|eai_again|enotfound|econnreset|econnrefused|internet|połączeni.*serwer/.test(lower)) {
    code = 'NETWORK'
  } else if (/anulowan|przerwan.*przez użytkownik|access_denied|cancelled/.test(lower)) {
    code = 'CANCELLED'
  } else if (/odpowiedź ai|odpowiedzi ai|format.*fiszek|brakuje listy fiszek|nie udało się odczytać fiszek/.test(lower)) {
    code = 'INVALID_RESPONSE'
  }

  return { code, message: messages[code], usageLimited: code === 'LIMIT' }
}

/** Only an opaque category crosses Electron's IPC error boundary. */
export const publicAiError = (error: unknown): Error => new Error(`FS_AI_ERROR:${describeAiError(error).code}`)
