const metaVersionTag = document.querySelector('meta[name="version"]');
const APP_VERSION = metaVersionTag ? metaVersionTag.getAttribute('content') : "3.2.0";

// --- JEDNA, ZBIORCZA INICJALIZACJA STARTOWA ---
document.addEventListener("DOMContentLoaded", async () => {
    // 1. Wersja aplikacji
    const versionEl = document.getElementById('app-version');
    if (versionEl) {
        versionEl.innerText = `v${APP_VERSION}`;
    }

    const dzisiajStr = new Date().toISOString().split('T')[0];
    wybranaData = dzisiajStr;
    aktRok = new Date().getFullYear();
    aktMiesiac = new Date().getMonth();

    // 2. Moduł startowy
    const domyslnyModul = localStorage.getItem('web_asystent_domyslny_modul') || 'narzedzia';
    zmienZakladka(domyslnyModul);

    // 3. Inicjalizacja IndexedDB dla notatek i zdjęć + migracja ze starego localStorage
    await initNotatkiDB();
    await zaladujNotatkiZIndexedDB();

    // 4. Generowanie widoków
    generujKalendarz();
    renderujWizytyDnia();
    renderujListe();
    renderujNotatki();
    inicjalizujGesty();
    inicjalizujGestyLightboxu();
    inicjalizujPrzytrzymanieZakladek();

    // 5. Automatyczne czyszczenie pola telefonu w formularzu wizyty
    const inputTelefon = document.getElementById('visit-client');
    if (inputTelefon) {
        inputTelefon.addEventListener('focus', () => {
            if (inputTelefon.value === "Brak numeru") {
                inputTelefon.value = "";
            }
        });

        inputTelefon.addEventListener('blur', () => {
            if (inputTelefon.value.trim() === "") {
                inputTelefon.value = "Brak numeru";
            }
        });
    }
});

// --- OBSŁUGA PRZYTRZYMANIA (LONG-PRESS) DLA DOMYŚLNEGO MODUŁU ---
function inicjalizujPrzytrzymanieZakladek() {
    const ekrany = ['narzedzia', 'kalendarz', 'dziennik', 'notatki'];
    const czasPrzytrzymania = 600;

    ekrany.forEach(ekran => {
        const btn = document.getElementById(`tab-${ekran}`);
        if (!btn) return;

        let timer = null;

        const startPress = () => {
            timer = setTimeout(() => {
                localStorage.setItem('web_asystent_domyslny_modul', ekran);
                if (navigator.vibrate) navigator.vibrate(70);
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

        btn.addEventListener('touchstart', startPress, {passive: true});
        btn.addEventListener('touchend', cancelPress);
        btn.addEventListener('touchmove', cancelPress);
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
    const lightbox = document.getElementById('note-photo-lightbox');
    if (lightbox && lightbox.classList.contains('active')) return;

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

async function zbudujPelnaBazeDoKopi() {
    const wszystkieZdjecia = await pobierzWszystkieZdjeciaZDB();
    const zserializowaneZdjecia = [];

    for (const z of wszystkieZdjecia) {
        const base64 = await blobNaBase64(z.blob);
        zserializowaneZdjecia.push({
            id: z.id,
            noteId: z.noteId,
            name: z.name,
            type: z.type,
            size: z.blob ? z.blob.size : (z.size || 0),
            dataBase64: base64
        });
    }

    return {
        wersja: APP_VERSION,
        dataUtworzenia: new Date().toISOString(),
        wizyty: wizyty,
        wpisy: wpisy,
        notatki: notatki,
        notatkiZdjecia: zserializowaneZdjecia,
        wlasneAccSat: JSON.parse(localStorage.getItem('wlasne_acc_sat')) || [],
        wlasneAccDvbt: JSON.parse(localStorage.getItem('wlasne_acc_dvbt')) || [],
        wlasneAccInternet: JSON.parse(localStorage.getItem('wlasne_acc_internet')) || [],
        wlasneAccMonitoring: JSON.parse(localStorage.getItem('wlasne_acc_monitoring')) || []
    };
}

async function zapiszKopieBazy() {
    try {
        const pelnaBaza = await zbudujPelnaBazeDoKopi();
        const jsonBlob = new Blob([JSON.stringify(pelnaBaza, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(jsonBlob);

        const downloadAnchor = document.createElement('a');
        downloadAnchor.href = url;
        const dzisiajPlik = new Date().toISOString().split('T')[0];
        downloadAnchor.download = `ksiegowy_backup_${dzisiajPlik}.json`;

        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);

        await zapiszDoSyncthing();
    } catch (err) {
        alert("Błąd podczas tworzenia kopii zapasowej: " + err.message);
    }
}

function triggerRestore() {
    document.getElementById('restore-file-input').click();
}

async function przywracajBaze(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const tekst = await file.text();
        const zawartosc = JSON.parse(tekst);

        if (!zawartosc.wizyty || !zawartosc.wpisy || !zawartosc.notatki) {
            alert("Wybrany plik nie ma poprawnej struktury danych!");
            event.target.value = "";
            return;
        }

        const liczbaZdjec = Array.isArray(zawartosc.notatkiZdjecia) ? zawartosc.notatkiZdjecia.length : 0;

        if (confirm(`Czy na pewno chcesz przywrócić dane z pliku?\nZnaleziono:\n- Wizyt: ${zawartosc.wizyty.length}\n- Wpisów dziennika: ${zawartosc.wpisy.length}\n- Notatek: ${zawartosc.notatki.length}\n- Zdjęć w notatkach: ${liczbaZdjec}\n\nAktualne dane na urządzeniu zostaną nadpisane!`)) {
            wizyty = zawartosc.wizyty;
            wpisy = zawartosc.wpisy;

            localStorage.setItem('ksiegowosc_wizyty', JSON.stringify(wizyty));
            localStorage.setItem('ksiegowosc_wpisy', JSON.stringify(wpisy));

            if (zawartosc.wlasneAccSat) {
                localStorage.setItem('wlasne_acc_sat', JSON.stringify(zawartosc.wlasneAccSat));
            }
            if (zawartosc.wlasneAccDvbt) {
                localStorage.setItem('wlasne_acc_dvbt', JSON.stringify(zawartosc.wlasneAccDvbt));
            }
            if (zawartosc.wlasneAccInternet) {
                localStorage.setItem('wlasne_acc_internet', JSON.stringify(zawartosc.wlasneAccInternet));
            }
            if (zawartosc.wlasneAccMonitoring) {
                localStorage.setItem('wlasne_acc_monitoring', JSON.stringify(zawartosc.wlasneAccMonitoring));
            }

            await przywrocNotatkiIZdjeciaDoDB(zawartosc.notatki, zawartosc.notatkiZdjecia || []);
            await zaladujNotatkiZIndexedDB();

            generujKalendarz();
            renderujWizytyDnia();
            renderujListe();
            renderujNotatki();

            alert("Dane oraz zdjęcia zostały pomyślnie przywrócone!");
        }
    } catch (err) {
        alert("Błąd podczas odczytu pliku JSON: " + err.message);
    }
    event.target.value = "";
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
                    <div class="visit-header-row">
                        <strong style="font-size: 1.15rem; color: ${isPriv ? '#2980b9' : '#d35400'};">${czasInfo}</strong>
                        <button class="visit-menu-btn" onclick="toggleMenuAkcji(${globalIndex}, event)">⋮</button>
                    </div>

                    <div class="visit-phone-row">
                        📞 <a href="tel:${w.klient}" style="color: #2980b9; text-decoration: underline;" onclick="event.stopPropagation()">${w.klient}</a>
                    </div>

                    ${adresHTML}
                    ${opisHTML}
                </div>

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

function przeniesDoDziennikaZwizyty(index) {
    const w = wizyty[index];
    if (!w) return;

    zmienZakladka('dziennik');

    document.getElementById('edit-index').value = "-1";
    document.getElementById('form-title').innerText = "Nowy wpis (z wizyty)";

    document.getElementById('data').value = w.data || wybranaData;
    document.getElementById('adres').value = w.adres || "";
    document.getElementById('przychod').value = "0,00";
    document.getElementById('koszt').value = "0,00";

    let opisTekst = "";
    if (w.klient) opisTekst += `Tel/Klient: ${w.klient}. `;
    if (w.opis) opisTekst += w.opis;
    document.getElementById('opis').innerHTML = opisTekst;

    pokazWidok('widok-formularza');
}

function kopiujWizyte(index) {
    const w = wizyty[index];
    if (!w) return;

    document.getElementById('edit-visit-index').value = "-1";
    document.getElementById('visit-form-title').innerText = "Kopiuj wizytę";

    document.getElementById('visit-type').value = w.typ || 'sluzbowy';
    document.getElementById('visit-all-day').checked = w.calyDzien || false;
    document.getElementById('container-godzina').style.display = w.calyDzien ? 'none' : 'block';
    document.getElementById('visit-time').value = w.godzina || "10:00";
    document.getElementById('visit-client').value = w.klient || "";
    document.getElementById('visit-address').value = w.adres || "";
    document.getElementById('visit-desc').value = w.opis || "";
    document.getElementById('visit-date').value = wybranaData || new Date().toISOString().split('T')[0];

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
    zapiszDoSyncthing();
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

function sformatujKwote(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return '0,00';

    const bezSpacji = raw.replace(/\s+/g, '');
    const ostatniaPrzecinek = bezSpacji.lastIndexOf(',');
    const ostatniaKropka = bezSpacji.lastIndexOf('.');

    let liczbaDoParsowania = bezSpacji;
    if (ostatniaPrzecinek !== -1 || ostatniaKropka !== -1) {
        const separator = ostatniaPrzecinek > ostatniaKropka ? ',' : '.';
        if (separator === ',') {
            liczbaDoParsowania = bezSpacji.replace(/\./g, '').replace(',', '.');
        } else {
            liczbaDoParsowania = bezSpacji.replace(/,/g, '');
        }
    }

    const parsed = Number(liczbaDoParsowania);
    if (!Number.isFinite(parsed)) return '0,00';

    return parsed.toFixed(2).replace('.', ',');
}

function zapiszWpis() {
    const editIndex = parseInt(document.getElementById('edit-index').value);
    const wpis = {
        data: document.getElementById('data').value,
        adres: document.getElementById('adres').value,
        przychod: sformatujKwote(document.getElementById('przychod').value),
        koszt: sformatujKwote(document.getElementById('koszt').value),
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
                indeksyDoUsuniecia.push(i);
            } catch (fileErr) {
                console.error(`Błąd przy eksporcie wpisu ${w.data}:`, fileErr);
            }
        }

        indeksyDoUsuniecia.sort((a, b) => b - a).forEach(idx => {
            wpisy.splice(idx, 1);
        });

        localStorage.setItem('ksiegowosc_wpisy', JSON.stringify(wpisy));
        renderujListe();

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

// --- LOGIKA NOTATEK (INDEXEDDB + ZDJĘCIA W ORYGINALNEJ ROZDZIELCZOŚCI) ---
const NOTATKI_DB_NAME = 'WebAsystentNotatkiDB';
const NOTATKI_DB_VERSION = 1;
const STORE_NOTATKI = 'notatki';
const STORE_NOTATKI_ZDJECIA = 'zdjecia';

let notatkiDB = null;
let roboczeZdjeciaFormularza = []; // { id?, name, type, size, blob, istniejeWDB }
let aktywneZdjeciaLightbox = [];   // { name, url }
let indeksZdjeciaLightbox = 0;

function initNotatkiDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(NOTATKI_DB_NAME, NOTATKI_DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NOTATKI)) {
                db.createObjectStore(STORE_NOTATKI, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_NOTATKI_ZDJECIA)) {
                const store = db.createObjectStore(STORE_NOTATKI_ZDJECIA, { keyPath: 'id', autoIncrement: true });
                store.createIndex('noteId', 'noteId', { unique: false });
            }
        };

        request.onsuccess = (event) => {
            notatkiDB = event.target.result;
            resolve(notatkiDB);
        };

        request.onerror = () => reject(request.error);
    });
}

function dbOperacja(storeName, mode, fn) {
    return new Promise((resolve, reject) => {
        const tx = notatkiDB.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function pobierzWszystkieZdjeciaZDB() {
    if (!notatkiDB) return [];
    return dbOperacja(STORE_NOTATKI_ZDJECIA, 'readonly', store => store.getAll());
}

function pobierzZdjeciaNotatkiZDB(noteId) {
    return new Promise((resolve, reject) => {
        const tx = notatkiDB.transaction(STORE_NOTATKI_ZDJECIA, 'readonly');
        const index = tx.objectStore(STORE_NOTATKI_ZDJECIA).index('noteId');
        const req = index.getAll(noteId);
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });
}

async function zaladujNotatkiZIndexedDB() {
    let zBazy = await dbOperacja(STORE_NOTATKI, 'readonly', store => store.getAll());

    // Jednorazowa migracja ze starszego localStorage['ksiegowosc_notatki']
    if (zBazy.length === 0) {
        const stareNotatki = JSON.parse(localStorage.getItem('ksiegowosc_notatki')) || [];
        if (stareNotatki.length > 0) {
            const bazaCzasu = Date.now();
            for (let i = 0; i < stareNotatki.length; i++) {
                const sn = stareNotatki[i];
                const rekord = {
                    id: sn.id || (bazaCzasu + i),
                    kolejnosc: i,
                    data: sn.data || new Date().toISOString().split('T')[0],
                    tytul: sn.tytul || 'Bez tytułu',
                    tresc: sn.tresc || ''
                };
                await dbOperacja(STORE_NOTATKI, 'readwrite', store => store.put(rekord));
            }
            zBazy = await dbOperacja(STORE_NOTATKI, 'readonly', store => store.getAll());
        }
    }

    const wszystkieZdjecia = await pobierzWszystkieZdjeciaZDB();
    const licznikZdjec = new Map();
    wszystkieZdjecia.forEach(z => {
        licznikZdjec.set(z.noteId, (licznikZdjec.get(z.noteId) || 0) + 1);
    });

    zBazy.sort((a, b) => (a.kolejnosc ?? 0) - (b.kolejnosc ?? 0));
    notatki = zBazy.map(n => ({
        ...n,
        liczbaZdjec: licznikZdjec.get(n.id) || 0
    }));
}

async function przywrocNotatkiIZdjeciaDoDB(listaNotatek, listaZdjec) {
    await dbOperacja(STORE_NOTATKI, 'readwrite', store => store.clear());
    await dbOperacja(STORE_NOTATKI_ZDJECIA, 'readwrite', store => store.clear());

    const mapaId = new Map();
    const bazaCzasu = Date.now();

    for (let i = 0; i < listaNotatek.length; i++) {
        const n = listaNotatek[i];
        const stareId = n.id;
        const noweId = stareId != null ? stareId : (bazaCzasu + i);
        if (stareId != null) mapaId.set(stareId, noweId);

        await dbOperacja(STORE_NOTATKI, 'readwrite', store => store.put({
            id: noweId,
            kolejnosc: i,
            data: n.data || new Date().toISOString().split('T')[0],
            tytul: n.tytul || 'Bez tytułu',
            tresc: n.tresc || ''
        }));
    }

    for (const z of listaZdjec) {
        const doceloweNoteId = mapaId.has(z.noteId) ? mapaId.get(z.noteId) : z.noteId;
        if (doceloweNoteId == null || !z.dataBase64) continue;

        const blob = base64NaBlob(z.dataBase64, z.type || 'image/jpeg');
        await dbOperacja(STORE_NOTATKI_ZDJECIA, 'readwrite', store => store.add({
            noteId: doceloweNoteId,
            name: z.name || 'zdjecie.jpg',
            type: z.type || blob.type || 'image/jpeg',
            size: blob.size,
            blob: blob
        }));
    }

    localStorage.setItem('ksiegowosc_notatki', JSON.stringify(listaNotatek.map(n => ({
        id: n.id,
        data: n.data,
        tytul: n.tytul,
        tresc: n.tresc
    }))));
}

function otworzFormularzNotatki() {
    roboczeZdjeciaFormularza = [];
    document.getElementById('edit-note-index').value = "-1";
    document.getElementById('note-form-title').innerText = "Nowa notatka";
    document.getElementById('note-title').value = "";
    document.getElementById('note-content').value = "";
    document.getElementById('note-photos-input').value = "";
    renderujRoboczeZdjeciaFormularza();
    pokazWidok('widok-formularza-notatki');
}

function zamknijFormularzNotatki() {
    roboczeZdjeciaFormularza = [];
    renderujRoboczeZdjeciaFormularza();
    pokazWidok('widok-notatek');
}

function dodajZdjeciaDoFormularza(event) {
    const pliki = Array.from(event.target.files || []);
    for (const plik of pliki) {
        if (!plik.type.startsWith('image/')) continue;
        // Zachowujemy oryginalny plik binarny bez zmiany rozdzielczości ani kompresji
        roboczeZdjeciaFormularza.push({
            name: plik.name || 'zdjecie.jpg',
            type: plik.type || 'image/jpeg',
            size: plik.size,
            blob: plik.slice(0, plik.size, plik.type),
            istniejeWDB: false
        });
    }
    event.target.value = "";
    renderujRoboczeZdjeciaFormularza();
}

function renderujRoboczeZdjeciaFormularza() {
    const kontener = document.getElementById('note-pending-photos');
    if (!kontener) return;

    if (roboczeZdjeciaFormularza.length === 0) {
        kontener.innerHTML = "";
        return;
    }

    kontener.innerHTML = roboczeZdjeciaFormularza.map((z, idx) => {
        const rozmiarMB = (z.size / (1024 * 1024)).toFixed(2);
        return `
            <div class="note-pending-item">
                <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    🖼️ ${escapeNoteHTML(z.name)} <small style="color:#64748b;">(${rozmiarMB} MB)</small>
                </span>
                <button type="button" class="note-pending-remove" onclick="usunRoboczeZdjecie(${idx})">✕</button>
            </div>
        `;
    }).join('');
}

function usunRoboczeZdjecie(index) {
    roboczeZdjeciaFormularza.splice(index, 1);
    renderujRoboczeZdjeciaFormularza();
}

async function zapiszNotatke() {
    const editIndex = parseInt(document.getElementById('edit-note-index').value, 10);
    const tytul = document.getElementById('note-title').value.trim();
    const tresc = document.getElementById('note-content').value.trim();

    if (!tresc && !tytul && roboczeZdjeciaFormularza.length === 0) {
        alert("Notatka nie może być pusta!");
        return;
    }

    let noteId;
    if (editIndex === -1) {
        noteId = Date.now();
        const nowaNotatka = {
            id: noteId,
            kolejnosc: 0,
            data: new Date().toISOString().split('T')[0],
            tytul: tytul || "Bez tytułu",
            tresc: tresc
        };
        notatki.unshift(nowaNotatka);
    } else {
        const edytowana = notatki[editIndex];
        noteId = edytowana.id || Date.now();
        notatki[editIndex] = {
            ...edytowana,
            id: noteId,
            data: edytowana.data || new Date().toISOString().split('T')[0],
            tytul: tytul || "Bez tytułu",
            tresc: tresc
        };
    }

    for (let i = 0; i < notatki.length; i++) {
        notatki[i].kolejnosc = i;
        await dbOperacja(STORE_NOTATKI, 'readwrite', store => store.put({
            id: notatki[i].id,
            kolejnosc: i,
            data: notatki[i].data,
            tytul: notatki[i].tytul,
            tresc: notatki[i].tresc
        }));
    }

    const obecneWDB = await pobierzZdjeciaNotatkiZDB(noteId);
    const zachowaneId = new Set(
        roboczeZdjeciaFormularza.filter(z => z.istniejeWDB && z.id != null).map(z => z.id)
    );

    for (const stare of obecneWDB) {
        if (!zachowaneId.has(stare.id)) {
            await dbOperacja(STORE_NOTATKI_ZDJECIA, 'readwrite', store => store.delete(stare.id));
        }
    }

    for (const nowe of roboczeZdjeciaFormularza) {
        if (!nowe.istniejeWDB && nowe.blob) {
            await dbOperacja(STORE_NOTATKI_ZDJECIA, 'readwrite', store => store.add({
                noteId: noteId,
                name: nowe.name,
                type: nowe.type,
                size: nowe.blob.size,
                blob: nowe.blob
            }));
        }
    }

    await zaladujNotatkiZIndexedDB();
    localStorage.setItem('ksiegowosc_notatki', JSON.stringify(notatki.map(n => ({
        id: n.id,
        data: n.data,
        tytul: n.tytul,
        tresc: n.tresc
    }))));

    roboczeZdjeciaFormularza = [];
    renderujNotatki();
    pokazWidok('widok-notatek');
    await zapiszDoSyncthing();
}

function renderujNotatki() {
    const kontener = document.getElementById('lista-notatek');
    kontener.innerHTML = "";
    if (notatki.length === 0) {
        kontener.innerHTML = "<p style='text-align:center; color: #777;'>Brak zapisanych notatek.</p>";
        return;
    }

    notatki.forEach((n, index) => {
        const przyciskZdjec = (n.liczbaZdjec && n.liczbaZdjec > 0)
            ? `<button class="btn-note-photos" onclick="otworzZdjeciaNotatki(${n.id})">📷 Zdjęcia (${n.liczbaZdjec})</button>`
            : '';

        kontener.innerHTML += `
            <div class="note-item">
                <div class="note-info">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <strong style="font-size: 1.05rem; color: #2c3e50;">${escapeNoteHTML(n.tytul)}</strong>
                        <small style="color: #888;">${escapeNoteHTML(n.data)}</small>
                    </div>
                    <p style="margin: 4px 0 8px 0; white-space: pre-wrap; font-size: 0.95rem;">${escapeNoteHTML(n.tresc)}</p>
                </div>
                <div class="event-actions" style="margin-top: 8px;">
                    ${przyciskZdjec}
                    <button class="btn-edit" onclick="edytujNotatke(${index})">Edytuj</button>
                    <button class="btn-delete" onclick="usunNotatke(${index})">Usuń</button>
                </div>
            </div>
        `;
    });
}

async function edytujNotatke(index) {
    const n = notatki[index];
    document.getElementById('note-title').value = n.tytul;
    document.getElementById('note-content').value = n.tresc;
    document.getElementById('edit-note-index').value = index;
    document.getElementById('note-form-title').innerText = "Edycja notatki";
    document.getElementById('note-photos-input').value = "";

    const zdjecia = await pobierzZdjeciaNotatkiZDB(n.id);
    roboczeZdjeciaFormularza = zdjecia.map(z => ({
        id: z.id,
        name: z.name,
        type: z.type,
        size: z.blob ? z.blob.size : (z.size || 0),
        blob: z.blob,
        istniejeWDB: true
    }));

    renderujRoboczeZdjeciaFormularza();
    pokazWidok('widok-formularza-notatki');
}

async function usunNotatke(index) {
    if (!confirm("Czy na pewno chcesz usunąć tę notatkę wraz ze zdjęciami?")) return;

    const usuwana = notatki[index];
    if (usuwana && usuwana.id != null) {
        const zdjecia = await pobierzZdjeciaNotatkiZDB(usuwana.id);
        for (const z of zdjecia) {
            await dbOperacja(STORE_NOTATKI_ZDJECIA, 'readwrite', store => store.delete(z.id));
        }
        await dbOperacja(STORE_NOTATKI, 'readwrite', store => store.delete(usuwana.id));
    }

    notatki.splice(index, 1);
    localStorage.setItem('ksiegowosc_notatki', JSON.stringify(notatki.map(n => ({
        id: n.id,
        data: n.data,
        tytul: n.tytul,
        tresc: n.tresc
    }))));

    renderujNotatki();
    await zapiszDoSyncthing();
}

// --- PEŁNOEKRANOWA PRZEGLĄDARKA ZDJĘĆ ---
async function otworzZdjeciaNotatki(noteId) {
    const zdjecia = await pobierzZdjeciaNotatkiZDB(noteId);
    if (!zdjecia || zdjecia.length === 0) return;

    zwolnijUrlZdjecLightbox();
    aktywneZdjeciaLightbox = zdjecia.map(z => ({
        name: z.name || 'zdjecie.jpg',
        url: URL.createObjectURL(z.blob)
    }));
    indeksZdjeciaLightbox = 0;

    odswiezWidokLightbox();
    document.getElementById('note-photo-lightbox').classList.add('active');
}

function przelaczZdjecieLightbox(kierunek) {
    const nowyIndeks = indeksZdjeciaLightbox + kierunek;
    if (nowyIndeks < 0 || nowyIndeks >= aktywneZdjeciaLightbox.length) return;
    indeksZdjeciaLightbox = nowyIndeks;
    odswiezWidokLightbox();
}

function odswiezWidokLightbox() {
    const biezece = aktywneZdjeciaLightbox[indeksZdjeciaLightbox];
    if (!biezece) return;

    document.getElementById('lightbox-img').src = biezece.url;
    document.getElementById('lightbox-counter').innerText = `${indeksZdjeciaLightbox + 1} / ${aktywneZdjeciaLightbox.length}`;
    document.getElementById('lightbox-filename').innerText = biezece.name;
    document.getElementById('lightbox-prev').disabled = indeksZdjeciaLightbox <= 0;
    document.getElementById('lightbox-next').disabled = indeksZdjeciaLightbox >= aktywneZdjeciaLightbox.length - 1;
}

function zamknijPodgladZdjec() {
    document.getElementById('note-photo-lightbox').classList.remove('active');
    document.getElementById('lightbox-img').src = "";
    zwolnijUrlZdjecLightbox();
    aktywneZdjeciaLightbox = [];
}

function zwolnijUrlZdjecLightbox() {
    for (const item of aktywneZdjeciaLightbox) {
        if (item.url) URL.revokeObjectURL(item.url);
    }
}

function inicjalizujGestyLightboxu() {
    const stage = document.getElementById('lightbox-stage');
    if (!stage) return;

    let lbStartX = 0;
    stage.addEventListener('touchstart', e => {
        if (e.touches.length === 1) {
            lbStartX = e.changedTouches[0].screenX;
        }
    }, { passive: true });

    stage.addEventListener('touchend', e => {
        if (e.changedTouches.length !== 1) return;
        const deltaX = e.changedTouches[0].screenX - lbStartX;
        if (deltaX < -60) przelaczZdjecieLightbox(1);
        if (deltaX > 60) przelaczZdjecieLightbox(-1);
    }, { passive: true });

    document.addEventListener('keydown', e => {
        const lb = document.getElementById('note-photo-lightbox');
        if (!lb || !lb.classList.contains('active')) return;
        if (e.key === 'Escape') zamknijPodgladZdjec();
        if (e.key === 'ArrowLeft') przelaczZdjecieLightbox(-1);
        if (e.key === 'ArrowRight') przelaczZdjecieLightbox(1);
    });
}

function blobNaBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const wynik = String(reader.result || '');
            const idx = wynik.indexOf(',');
            resolve(idx >= 0 ? wynik.slice(idx + 1) : wynik);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

function base64NaBlob(base64, mimeType) {
    const znakowo = atob(base64);
    const bajty = new Uint8Array(znakowo.length);
    for (let i = 0; i < znakowo.length; i++) {
        bajty[i] = znakowo.charCodeAt(i);
    }
    return new Blob([bajty], { type: mimeType });
}

function escapeNoteHTML(str) {
    return String(str ?? '').replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag]));
}

// --- SYNCHRONIZACJA Z SYNCTHING (FILE SYSTEM ACCESS API) ---
let syncthingDirHandle = null;

async function podlaczFolderSyncthing() {
    if (!('showDirectoryPicker' in window)) {
        alert("Twoja przeglądarka nie wspiera bezpośredniego dostępu do folderów. Używaj Chrome na Androidzie.");
        return;
    }

    try {
        syncthingDirHandle = await window.showDirectoryPicker();
        alert("✅ Folder Syncthing został pomyślnie podłączony! Od teraz dane będą zapisywane tam automatycznie.");
        await zapiszDoSyncthing();
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error("Błąd wyboru folderu:", err);
            alert("Nie udało się uzyskać dostępu do folderu.");
        }
    }
}

async function zapiszDoSyncthing() {
    if (!syncthingDirHandle) return;

    try {
        const options = { mode: 'readwrite' };
        if ((await syncthingDirHandle.queryPermission(options)) !== 'granted') {
            if ((await syncthingDirHandle.requestPermission(options)) !== 'granted') {
                return;
            }
        }

        const pelnaBaza = await zbudujPelnaBazeDoKopi();
        pelnaBaza.ostatniaModyfikacja = new Date().toISOString();

        const fileHandle = await syncthingDirHandle.getFileHandle("web_asystent_dane.json", { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(pelnaBaza, null, 2));
        await writable.close();

        console.log("🔄 Zsynchronizowano automatycznie (wraz ze zdjęciami) z folderem Syncthing.");
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