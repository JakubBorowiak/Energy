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

## Następne kroki (pomysły)

- Podłączenie przycisku „Przeanalizuj z AI" pod prawdziwy model (Claude API)
- Powiadomienia (expo-notifications) — przypomnienie o suplementach / podsumowaniu dnia
- Natywny picker czasu zamiast pola HH:MM (expo `DateTimePicker`)
- Eksport / backup danych
