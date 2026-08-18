# Energy — wersja Expo Go 📱

Natywna wersja apki (React Native + Expo). Ten sam model danych i logika co prototyp webowy,
ale odpalasz ją na telefonie przez **Expo Go**.

## Jak uruchomić (krok po kroku)

1. Zainstaluj na telefonie aplikację **Expo Go** (App Store / Google Play).
2. Na komputerze, w tym folderze:
   ```bash
   cd expo
   npm install        # tylko pierwszy raz
   npx expo start
   ```
3. W terminalu pokaże się **kod QR**.
   - **Android:** zeskanuj QR z poziomu aplikacji Expo Go.
   - **iPhone:** zeskanuj QR zwykłym aparatem, otworzy się w Expo Go.
4. Apka załaduje się na telefonie. Klikasz na żywo — zmiany w kodzie odświeżają się automatycznie.

> Telefon i komputer muszą być w tej samej sieci Wi-Fi. Gdyby nie łapało,
> odpal `npx expo start --tunnel`.

## Co jest w środku

- `App.js` — cały interfejs (widok Dziś + Statystyki, modale, stack suplementów, oceny, notatki)
- `src/store.js` — logika: streaki, korelacje (Pearson), statystyki, zapis do AsyncStorage
- `src/theme.js` — kolory

## Funkcje (1:1 z prototypem)

- Nawyki dobre / do rzucenia / tygodniowe, streaki, paski postępu
- Stack suplementów: jeden klik = cały stack, godziny, edycja pojedynczych, „dodatkowy na dziś"
- Ocena dnia: sen (h + pora), praca, energia, ocena siebie, notatka — suwaki
- Incydenty dopaminowe z presetami i wyzwalaczami
- **Notatka na każdym elemencie** (✎ / 📝)
- Statystyki: kafelki, kalendarz 30 dni, scroll wg godziny, radar korelacji z pewnością
- Dane zapisywane lokalnie (AsyncStorage) — zostają po zamknięciu

## Zakładka Ustawienia ⚙️

- **Analiza AI (Claude)** — wklej swój klucz API Anthropic (`sk-ant-...`). Trzymany tylko
  lokalnie na telefonie. Wtedy przycisk „Przeanalizuj z AI" w Statystykach wysyła Twoje dane
  + notatki do modelu `claude-opus-5`, który szuka wzorców — zawsze z etykietą pewności.
  Klucz wygenerujesz na https://console.anthropic.com (płatne wg zużycia).
- **Przypomnienia** — codzienne powiadomienia lokalne: o suplementach i o wieczornym
  podsumowaniu dnia. Ustaw godzinę i przełącznik. (W Expo Go działają powiadomienia lokalne.)
- **Kopia danych** — eksport do pliku JSON przez systemowe „Udostępnij" (zapis w chmurze /
  wysyłka do siebie) oraz import przez wklejenie JSON-a. Backup i przenoszenie między telefonami.

## Następne kroki (pomysły)

- Natywny picker czasu zamiast pola HH:MM (koło z godzinami) — `@react-native-community/datetimepicker`
- Import kopii przez wybór pliku (document picker) zamiast wklejania
- Wykres trendów w czasie (sen/energia tydzień do tygodnia)
