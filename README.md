# Fiszki 1.0.6

Aplikacja desktopowa Electron + React + TipTap + Tailwind. Ta wersja naprawia pusty ekran podczas otwierania **Ustawienia → Aktualizacje** w poprzednim wydaniu i przygotowuje aplikację do aktualizacji z **GitHub Releases: https://github.com/damiandro40/Fiszki/releases**.

## Instalacja zależności i uruchomienie

Wymagany Node.js 22+ oraz Windows 10/11 do zbudowania i przetestowania instalatora Windows.

```powershell
npm install
npm run dev
```

Przed wydaniem:

```powershell
npm run typecheck
npm run check:structure
npm test
npm run build
```

Po wykonaniu `npm install` dodaj wygenerowany `package-lock.json` do repozytorium, aby przyszłe wydania korzystały z tych samych wersji zależności. Nie dodawaj `node_modules`, `out` ani `release` do Git.

## Jak działa updater

- Aplikacja zainstalowana przez **Windows NSIS** pyta GitHub Releases repozytorium **damiandro40/Fiszki**, nie jego gałąź `main` ani zwykłe pliki w repozytorium.
- Sprawdza wydania po uruchomieniu i co 6 godzin; w **Ustawienia → Aktualizacje** można sprawdzić ręcznie.
- Nowa **publiczna, stabilna** wersja o numerze większym niż obecny pojawi się jako propozycja pobrania. Pobieranie pokazuje postęp, instalacja wymaga potwierdzenia.
- Wydanie musi zawierać wygenerowane **instalator `.exe` i `latest.yml`** z tego samego buildu. Jeśli otrzymasz `.blockmap`, dołącz także ten plik. ZIP z kodem źródłowym nie służy do aktualizacji aplikacji.
- Aktualizacje nie działają w `npm run dev`, z `win-unpacked` ani w wersji portable; wymagają instalacji przez wygenerowany instalator NSIS.
- Wydanie GitHub nie może być `Draft` ani `Pre-release` (kanał stabilny). Brak publicznego wydania lub `latest.yml` jest pokazywany jako błąd z możliwością ponowienia.
- Użytkownik nie potrzebuje konta GitHub ani klucza dostępu. Nigdy nie wbudowuj swojego tokenu GitHub w aplikację.

## Pierwsza publikacja — zalecana metoda (automatyczny build EXE na GitHubie)

To metoda najłatwiejsza, **nie trzeba najpierw samodzielnie tworzyć EXE**. Prześlij do publicznego repozytorium cały projekt, łącznie z `.github/workflows/release-windows.yml`:

```powershell
npm install
git add .
git commit -m "Fiszki 1.0.6 – naprawa updatera"
git branch -M main
git remote -v    # musi wskazywać github.com/damiandro40/Fiszki
git push -u origin main
git tag v1.0.6
git push origin v1.0.6
```

Jeśli repozytorium jeszcze nie jest powiązane z lokalnym katalogiem, wykonaj wcześniej:

```powershell
git init
git remote add origin https://github.com/damiandro40/Fiszki.git
```

GitHub → **Actions** → workflow **Fiszki - wydanie Windows** zbuduje instalator NSIS, plik `latest.yml` oraz ewentualną `.blockmap` i opublikuje je w **Releases**. W ustawieniach repozytorium muszą być dozwolone GitHub Actions i publikowanie wydań przez token Actions (w workflow ustawione `contents: write`).

**Pierwszą wersję zawierającą updater trzeba normalnie zainstalować z EXE.** Od kolejnej wersji (np. `1.0.7`) aplikacja sama zaproponuje update. Jeśli masz zainstalowane Fiszki 1.0.5, a w GitHub Releases nie ma nowej wersji, sama nie wykryje poprawki: zainstaluj 1.0.6 ręcznie.

## Alternatywa — lokalne budowanie EXE i ręczny upload

Na komputerze z Windowsem:

```powershell
npm install
npm run dist:win
Get-ChildItem .\release\
```

Pliki trafiają do `release/`. Polecenie lokalnego buildu **nie publikuje** automatycznie żadnych danych na GitHubie. Jeżeli w tym katalogu wygenerowano zarówno instalator, jak i `latest.yml`, możesz je przesłać ręcznie do jednego publicznego wydania GitHub **Releases → Draft a new release** z tagiem `v1.0.6`; dołącz także `.blockmap`, jeśli istnieje. **Nie twórz `latest.yml` na oko ani nie mieszaj metadanych i instalatora z różnych buildów.**

Jeżeli lokalny build nie wygeneruje `latest.yml`, **nie publikuj samego EXE jako aktualizacji** — skorzystaj z zalecanej metody z tagiem Git i workflow GitHub Actions, która buduje oraz publikuje komplet plików. Wynika to z wymagań `electron-builder` dla kanału GitHub Releases.

## Test aktualizacji

1. Zainstaluj **1.0.6** z GitHub Releases.
2. Upewnij się, że Ustawienia → Aktualizacje pokazują „Fiszki 1.0.6” i źródło `damiandro40/Fiszki`.
3. Zwiększ `version` w `package.json` na **1.0.7** (bez zmieniania `appId` ani dostawcy aktualizacji), wykonaj commit i wypchnij tag `v1.0.7`.
4. Po publikacji publicznego wydania `1.0.7` wybierz **Sprawdź aktualizacje** w zainstalowanej 1.0.6.
5. Pobierz aktualizację, zaakceptuj instalację i sprawdź wersję po restarcie.

Uwaga: aktualizacja **nie zastępuje danych użytkownika** zapisanych w `app.getPath('userData')`; biblioteka, szkice i nauka pozostają poza folderem instalacyjnym. Utrzymuj `appId: studio.fiszki.desktop` bez zmian. Podpisywanie kodu Windows jest zalecane przed publiczną dystrybucją.

## Dlaczego poprzednio zakładka była pusta?

`ModalProvider` tworzy portal modali i jego zawartość zachowuje kontekst Reacta z punktu montowania providera, nie z położenia elementu w DOM. W wydaniu 1.0.5 `UpdaterProvider` był jego dzieckiem, zatem modal nie miał dostępu do `useUpdater()` i zgłaszał wyjątek renderowania. W 1.0.6 `UpdaterProvider` otacza `ModalProvider` w `src/main.tsx`, co naprawia problem również w zagnieżdżonych modalach.
