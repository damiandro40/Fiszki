# Naprawa błędu `Electron uninstall` w Windows

Ta wersja projektu **automatycznie sprawdza** kompletność lokalnego Electrona przy `npm run dev`. Jeśli brakuje `node_modules/electron/path.txt` lub `node_modules/electron/dist/electron.exe`, naprawia instalację bez `npm rebuild`:

1. Odczytuje **dokładną wersję** z `node_modules/electron/package.json` oraz architekturę systemu.
2. Pobiera właściwe archiwum `.zip` z oficjalnego GitHub Releases (lub alternatywnego serwera npmmirror).
3. Sprawdza sumę SHA-256 według pliku `SHASUMS256.txt`.
4. Rozpakowuje `electron.exe` do `node_modules/electron/dist/` i zapisuje `path.txt`.

## Użycie na Windows

Wypakuj tę paczkę i zastąp pliki projektu. **Nie kasuj katalogu `node_modules` ani swoich lokalnych danych fiszek.**

Kliknij `fix-electron.cmd` albo w terminalu w katalogu projektu:

```cmd
npm run fix:electron
npm run dev
```

Od teraz `npm run dev` uruchamia ten sam mechanizm naprawy automatycznie w razie potrzeby.

## Jeżeli również ręczne pobieranie nie działa

Skrypt poda konkretny błąd pobierania. Jeśli GitHub i npmmirror są blokowane przez sieć, możesz pobrać w przeglądarce **dokładnie wskazane w błędzie dwa pliki**: archiwum `electron-v<wersja>-win32-x64.zip` (dla x64) i `SHASUMS256.txt` z oficjalnego wydania Electron. Umieść je w `scripts/electron-cache/` i ponownie uruchom `fix-electron.cmd`.

Nie pobieraj przypadkowych plików `electron.exe` z nieznanych stron. Naprawa porównuje SHA-256 z listą wydania i nie zainstaluje niezgodnego archiwum.

**Ważne:** Nie mogę zdalnie przeprowadzić naprawy na Twoim komputerze. Skrypt jest przygotowany dla Windows, ale nie został wykonany na Twoim komputerze; bez dostępu do Twojego środowiska nie można zagwarantować, że pobierania nie blokuje zapora, proxy lub antywirus.
