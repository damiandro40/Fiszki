/** A clearly expressed request to do something *other* than create flashcards.
 * Ambiguous text and source material default to creating cards in the selected set.
 * This does not inspect or execute instructions embedded in attached materials. */
export const wantsConversationInsteadOfCards = (message: string): boolean => {
  const text = message.toLocaleLowerCase('pl').trim()
  if (!text) return false
  // An explicit request to create cards always wins over incidental question words.
  if (/(?:stwórz|zrób|przygotuj|wygeneruj|utwórz|ułóż|opracuj|zamień|przerób)\s+(?:mi\s+)?(?:\d+\s+)?(?:fiszk|kart|pytań|pytani)/i.test(text)) return false
  return /(?:\bnie\s+(?:tw[oó]rz|generuj|przygotowuj|r[oó]b)\s+fiszek\b|\bbez\s+fiszek\b|\btylko\s+(?:odpowiedz|wyjaśnij|wytłumacz|podsumuj|porozmawiaj|przetłumacz|sprawdź|oceń|odpowiedź)\b|\bzamiast\s+fiszek\b|^\s*(?:wyjaśnij|wytłumacz|odpowiedz|przetłumacz|podsumuj|przeanalizuj|porozmawiaj)\b)/i.test(text)
}

/** An optional number, otherwise the model determines adequate coverage. */
export const requestedCardCount = (message: string): number | null => {
  const match = message.match(/\b(\d{1,3})\s+(?:fiszek|fiszki|fiszk|kart\w*|pytań|pytani\w*)\b/iu)
  if (!match) return null
  const count = Number(match[1])
  if (count < 1 || count > 80) throw new Error('W jednej odpowiedzi można utworzyć 1–80 fiszek.')
  return count
}
