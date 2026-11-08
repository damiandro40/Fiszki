/** Keep internal file paths, IPC details and stack traces out of user-facing UI. */
export const describeLocalError = (error: unknown): string => {
  const raw = error instanceof Error ? error.message : String(error)
  const lower = raw.toLowerCase()

  if (/enospc|no space left|disk full|brak miejsca/.test(lower)) {
    return 'Brakuje miejsca na dysku. Zwolnij trochę przestrzeni i spróbuj ponownie.'
  }
  if (/eacces|eperm|access denied|permission denied|brak uprawnień|odmowa dostępu/.test(lower)) {
    return 'System nie pozwala zapisać lub odczytać pliku. Sprawdź uprawnienia do folderu danych.'
  }
  if (/przekracza 150 mb|too large|file too large|plik jest za duży/.test(lower)) {
    return 'Wybrany plik jest za duży. Wybierz mniejszą kopię zapasową.'
  }
  if (/invalid json|unexpected token|syntaxerror|nieprawidłowa struktura|nieprawidłowa zawartość|nie udało się odczytać fiszek/.test(lower)) {
    return 'Plik zawiera nieprawidłowe dane. Sprawdź, czy jest to kopia zapasowa Fiszki.'
  }
  if (/enoent|file not found/.test(lower)) {
    return 'Nie znaleziono potrzebnego pliku. Sprawdź jego lokalizację.'
  }
  return 'Operacja nie powiodła się. Spróbuj ponownie. Twoje istniejące fiszki nie zostały celowo usunięte.'
}
