🌐 Web-Asystent v3.2.0 — Dokumentacja Techniczna
Mobilna aplikacja webowa (PWA) zaprojektowana z myślą o instalatorach i technikach (zarządzanie antenami DVB-T/SAT, kalendarz zleceń, dziennik prac i notatki). 

🛠️ Architektura i Technologie
Platforma: Czysty HTML5, CSS3, JavaScript (ES6+), Progressive Web App (PWA).

Mapy i Geoinformacja: Leaflet.js (warstwy: Esri Satellite, OpenTopoMap, OpenStreetMap).

Lokalizacja: Natywne API Geolocation (navigator.geolocation.watchPosition) z wyznaczaniem azymutów.

Czujniki (Kompas): DeviceOrientationEvent / AbsoluteOrientationSensor z ręczną kalibracją offsetu.

Przechowywanie danych:

localStorage (szybki cache bieżący offline).

File System Access API (bezpośrednia, automatyczna synchronizacja z wybranym folderem lokalnym / Syncthing).

📂 Struktura Projektu
Plaintext
├── index.html            # Główny interfejs (Zakładki: Narzędzia, Kalendarz, Dziennik, Notatki)
├── style.css             # Arkusz stylów i motywy interfejsu
├── app.js                # Główna logika aplikacji (zarządzanie bazą, kalendarzem, gestami, Syncthing)
├── manifest.json         # Konfiguracja PWA
├── sw.js                 # Service Worker (wsparcie offline)
└── tools-src/
    ├── nadajniki.html    # Narzędzie azymutów DVB-T + kompas + mapy
    ├── satelity.html     # Kalkulator azymutu/elewacji SAT + kompas + mapy
    ├── bibliotekaDVBT.html # Baza wiedzy DVB-T
    ├── bibliotekaSAT.html  # Baza wiedzy SAT
    ├── Jednostki.html    # Przelicznik jednostek sygnału
    ├── internet.html     # Poradnik internet, kable, LTE
    └── docs/
        ├── konstelacjaDVbt2.html
        ├── konstelacjeSat.html
        ├── NC_PLUS_RESET.html
        ├── parametry-DVB-t.html
        ├── ParametrySat.html
        ├── UnicablePB.html
        ├── czestotliwosciDVBT.html
        ├── kolorySat.html
        └── muxy.hrml
    
🧭 Kluczowe Funkcje i Moduły
1. Narzędzia Techniczne (tools-src/)
Kierunki DVB-T / Satelity: Rysowanie linii azymutu startującej precyzyjnie z pozycji GPS użytkownika w kierunku wybranego nadajnika lub satelity geostacjonarnego.

Igła Kompasu: Jaskrawa, pistacjowa linia o wymiarach 3x150px (.phone-heading), zoptymalizowana pod kątem czytelności w pełnym słońcu.

Korekta kompasu (Offset): Wbudowany suwak ręcznej kalibracji od -180° do +180° (zapisywany w localStorage) niwelujący różnice w interpretacji magnetometru przez przeglądarki (np. Vanadium na GrapheneOS).

2. Kalendarz i Wizyty
Widok 2-tygodniowy lub pełen miesiąc.

Oznaczanie wizyt służbowych (pomarańczowy) i prywatnych (niebieski).

Menu kontekstowe (⋮) na karcie wizyty:

✏️ Edytuj

📋 Kopiuj wizytę (szybkie powielanie zleceń)

📋 Przenieś do Dziennika (automatyczne utworzenie wpisu księgowego z datą i adresem wizyty)

🗑️ Usuń

Obsługa adresów z bezpośrednim linkowaniem do nawigacji (geo:0,0?q=...) oraz numerów telefonu (tel:...).

3. Dziennik Prac i Finanse
Rejestrowanie przychodów i kosztów z podziałem na schematy kolorystyczne (Karta, Koszt, Przychód, Sklep, ZUS).

Edytor tekstowy z formatowaniem i możliwością masowego eksportu do plików .csv.

💾 System Kopia Zapasowej i Syncthing
Aplikacja wykorzystuje nowoczesne File System Access API do bezszwowej synchronizacji danych:

Połączenie jednorazowe: W zakładce Kalendarz pod przyciskiem Kopia zapasowa wybierasz folder docelowy (np. katalog obsługiwany przez aplikację Syncthing na urządzeniu).

Automatyczny zapis: Każda zmiana (dodanie/edycja/usunięcie wizyty, wpisu czy notatki) automatycznie generuje/nadpisuje plik web_asystent_dane.json w tym folderze.

Przywracanie: W razie zmiany urządzenia wystarczy wskaźnik pliku .json lub przywrócenie bazy przez dedykowany przycisk importu.

⚙️ Wskazówki i Utrzymanie (Tips for the Future)
Uprawnienia kompasu na iOS / Android: Przy pierwszym uruchomieniu przeglądarka może poprosić o zgodę na dostęp do czujników ruchu (DeviceOrientationEvent.requestPermission()).

Uprawnienia do folderu: Przeglądarki oparte na Chromium (np. Vanadium) mogą po restarcie aplikacji wymagać ponownego kliknięcia „Zezwól” na dostęp do powiązanego folderu Syncthing (ze względów bezpieczeństwa sandboxa).
