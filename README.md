# Energy 🔋

Aplikacja do świadomego ogarniania nawyków — dobrych, złych i tygodniowych — plus
lekki dziennik dnia i **radar korelacji**, który podpowiada zależności (np. sen ↔ jakość pracy)
zawsze z informacją, *na ilu dniach danych* to stoi.

## Prototyp (ta wersja)

`index.html` — jeden plik, działa w przeglądarce, dane zapisują się lokalnie (localStorage).
Otwórz na telefonie lub na kompie i klikaj. Zero instalacji.

### Co już działa

**Zakładka „Dziś"**
- ✅ Nawyki dzienne (dobre) ze streakami 🔥
- 🚫 Nawyki do rzucenia — licznik „dni czysto", bez oceniania
- 📅 Nawyki tygodniowe z celem (np. siłownia 4×/tydz.) i paskiem postępu
- 💊 **Stack suplementów** — jeden klik = cały stack wzięty, z godziną.
  Pojedyncze suplementy: zmiana godziny, odznaczenie, albo „dodatkowy na dziś"
- 📊 Ocena dnia: sen (godziny + pora), jakość pracy, energia, ogólna ocena siebie, notatka
- 📱 Incydenty dopaminowe: co, ile minut, o której, co Cię pchnęło (nuda/stres/…)
- ◀ ▶ Nawigacja po dniach (można uzupełnić wczoraj)

**Zakładka „Statystyki"**
- Kafelki: najlepszy streak, dni z danymi, incydenty, czas na scrollu
- Kalendarz aktywności (30 dni, jak kropki na GitHubie)
- Wykres scrollowania wg godziny
- **Radar korelacji** — automat liczy związki między parami (Pearson),
  pokazuje tylko wyraźne i z etykietą pewności (mało/średnio/dużo danych).
  Uwzględnia okna tygodniowe (np. liczba treningów w 7 dniach ↔ praca)
- ✨ Przycisk „Przeanalizuj z AI" — na razie podgląd; docelowo prawdziwe AI

## Filozofia

- **Dwie warstwy:** tracker (co robię) + analityk (dlaczego się tak czuję/pracuję)
- **Dwa poziomy analizy:** automat-radar (tani, ciągły, pary) + AI-detektyw (na żądanie, złożone układy)
- **Zawsze pokazuj pewność** — korelacja to hipoteza, nie prawda. Nigdy nie wróżymy z fusów.

## Następny krok: Expo Go

Logika i model danych z prototypu przenoszą się 1:1 do React Native:
- ekrany = te same widoki (Dziś / Statystyki)
- localStorage → AsyncStorage
- przycisk AI → realne zapytanie do modelu (Claude API) z Twoimi danymi + twardym promptem „mów o pewności"
- powiadomienia, widget szybkiego dodawania incydentu

## Uruchomienie

Po prostu otwórz `index.html` w przeglądarce. Nic więcej.
