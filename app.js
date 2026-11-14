const metaVersionTag = document.querySelector('meta[name="version"]');
const APP_VERSION = metaVersionTag ? metaVersionTag.getAttribute('content') : "2.2.0";

document.addEventListener("DOMContentLoaded", () => {
    const versionEl = document.getElementById('app-version');
    if (versionEl) {
        versionEl.innerText = `v${APP_VERSION}`;
    }
    
    const dzisiajStr = new Date().toISOString().split('T')[0];
    wybranaData = dzisiajStr;
    aktRok = new Date().getFullYear();
    aktMiesiac = new Date().getMonth();

    // SPRAWDZENIE DOMYŚLNEGO MODUŁU ZAPISANEGO PRZEZ UŻYTKOWNIKA
    const domyslnyModul = localStorage.getItem('web_asystent_domyslny_modul') || 'narzedzia';
    
    // Uruchomienie aplikacji na domyślnym ekranie
    zmienZakladka(domyslnyModul);

    generujKalendarz();
    renderujWizytyDnia();
    renderujListe();
    renderujNotatki();
    inicjalizujGesty();
    
    // AKTYWACJA NASŁUCHIWANIA PRZYTRZYMANIA NA ZAKŁADKACH
    inicjalizujPrzytrzymanieZakladek();
});

// --- OBSŁUGA PRZYTRZYMANIA (LONG-PRESS) DLA DOMYŚLNEGO MODUŁU ---
function inicjalizujPrzytrzymanieZakladek() {
    const ekrany = ['narzedzia', 'kalendarz', 'dziennik', 'notatki'];
    const czasPrzytrzymania = 600; // milisekundy (0.6 sekundy)

    ekrany.forEach(ekran => {
        const btn = document.getElementById(`tab-${ekran}`);
        if (!btn) return;

        let timer = null;

        const startPress = (e) => {
            // Zapobiegamy domyślnym akcjom kontekstowym na telefonie
            timer = setTimeout(() => {
                localStorage.setItem('web_asystent_domyslny_modul', ekran);
                
                // Delikatna wibracja zwrotna w telefonie (jeśli wspierana)
                if (navigator.vibrate) navigator.vibrate(70);

                // Wizualne potwierdzenie dla użytkownika
                const nazwaModulu = btn.innerText.replace(/[\u{1F000}-\u{1F6FF}]/gu, '').trim();
                alert(`⭐ Ustawiono domyślny moduł startowy:\n„${nazwaModulu}”`);
            }, czasPrzytrzymania);
        };

        const cancelPress = () => {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
        };

        // Zdarzenia dotykowe (Mobile)
        btn.addEventListener('touchstart', startPress, {passive: true});
        btn.addEventListener('touchend', cancelPress);
        btn.addEventListener('touchmove', cancelPress);

        // Zdarzenia myszy (Desktop / Testy)
        btn.addEventListener('mousedown', startPress);
        btn.addEventListener('mouseup', cancelPress);
        btn.addEventListener('mouseleave', cancelPress);
    });
}

let wizyty = JSON.parse(localStorage.getItem('ksiegowosc_wizyty')) || [];
let wpisy = JSON.parse(localStorage.getItem('ksiegowosc_wpisy')) || [];
let notatki = JSON.parse(localStorage.getItem('ksiegowosc_notatki')) || [];

let aktRok, aktMiesiac;
let wybranaData = "";
let trybPelnyKalendarz = false;

const ekranyKolejnosc = ['narzedzia', 'kalendarz', 'dziennik', 'notatki'];
let aktualnyEkran = 'narzedzia';

function pokazWidok(idWidoku) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(idWidoku).classList.add('active');
    
    const menu = document.getElementById('glowne-menu-zakladek');
    const formularze = ['widok-formularza-wizyty', 'widok-formularza', 'widok-formularza-notatki'];
    
    if (formularze.includes(idWidoku)) {
        menu.style.display = 'none';
    } else {
        menu.style.display = 'flex';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function zmienZakladka(ekran) {
    aktualnyEkran = ekran;
    document.getElementById('tab-narzedzia').classList.remove('active-tab');
    document.getElementById('tab-kalendarz').classList.remove('active-tab');
    document.getElementById('tab-dziennik').classList.remove('active-tab');
    document.getElementById('tab-notatki').classList.remove('active-tab');

    if (ekran === 'narzedzia') {
        document.getElementById('tab-narzedzia').classList.add('active-tab');
        pokazWidok('widok-narzedzia');
    } else if (ekran === 'kalendarz') {
        document.getElementById('tab-kalendarz').classList.add('active-tab');
        pokazWidok('widok-kalendarza');
        generujKalendarz();
    } else if (ekran === 'dziennik') {
        document.getElementById('tab-dziennik').classList.add('active-tab');
        pokazWidok('widok-dziennika');
    } else if (ekran === 'notatki') {
        document.getElementById('tab-notatki').classList.add('active-tab');
        pokazWidok('widok-notatek');
    }
}

let touchstartX = 0;
let touchendX = 0;

function inicjalizujGesty() {
    document.addEventListener('touchstart', e => {
        touchstartX = e.changedTouches[0].screenX;
    }, {passive: true});

    document.addEventListener('touchend', e => {
        touchendX = e.changedTouches[0].screenX;
        przetworzGest();
    }, {passive: true});
}

function przetworzGest() {
    const wForm = document.querySelectorAll('.view.card');
    for (let f of wForm) {
        if (f.classList.contains('active') && f.id.includes('formularza')) return;
    }

    const roznica = touchendX - touchstartX;
    const progPrzesuniecia = 70;
    const currentIndex = ekranyKolejnosc.indexOf(aktualnyEkran);

    if (roznica < -progPrzesuniecia && currentIndex < ekranyKolejnosc.length - 1) {
        zmienZakladka(ekranyKolejnosc[currentIndex + 1]);
    } else if (roznica > progPrzesuniecia && currentIndex > 0) {
        zmienZakladka(ekranyKolejnosc[currentIndex - 1]);
    }
}

// --- OBSŁUGA KOPII ZAPASOWEJ (JSON) ---
function toggleBackupMenu() {
    const panel = document.getElementById('backup-actions-container');
    panel.classList.toggle('open');
}

function zapiszKopieBazy() {
    const pelnaBaza = {
        wersja: APP_VERSION,
        dataUtworzenia: new Date().toISOString(),
        wizyty: wizyty,
        wpisy: wpisy,
        notatki: notatki
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(pelnaBaza, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    
    const dzisiajPlik = new Date().toISOString().split('T')[0];
    downloadAnchor.setAttribute("download", `ksiegowy_backup_${dzisiajPlik}.json`);
    
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    zapiszDoSyncthing()
}

function triggerRestore() {
    document.getElementById('restore-file-input').click();
}

function przywracajBaze(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const zawartosc = JSON.parse(e.target.result);
            
            if (!zawartosc.wizyty || !zawartosc.wpisy || !zawartosc.notatki) {
                alert("Wybrany plik nie ma poprawnej struktury danych!");
                return;
            }

            if (confirm(`Czy na pewno chcesz przywrócić dane z pliku?\nZnaleziono:\n- Wizyt: ${zawartosc.wizyty.length}\n- Wpisów dziennika: ${zawartosc.wpisy.length}\n- Notatek: ${zawartosc.notatki.length}\n\nAktualne dane na urządzeniu zostaną nadpisane!`)) {
                wizyty = zawartosc.wizyty;
                wpisy = zawartosc.wpisy;
                notatki = zawartosc.notatki;

                localStorage.setItem('ksiegowosc_wizyty', JSON.stringify(wizyty));
                localStorage.setItem('ksiegowosc_wpisy', JSON.stringify(wpisy));
                localStorage.setItem('ksiegowosc_notatki', JSON.stringify(notatki));

                generujKalendarz();
                renderujWizytyDnia();
                renderujListe();
                renderujNotatki();
                
                alert("Dane zostały pomyślnie przywrócone!");
            }
        } catch (err) {
            alert("Błąd podczas odczytu pliku JSON: " + err.message);
        }
        event.target.value = "";
    };
    reader.readAsText(file);
}

const nazwyMiesiecy = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];

function toggleKalendarzTryb() {
    trybPelnyKalendarz = !trybPelnyKalendarz;
    const btn = document.getElementById('btn-toggle-cal');
    const btnPrev = document.getElementById('cal-btn-prev');
    const btnNext = document.getElementById('cal-btn-next');

    if (trybPelnyKalendarz) {
        btn.innerText = "▲ Zwiń do 2 tygodni";
        btnPrev.style.display = "block";
        btnNext.style.display = "block";
    } else {
        btn.innerText = "▼ Rozwiń pełny miesiąc";
        btnPrev.style.display = "none";
        btnNext.style.display = "none";
    }
    generujKalendarz();
}

function zmienMiesiac(kierunek) {
    if (!trybPelnyKalendarz) return;
    aktMiesiac += kierunek;
    if (aktMiesiac > 11) { aktMiesiac = 0; aktRok++; }
    if (aktMiesiac < 0) { aktMiesiac = 11; aktRok--; }
    generujKalendarz();
}

function renderujeKomorkeKalendarza(dataFmt, dzienNum, dObj) {
    const dzisiajStr = new Date().toISOString().split('T')[0];
    const wizytyDnia = wizyty.filter(w => w.data === dataFmt);

    let klasy = "cal-cell";
    if (dataFmt === wybranaData) klasy += " selected";
    if (dataFmt === dzisiajStr) klasy += " today";

    const maAllDaySluzbowy = wizytyDnia.some(w => w.calyDzien && (w.typ !== 'prywatny'));
    const maAllDayPrywatny = wizytyDnia.some(w => w.calyDzien && (w.typ === 'prywatny'));

    if (maAllDaySluzbowy && maAllDayPrywatny) {
        klasy += " allday-both";
    } else if (maAllDaySluzbowy) {
        klasy += " allday-sluzbowy";
    } else if (maAllDayPrywatny) {
        klasy += " allday-prywatny";
    }

    const wizytyGodzinowe = wizytyDnia.filter(w => !w.calyDzien);
    let kropkiHTML = "";

    if (wizytyGodzinowe.length > 0) {
        const ileKropek = Math.min(wizytyGodzinowe.length, 4);
        kropkiHTML = `<div class="dots-container">`;
        for (let k = 0; k < ileKropek; k++) {
            const isPriv = wizytyGodzinowe[k].typ === 'prywatny';
            kropkiHTML += `<div class="dot ${isPriv ? 'private' : ''}"></div>`;
        }
        kropkiHTML += `</div>`;
    }

    return `
        <div class="${klasy}" onclick="wybierzDzien('${dataFmt}')">
            <span style="font-weight: 600; ${wizytyGodzinowe.length > 0 ? 'margin-bottom: 4px;' : ''}">${dzienNum}</span>
            ${kropkiHTML}
        </div>
    `;
}

function generujKalendarz() {
    const grid = document.getElementById('calendar-grid');
    const title = document.getElementById('cal-month-title');
    grid.innerHTML = "";

    title.innerText = `${nazwyMiesiecy[aktMiesiac]} ${aktRok}`;

    const dniTygodnia = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];
    dniTygodnia.forEach(d => {
        grid.innerHTML += `<div class="cal-day-name">${d}</div>`;
    });

    const dzisiaj = new Date();

    if (!trybPelnyKalendarz) {
        let startOfWeek = new Date(dzisiaj);
        let day = startOfWeek.getDay() - 1;
        if (day === -1) day = 6;
        startOfWeek.setDate(startOfWeek.getDate() - day);

        for (let i = 0; i < 14; i++) {
            let dObj = new Date(startOfWeek);
            dObj.setDate(dObj.getDate() + i);

            const mStr = String(dObj.getMonth() + 1).padStart(2, '0');
            const dStr = String(dObj.getDate()).padStart(2, '0');
            const dataFmt = `${dObj.getFullYear()}-${mStr}-${dStr}`;

            grid.innerHTML += renderujeKomorkeKalendarza(dataFmt, dObj.getDate(), dObj);
        }
    } else {
        const pierwszyDzenMiesiaca = new Date(aktRok, aktMiesiac, 1);
        const ostatniDzienMiesiaca = new Date(aktRok, aktMiesiac + 1, 0);
        
        let startDay = pierwszyDzenMiesiaca.getDay() - 1;
        if (startDay === -1) startDay = 6;

        const liczbaDni = ostatniDzienMiesiaca.getDate();

        for (let i = 0; i < startDay; i++) {
            grid.innerHTML += `<div class="cal-cell empty"></div>`;
        }

        for (let d = 1; d <= liczbaDni; d++) {
            const mStr = String(aktMiesiac + 1).padStart(2, '0');
            const dStr = String(d).padStart(2, '0');
            const dataFmt = `${aktRok}-${mStr}-${dStr}`;
            const dObj = new Date(aktRok, aktMiesiac, d);

            grid.innerHTML += renderujeKomorkeKalendarza(dataFmt, d, dObj);
        }
    }
}

function wybierzDzien(dataStr) {
    wybranaData = dataStr;
    generujKalendarz();
    renderujWizytyDnia();
}

function toggleMenuAkcji(index, event) {
    event.stopPropagation();
    
    // Zamknij wszystkie inne otwarte menu rozwijane na liście
    document.querySelectorAll('[id^="menu-akcji-"]').forEach(el => {
        if (el.id !== `menu-akcji-${index}`) {
            el.style.display = 'none';
        }
    });

    const menu = document.getElementById(`menu-akcji-${index}`);
    if (menu) {
        menu.style.display = (menu.style.display === 'flex') ? 'none' : 'flex';
    }
}

// Opcjonalnie: kliknięcie gdziekolwiek poza menu na stronie zamyka otwarte listy
document.addEventListener('click', () => {
    document.querySelectorAll('[id^="menu-akcji-"]').forEach(el => {
        el.style.display = 'none';
    });
});


function renderujWizytyDnia() {
    const kontener = document.getElementById('lista-wizyt-dnia');
    const tytulDnia = document.getElementById('selected-day-title');
    kontener.innerHTML = "";

    tytulDnia.innerHTML = `Wizyty w dniu: <span style="font-size: 1.15rem; color: #e67e22;">${wybranaData}</span>`;

    const wizytyDnia = wizyty.filter(w => w.data === wybranaData);
    wizytyDnia.sort((a, b) => (a.godzina || "").localeCompare(b.godzina || ""));

    if (wizytyDnia.length === 0) {
        kontener.innerHTML = "<p style='text-align:center; color: #777; font-size: 0.9rem; margin: 15px 0;'>Brak wizyt w tym dniu.</p>";
        return;
    }

    wizytyDnia.forEach(w => {
        const globalIndex = wizyty.indexOf(w);
        const isPriv = w.typ === 'prywatny';
        const czasInfo = w.calyDzien ? '📅 Cały dzień' : `🕒 ${w.godzina}`;
        
        const adresHTML = w.adres 
            ? `<div class="visit-address-row">📍 <a href="geo:0,0?q=${encodeURIComponent(w.adres)}" style="color: #2980b9; text-decoration: underline; font-weight: 500;" onclick="event.stopPropagation()">${w.adres}</a></div>` 
            : '';

        const opisHTML = w.opis 
            ? `<div class="visit-desc-row">${w.opis}</div>` 
            : '';

        kontener.innerHTML += `
            <div class="visit-item ${isPriv ? 'prywatny' : ''}" style="position: relative;">
                <div class="visit-info" style="margin-bottom: 0;">
                    <!-- 1. Wiersz: Godzina po lewej, przycisk menu po prawej -->
                    <div class="visit-header-row">
                        <strong style="font-size: 1.15rem; color: ${isPriv ? '#2980b9' : '#d35400'};">${czasInfo}</strong>
                        <button class="visit-menu-btn" onclick="toggleMenuAkcji(${globalIndex}, event)">⋮</button>
                    </div>

                    <!-- 2. Wiersz: Numer telefonu pod spodem -->
                    <div class="visit-phone-row">
                        📞 <a href="tel:${w.klient}" style="color: #2980b9; text-decoration: underline;" onclick="event.stopPropagation()">${w.klient}</a>
                    </div>

                    <!-- 3. Wiersz: Adres -->
                    ${adresHTML}

                    <!-- 4. Wiersz: Opis z zachowaniem łamania linii -->
                    ${opisHTML}
                </div>

                <!-- ROZWIJANE MENU Z 4 AKCJAMI -->
                <div id="menu-akcji-${globalIndex}" class="visit-dropdown-menu" style="display: none;">
                    <button style="background-color: #f39c12; color: white;" onclick="edytujWizyte(${globalIndex})">✏️ Edytuj wizytę</button>
                    <button style="background-color: #16a085; color: white;" onclick="kopiujWizyte(${globalIndex})">📋 Kopiuj wizytę</button>
                    <button style="background-color: #8e44ad; color: white;" onclick="przeniesDoDziennikaZwizyty(${globalIndex})">📋 Przenieś do Dziennika</button>
                    <button style="background-color: #e74c3c; color: white;" onclick="usunWizyte(${globalIndex})">🗑️ Usuń wizytę</button>
                </div>
            </div>
        `;
    });
}

// --- AUTOMATYCZNE CZYSZCZENIE POLA TELEFONU ---
document.addEventListener("DOMContentLoaded", () => {
    const inputTelefon = document.getElementById('visit-client');
    if (inputTelefon) {
        // Gdy klikniesz w pole i jest tam dokładnie "Brak numeru" -> czyścimy
        inputTelefon.addEventListener('focus', () => {
            if (inputTelefon.value === "Brak numeru") {
                inputTelefon.value = "";
            }
        });

        // Jeśli wyjdziesz z pola i nic nie wpiszesz -> przywracamy "Brak numeru"
        inputTelefon.addEventListener('blur', () => {
            if (inputTelefon.value.trim() === "") {
                inputTelefon.value = "Brak numeru";
            }
        });
    }
});

function przeniesDoDziennikaZwizyty(index) {
    const w = wizyty[index];
    if (!w) return;

    // Najpierw zmieniamy zakładkę, żeby górny pasek poprawnie się podświetlił
    zmienZakladka('dziennik');

    // Przygotowanie formularza nowego wpisu w dzienniku
    document.getElementById('edit-index').value = "-1";
    document.getElementById('form-title').innerText = "Nowy wpis (z wizyty)";
    
    document.getElementById('data').value = w.data || wybranaData;
    document.getElementById('adres').value = w.adres || "";
    document.getElementById('przychod').value = "0,00";
    document.getElementById('koszt').value = "0,00";

    // Przechodzimy do widoku formularza
    pokazWidok('widok-formularza');
}

// --- OBSŁUGA PRZYTRZYMANIA KARTY WIZYTY ---
document.addEventListener("DOMContentLoaded", () => {
    // ... (Twoje dotychczasowe inicjalizacje)
    inicjalizujGestWizyt();
});

function inicjalizujGestWizyt() {
    const kontener = document.getElementById('lista-wizyt-dnia');
    if (!kontener) return;

    let pressTimer = null;

    kontener.addEventListener('touchstart', (e) => {
        const card = e.target.closest('.visit-item');
        if (!card) return;
        const index = parseInt(card.getAttribute('data-index'));

        pressTimer = setTimeout(() => {
            if (navigator.vibrate) navigator.vibrate(50);
            pokazMenuAkcjiWizyty(index);
        }, 600); // 0.6 sekundy przytrzymania
    }, {passive: true});

    kontener.addEventListener('touchend', () => clearTimeout(pressTimer));
    kontener.addEventListener('touchmove', () => clearTimeout(pressTimer));

    // Obsługa myszy dla testów na PC
    kontener.addEventListener('mousedown', (e) => {
        const card = e.target.closest('.visit-item');
        if (!card || e.target.tagName === 'A' || e.target.tagName === 'BUTTON') return;
        const index = parseInt(card.getAttribute('data-index'));

        pressTimer = setTimeout(() => {
            pokazMenuAkcjiWizyty(index);
        }, 600);
    });

    kontener.addEventListener('mouseup', () => clearTimeout(pressTimer));
    kontener.addEventListener('mouseleave', () => clearTimeout(pressTimer));
}

function pokazMenuAkcjiWizyty(index) {
    const w = wizyty[index];
    if (!w) return;

    const wybor = prompt(`Wizyta: ${w.klient || 'Bez nazwy'} (${w.data})\nWybierz akcję:\n\n1 - Przenieś do Dziennika\n2 - Kopiuj wizytę`, "1");

    if (wybor === "1") {
        przeniesDoDziennikaZwizyty(index);
    } else if (wybor === "2") {
        kopiujWizyte(index);
    }
}

function kopiujWizyte(index) {
    const w = wizyty[index];
    if (!w) return;

    // Ustawiamy formularz w tryb "Nowa wizyta" (edit-index = -1)
    document.getElementById('edit-visit-index').value = "-1";
    document.getElementById('visit-form-title').innerText = "Kopiuj wizytę";
    
    // Wypełniamy pola danymi ze skopiowanej wizyty
    document.getElementById('visit-type').value = w.typ || 'sluzbowy';
    document.getElementById('visit-all-day').checked = w.calyDzien || false;
    document.getElementById('container-godzina').style.display = w.calyDzien ? 'none' : 'block';
    document.getElementById('visit-time').value = w.godzina || "10:00";
    document.getElementById('visit-client').value = w.klient || "";
    document.getElementById('visit-address').value = w.adres || "";
    document.getElementById('visit-desc').value = w.opis || "";
    
    // Datę ustawiamy domyślnie na aktualnie wybraną w kalendarzu (lub dzisiejszą), 
    // żeby użytkownik od razu zapisał ją tam, gdzie chce, albo mógł ją zmienić w polu date.
    document.getElementById('visit-date').value = wybranaData || new Date().toISOString().split('T')[0];

    // Otwieramy formularz wizyty
    pokazWidok('widok-formularza-wizyty');
}

function toggleCałyDzień() {
    const chk = document.getElementById('visit-all-day').checked;
    const container = document.getElementById('container-godzina');
    container.style.display = chk ? 'none' : 'block';
}

function otworzFormularzWizytyDlaWybranegoDnia() {
    document.getElementById('edit-visit-index').value = "-1";
    document.getElementById('visit-form-title').innerText = "Nowa wizyta";
    document.getElementById('visit-type').value = "sluzbowy";
    document.getElementById('visit-client').value = "";
    document.getElementById('visit-address').value = "";
    document.getElementById('visit-desc').value = "";
    document.getElementById('visit-time').value = "10:00";
    document.getElementById('visit-all-day').checked = false;
    document.getElementById('container-godzina').style.display = 'block';
    document.getElementById('visit-date').value = wybranaData || new Date().toISOString().split('T')[0];
    
    pokazWidok('widok-formularza-wizyty');
}

function zamknijFormularzWizyty() {
    pokazWidok('widok-kalendarza');
}

function zapiszWizyte() {
    const editIndex = parseInt(document.getElementById('edit-visit-index').value);
    const calyDzien = document.getElementById('visit-all-day').checked;
    
    const wizyta = {
        typ: document.getElementById('visit-type').value,
        data: document.getElementById('visit-date').value,
        calyDzien: calyDzien,
        godzina: calyDzien ? "" : document.getElementById('visit-time').value,
        klient: document.getElementById('visit-client').value.trim() || "Brak numeru",
        adres: document.getElementById('visit-address').value.trim(),
        opis: document.getElementById('visit-desc').value.trim()
    };

    if (!wizyta.data) {
        alert("Podaj datę wizyty!");
        return;
    }

    if (editIndex === -1) {
        wizyty.push(wizyta);
    } else {
        wizyty[editIndex] = wizyta;
    }

    wizyty.sort((a, b) => (a.data + (a.godzina || "00:00")).localeCompare(b.data + (b.godzina || "00:00")));
    localStorage.setItem('ksiegowosc_wizyty', JSON.stringify(wizyty));
    
    wybranaData = wizyta.data;
    aktRok = parseInt(wybranaData.split('-')[0]);
    aktMiesiac = parseInt(wybranaData.split('-')[1]) - 1;

    generujKalendarz();
    renderujWizytyDnia();
    pokazWidok('widok-kalendarza');
    zapiszDoSyncthing()
}

function edytujWizyte(index) {
    const w = wizyty[index];
    document.getElementById('visit-type').value = w.typ || 'sluzbowy';
    document.getElementById('visit-date').value = w.data;
    document.getElementById('visit-all-day').checked = w.calyDzien || false;
    document.getElementById('container-godzina').style.display = w.calyDzien ? 'none' : 'block';
    document.getElementById('visit-time').value = w.godzina || "";
    document.getElementById('visit-client').value = w.klient;
    document.getElementById('visit-address').value = w.adres || "";
    document.getElementById('visit-desc').value = w.opis || "";
    document.getElementById('edit-visit-index').value = index;

    document.getElementById('visit-form-title').innerText = "Edycja wizyty";
    pokazWidok('widok-formularza-wizyty');
}

function usunWizyte(index) {
    if(confirm("Czy na pewno chcesz usunąć tę wizytę?")) {
        wizyty.splice(index, 1);
        localStorage.setItem('ksiegowosc_wizyty', JSON.stringify(wizyty));
        generujKalendarz();
        renderujWizytyDnia();
    }
}

// --- LOGIKA DZIENNIKA PRAC ---
function otworzFormularzWpisu() {
    document.getElementById('edit-index').value = "-1";
    document.getElementById('form-title').innerText = "Nowy wpis";
    document.getElementById('adres').value = "";
    document.getElementById('przychod').value = "0,00";
    document.getElementById('koszt').value = "0,00";
    document.getElementById('opis').innerHTML = "";
    document.getElementById('data').valueAsDate = new Date();
    pokazWidok('widok-formularza');
}

function zamknijFormularzWpisu() {
    pokazWidok('widok-dziennika');
}

function formatText(command) {
    document.execCommand(command, false, null);
}

function usunFormatowanie() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const selectedText = range.toString();
    if (!selectedText) return;
    range.deleteContents();
    range.insertNode(document.createTextNode(selectedText));
}

function zastosujSchemat(bgColor, textColor) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const selectedText = range.toString();
    if (!selectedText) {
        alert("Zaznacz tekst w polu Opis!");
        return;
    }
    const span = document.createElement('span');
    span.style.backgroundColor = bgColor;
    span.style.color = textColor;
    span.style.padding = "2px 4px";
    span.style.borderRadius = "3px";
    span.textContent = selectedText;
    range.deleteContents();
    range.insertNode(span);
}

function zapiszWpis() {
    const editIndex = parseInt(document.getElementById('edit-index').value);
    const wpis = {
        data: document.getElementById('data').value,
        adres: document.getElementById('adres').value,
        przychod: document.getElementById('przychod').value.trim() || "0,00",
        koszt: document.getElementById('koszt').value.trim() || "0,00",
        opis: document.getElementById('opis').innerHTML
    };

    if (!wpis.data) { alert("Podaj datę!"); return; }

    if (editIndex === -1) { wpisy.push(wpis); } 
    else { wpisy[editIndex] = wpis; }

    localStorage.setItem('ksiegowosc_wpisy', JSON.stringify(wpisy));
    renderujListe();
    pokazWidok('widok-dziennika');
}

async function eksportujWszystkieWpisyDoSyncthing() {
    if (!syncthingDirHandle) {
        alert("⚠️ Najpierw połącz aplikację z folderem Syncthing!\nPrzejdź do zakładki Kalendarz ➡️ Kopia zapasowa ➡️ Połącz z folderem Syncthing.");
        return;
    }

    if (!wpisy || wpisy.length === 0) {
        alert("Brak wpisów w dzienniku do wyeksportowania.");
        return;
    }

    if (!confirm(`Czy na pewno chcesz wyeksportować wszystkie wpisy (${wpisy.length}) do Syncthing i usunąć je z aktywnej listy w aplikacji?`)) {
        return;
    }

    try {
        const options = { mode: 'readwrite' };
        if ((await syncthingDirHandle.queryPermission(options)) !== 'granted') {
            if ((await syncthingDirHandle.requestPermission(options)) !== 'granted') {
                alert("Brak uprawnień do zapisu w wskazanym folderze.");
                return;
            }
        }

        let licznik = 0;
        let indeksyDoUsuniecia = [];

        // Pętla eksportująca
        for (let i = 0; i < wpisy.length; i++) {
            const w = wpisy[i];
            try {
                const naglowek = "Data;Adres;Przychod;Koszt;Opis\n";
                const czystyOpis = (w.opis || '').replace(/"/g, '""');
                const wiersz = `"${w.data}";"${w.adres || ''}";"${w.przychod}";"${w.koszt}";"${czystyOpis}"\n`;
                const zawartoscPliku = "\uFEFF" + naglowek + wiersz;

                const bezpiecznyAdres = (w.adres || 'brak_adresu').replace(/[\/\\?%*:|"<>]/g, '_').trim();
                const nazwaPliku = `${w.data}_${bezpiecznyAdres}.csv`;

                const fileHandle = await syncthingDirHandle.getFileHandle(nazwaPliku, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(zawartoscPliku);
                await writable.close();
                
                licznik++;
                indeksyDoUsuniecia.push(i); // Zapisujemy indeks pomyślnie wyeksportowanego wpisu
            } catch (fileErr) {
                console.error(`Błąd przy eksporcie wpisu ${w.data}:`, fileErr);
            }
        }

        // Usuwamy z głównej tablicy wpisy, które się powiodły (od końca, żeby nie zaburzyć indeksów)
        indeksyDoUsuniecia.sort((a, b) => b - a).forEach(idx => {
            wpisy.splice(idx, 1);
        });

        // Zapisujemy stan do localStorage i odświeżamy listę na ekranie
        localStorage.setItem('ksiegowosc_wpisy', JSON.stringify(wpisy));
        renderujListe();

        // Krótkie opóźnienie, żeby przeglądarka zdążyła wyczyścić listę przed pokazaniem alertu
        setTimeout(() => {
            alert(`✅ Pomyślnie wyeksportowano ${licznik} plików do Syncthing i usunięto je z listy!`);
        }, 50);

    } catch (err) {
        console.error("Błąd podczas masowego eksportu:", err);
        setTimeout(() => {
            alert("Wystąpił błąd podczas masowego eksportu: " + err.message);
        }, 50);
    }
}

function renderujListe() {
    const kontener = document.getElementById('lista-zdarzen');
    kontener.innerHTML = "";
    if (wpisy.length === 0) { kontener.innerHTML = "<p style='text-align:center; color: #777;'>Brak zapisanych zdarzeń.</p>"; return; }

    const pogrupowane = {};
    wpisy.forEach((w, index) => {
        w.oryginalnyIndex = index;
        if (!pogrupowane[w.data]) pogrupowane[w.data] = [];
        pogrupowane[w.data].push(w);
    });

    Object.keys(pogrupowane).sort().reverse().forEach(data => {
        let htmlGrupy = `<div class="day-group"><div class="day-title">📅 ${data}</div>`;
        pogrupowane[data].forEach(w => {
            htmlGrupy += `
                <div class="event-item">
                    <div class="event-info">
                        <strong style="font-size: 1.05rem; color: #2c3e50;">${w.adres || 'Brak adresu'}</strong><br>
                        Przychód: ${w.przychod} zł | Koszt: ${w.koszt} zł<br>
                        <small style="font-size: 0.9rem;">Opis: ${w.opis}</small>
                    </div>
                    <div class="event-actions" style="margin-top: 8px;">
                        <button class="btn-export" onclick="eksportujIUsun(${w.oryginalnyIndex})">Eksport CSV</button>
                        <button class="btn-edit" onclick="edytujWpis(${w.oryginalnyIndex})">Edytuj</button>
                        <button class="btn-delete" onclick="usunWpis(${w.oryginalnyIndex})">Usuń</button>
                    </div>
                </div>
            `;
        });
        htmlGrupy += `</div>`;
        kontener.innerHTML += htmlGrupy;
    });
}

function eksportujIUsun(index) {
    const w = wpisy[index];
    const naglowek = "Data;Adres;Przychod;Koszt;Opis\n";
    const wiersz = `"${w.data}";"${w.adres}";"${w.przychod}";"${w.koszt}";"${w.opis.replace(/"/g, '""')}"\n`;
    const zawartoscPliku = "\uFEFF" + naglowek + wiersz;
    const blob = new Blob([zawartoscPliku], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const bezpiecznyAdres = (w.adres || 'brak_adresu').replace(/[\/\\?%*:|"<>]/g, '_');
    link.download = `${w.data}_${bezpiecznyAdres}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    wpisy.splice(index, 1);
    localStorage.setItem('ksiegowosc_wpisy', JSON.stringify(wpisy));
    renderujListe();
    
}

function edytujWpis(index) {
    const w = wpisy[index];
    document.getElementById('data').value = w.data;
    document.getElementById('adres').value = w.adres;
    document.getElementById('przychod').value = w.przychod;
    document.getElementById('koszt').value = w.koszt;
    document.getElementById('opis').innerHTML = w.opis;
    document.getElementById('edit-index').value = index;
    document.getElementById('form-title').innerText = "Edycja wpisu";
    pokazWidok('widok-formularza');
}

function usunWpis(index) {
    if(confirm("Czy na pewno chcesz bezpowrotnie usunąć ten wpis?")) {
        wpisy.splice(index, 1);
        localStorage.setItem('ksiegowosc_wpisy', JSON.stringify(wpisy));
        renderujListe();
    }
}

// --- LOGIKA NOTATEK ---
function otworzFormularzNotatki() {
    document.getElementById('edit-note-index').value = "-1";
    document.getElementById('note-form-title').innerText = "Nowa notatka";
    document.getElementById('note-title').value = "";
    document.getElementById('note-content').value = "";
    pokazWidok('widok-formularza-notatki');
}

function zamknijFormularzNotatki() {
    pokazWidok('widok-notatek');
}

function zapiszNotatke() {
    const editIndex = parseInt(document.getElementById('edit-note-index').value);
    const tytul = document.getElementById('note-title').value.trim();
    const tresc = document.getElementById('note-content').value.trim();

    if (!tresc && !tytul) { alert("Notatka nie może być pusta!"); return; }

    const notatka = {
        data: new Date().toISOString().split('T')[0],
        tytul: tytul || "Bez tytułu",
        tresc: tresc
    };

    if (editIndex === -1) { notatki.unshift(notatka); } 
    else { notatki[editIndex] = notatka; }

    localStorage.setItem('ksiegowosc_notatki', JSON.stringify(notatki));
    renderujNotatki();
    pokazWidok('widok-notatek');
    zapiszDoSyncthing()
}

function renderujNotatki() {
    const kontener = document.getElementById('lista-notatek');
    kontener.innerHTML = "";
    if (notatki.length === 0) { kontener.innerHTML = "<p style='text-align:center; color: #777;'>Brak zapisanych notatek.</p>"; return; }

    notatki.forEach((n, index) => {
        kontener.innerHTML += `
            <div class="note-item">
                <div class="note-info">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <strong style="font-size: 1.05rem; color: #2c3e50;">${n.tytul}</strong>
                        <small style="color: #888;">${n.data}</small>
                    </div>
                    <p style="margin: 4px 0 8px 0; white-space: pre-wrap; font-size: 0.95rem;">${n.tresc}</p>
                </div>
                <div class="event-actions" style="margin-top: 8px;">
                    <button class="btn-edit" onclick="edytujNotatke(${index})">Edytuj</button>
                    <button class="btn-delete" onclick="usunNotatke(${index})">Usuń</button>
                </div>
            </div>
        `;
    });
}

function edytujNotatke(index) {
    const n = notatki[index];
    document.getElementById('note-title').value = n.tytul;
    document.getElementById('note-content').value = n.tresc;
    document.getElementById('edit-note-index').value = index;
    document.getElementById('note-form-title').innerText = "Edycja notatki";
    pokazWidok('widok-formularza-notatki');
}

function usunNotatke(index) {
    if(confirm("Czy na pewno chcesz usunąć tę notatkę?")) {
        notatki.splice(index, 1);
        localStorage.setItem('ksiegowosc_notatki', JSON.stringify(notatki));
        renderujNotatki();
    }
}

// obługa przycisku do wybierania folderu sychronizacji
let syncthingDirHandle = null;

// 1. Wybór folderu Syncthing przez użytkownika (wystarczy raz)
async function podlaczFolderSyncthing() {
    if (!('showDirectoryPicker' in window)) {
        alert("Twoja przeglądarka nie wspiera bezpośredniego dostępu do folderów. Używaj Chrome na Androidzie.");
        return;
    }

    try {
        syncthingDirHandle = await window.showDirectoryPicker();
        alert("✅ Folder Syncthing został pomyślnie podłączony! Od teraz dane będą zapisywane tam automatycznie.");
        // Wykonaj natychmiastowy zapis testowy
        await zapiszDoSyncthing();
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error("Błąd wyboru folderu:", err);
            alert("Nie udało się uzyskać dostępu do folderu.");
        }
    }
}

// 2. Automatyczny zapis pliku w podłączonym folderze
async function zapiszDoSyncthing() {
    if (!syncthingDirHandle) return;

    try {
        // Sprawdź lub poproś o uprawnienia zapisu
        const options = { mode: 'readwrite' };
        if ((await syncthingDirHandle.queryPermission(options)) !== 'granted') {
            if ((await syncthingDirHandle.requestPermission(options)) !== 'granted') {
                return;
            }
        }

        const pelnaBaza = {
            wersja: "3.0.0",
            ostatniaModyfikacja: new Date().toISOString(),
            wizyty: wizyty,
            wpisy: wpisy,
            notatki: notatki
        };

        // Tworzy lub nadpisuje plik web_asystent_dane.json w wybranym folderze
        const fileHandle = await syncthingDirHandle.getFileHandle("web_asystent_dane.json", { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(pelnaBaza, null, 2));
        await writable.close();
        
        console.log("🔄 Zsynchronizowano automatycznie z folderem Syncthing.");
    } catch (err) {
        console.error("Błąd zapisu do Syncthing:", err);
    }
}


// Rejestracja Service Workera dla PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker zarejestrowany:', reg.scope))
            .catch(err => console.log('Błąd SW:', err));
    });
}


