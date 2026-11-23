let map, userMarker, headingMarker, currentLine;
let userCoords = null;
let currentHeading = 0;
let selectedSatId = null;
let otherSatExpanded = false;

let compassOffset = parseInt(localStorage.getItem('compass_offset') || '0', 10);
if (Number.isNaN(compassOffset)) compassOffset = 0;

const STORAGE_KEY = 'wlasne_acc_sat';
const STORAGE_FAV_SAT_KEY = 'sat_ulubione';
const STORAGE_CUSTOM_SAT_KEY = 'sat_wlasne';

let customAccs = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

const defaultSatellites = [
    { id: "hotbird-13e",   name: "Hotbird 13°E",   lon: 13.0,  lat: 0.0 },
    { id: "astra-19-2e",   name: "Astra 19.2°E",   lon: 19.2,  lat: 0.0 },
    { id: "astra-23-5e",   name: "Astra 23.5°E",   lon: 23.5,  lat: 0.0 },
    { id: "thor-0-8w",     name: "Thor 0.8°W",     lon: -0.8,  lat: 0.0 },
    { id: "hispasat-30w",  name: "Hispasat 30°W",  lon: -30.0, lat: 0.0 }
];

const defaultFavoriteSatIds = [
    "hotbird-13e",
    "astra-19-2e"
];

let customSatellites = JSON.parse(localStorage.getItem(STORAGE_CUSTOM_SAT_KEY)) || [];
let favoriteSatIds = JSON.parse(localStorage.getItem(STORAGE_FAV_SAT_KEY));
if (!Array.isArray(favoriteSatIds)) {
    favoriteSatIds = [...defaultFavoriteSatIds];
    localStorage.setItem(STORAGE_FAV_SAT_KEY, JSON.stringify(favoriteSatIds));
}

const unicableData = [
    { ub: "UB 1",  pb: 1210, std: 1210, diff: false },
    { ub: "UB 2",  pb: 1420, std: 1420, diff: false },
    { ub: "UB 3",  pb: 1680, std: 1680, diff: false },
    { ub: "UB 4",  pb: 2040, std: 2040, diff: false },
    { ub: "UB 5",  pb: 978,  std: 975,  diff: true },
    { ub: "UB 6",  pb: 1028, std: 1025, diff: true },
    { ub: "UB 7",  pb: 1072, std: 1075, diff: true },
    { ub: "UB 8",  pb: 1116, std: 1125, diff: true },
    { ub: "UB 9",  pb: 1160, std: 1175, diff: true },
    { ub: "UB 10", pb: 1271, std: 1225, diff: true },
    { ub: "UB 11", pb: 1315, std: 1275, diff: true },
    { ub: "UB 12", pb: 1359, std: 1325, diff: true },
    { ub: "UB 13", pb: 1484, std: 1375, diff: true },
    { ub: "UB 14", pb: 1528, std: 1475, diff: true },
    { ub: "UB 15", pb: 1572, std: 1525, diff: true },
    { ub: "UB 16", pb: 1616, std: 1575, diff: true },
    { ub: "UB 17", pb: 2084, std: 1625, diff: true },
    { ub: "UB 18", pb: 2128, std: 1675, diff: true },
    { ub: "UB 19", pb: 1816, std: 1725, diff: true },
    { ub: "UB 20", pb: 1860, std: 1775, diff: true },
    { ub: "UB 21", pb: 1904, std: 1825, diff: true },
    { ub: "UB 22", pb: 1948, std: 1875, diff: true },
    { ub: "UB 23", pb: 1992, std: 1925, diff: true },
    { ub: "UB 24", pb: 1728, std: 1975, diff: true }
];

document.addEventListener("DOMContentLoaded", () => {
    const range = document.getElementById('offsetRange');
    if (range) {
        range.value = compassOffset;
        document.getElementById('offset-val').innerText = compassOffset;
    }
    renderUnicableTable(unicableData);
    renderujCustomAccs();
    initMap();
    setupCompass();
});

function getAllSatellites() {
    return [...defaultSatellites, ...customSatellites];
}

/* --- ZAKŁADKI --- */
function switchSatTab(tabName, btn) {
    const targetPanel = document.getElementById('tab-' + tabName);
    if (!targetPanel) return;

    document.querySelectorAll('.main-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));

    if (btn) btn.classList.add('active');
    targetPanel.classList.add('active');

    if (tabName === 'map' && map) {
        setTimeout(() => map.invalidateSize(), 150);
    }
}

/* --- AKORDEONY WIEDZY --- */
function toggleAcc(header) {
    const content = header.nextElementSibling;
    if (!content || !content.classList.contains('acc-content')) return;
    const span = header.querySelector('span');
    const isOpening = !content.classList.contains('show');

    document.querySelectorAll('#tab-kb .acc-header').forEach(h => {
        const c = h.nextElementSibling;
        const s = h.querySelector('span');
        if (c && c.classList.contains('acc-content')) {
            c.classList.remove('show');
            if (s) s.innerText = '+';
        }
    });

    if (isOpening) {
        content.classList.add('show');
        if (span) span.innerText = '−';
    }
}

/* --- TABELA UNICABLE --- */
function renderUnicableTable(rows) {
    const tbody = document.getElementById('unicableTableBody');
    if (!tbody) return;

    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#777;">Brak pasujących pozycji UB.</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map(r => `
        <tr>
            <td class="ub-col">${r.ub}</td>
            <td class="pb-col">${r.pb}</td>
            <td class="${r.diff ? 'diff' : ''}">${r.std}</td>
        </tr>
    `).join('');
}

function filterUnicableTable() {
    const q = (document.getElementById('ubFilterInput').value || '').trim().toLowerCase();
    if (!q) {
        renderUnicableTable(unicableData);
        return;
    }
    const filtered = unicableData.filter(r =>
        r.ub.toLowerCase().includes(q) ||
        String(r.pb).includes(q) ||
        String(r.std).includes(q)
    );
    renderUnicableTable(filtered);
}

/* --- MAPA, GPS I KOMPAS --- */
function initMap() {
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    });

    const topoMap = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        attribution: '© OpenTopoMap'
    });

    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Esri Satellite'
    });

    map = L.map('map', {
        center: [52.23, 21.01],
        zoom: 6,
        layers: [satellite],
        zoomControl: false
    });

    L.control.layers({
        "Satelita": satellite,
        "Topografia": topoMap,
        "Mapa": osm
    }, null, { position: 'topright' }).addTo(map);

    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(position => {
            userCoords = [position.coords.latitude, position.coords.longitude];

            if (!userMarker) {
                map.setView(userCoords, 16);
                userMarker = L.circleMarker(userCoords, {
                    color: '#ffffff',
                    fillColor: '#004ba0',
                    fillOpacity: 1,
                    weight: 3,
                    radius: 9
                }).addTo(map).bindPopup("Twoja pozycja");

                const headingIcon = L.divIcon({
                    className: 'phone-heading-wrapper',
                    html: '<div class="phone-heading" id="phone-arrow"></div>',
                    iconSize: [3, 150],
                    iconAnchor: [1.5, 50]
                });
                headingMarker = L.marker(userCoords, { icon: headingIcon }).addTo(map);
            } else {
                userMarker.setLatLng(userCoords);
                headingMarker.setLatLng(userCoords);
            }

            if (selectedSatId) {
                const wybranySat = getAllSatellites().find(s => s.id === selectedSatId);
                if (wybranySat) {
                    const az = calculateAzimuth(userCoords[0], userCoords[1], wybranySat.lon);
                    const el = calculateElevation(userCoords[0], userCoords[1], wybranySat.lon);
                    rysujLinieKierunku(wybranySat, az, el, false);
                }
            }

            displaySatellites();
        }, () => {
            document.getElementById('favorite-sat-list').innerHTML =
                "<div class='gps-placeholder' style='color:#d93025; font-weight:bold;'>Błąd GPS. Włącz lokalizację w telefonie.</div>";
        }, { enableHighAccuracy: true });
    } else {
        displaySatellites();
    }
}

function setupCompass() {
    if (window.DeviceOrientationEvent) {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            document.getElementById('compass-btn').style.display = 'block';
        } else {
            window.addEventListener('deviceorientationabsolute', handleOrientation, true);
            window.addEventListener('deviceorientation', handleOrientation, true);
        }
    }
}

function initCompass() {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().then(response => {
            if (response === 'granted') {
                window.addEventListener('deviceorientation', handleOrientation, true);
                document.getElementById('compass-btn').style.display = 'none';
            }
        }).catch(console.error);
    }
}

function zmienOffset(val) {
    compassOffset = parseInt(val, 10) || 0;
    document.getElementById('offset-val').innerText = compassOffset;
    localStorage.setItem('compass_offset', compassOffset);
}

function resetOffset() {
    compassOffset = 0;
    const range = document.getElementById('offsetRange');
    if (range) range.value = 0;
    document.getElementById('offset-val').innerText = '0';
    localStorage.setItem('compass_offset', '0');
}

function handleOrientation(e) {
    let heading = e.webkitCompassHeading || e.alpha;
    if (heading !== null && heading !== undefined) {
        if (!e.webkitCompassHeading && e.alpha) {
            heading = 360 - e.alpha;
        }

        heading = (heading + compassOffset + 360) % 360;

        let diff = heading - currentHeading;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;

        currentHeading += diff * 0.25;
        currentHeading = (currentHeading + 360) % 360;

        const arrow = document.getElementById('phone-arrow');
        if (arrow) {
            arrow.style.transform = `rotate(${currentHeading}deg)`;
        }
    }
}

function wycentrujMape() {
    if (userCoords && map) {
        map.setView(userCoords, 16, { animate: true });
    }
}

/* --- ULUBIONE, ROZWIJANA LISTA I FORMULARZ WŁASNEGO SATELITY --- */
function przelaczPozostaleSatelity() {
    otherSatExpanded = !otherSatExpanded;
    const drawer = document.getElementById('other-sat-drawer');
    const arrow = document.getElementById('other-sat-arrow');
    if (drawer) drawer.style.display = otherSatExpanded ? 'block' : 'none';
    if (arrow) arrow.innerText = otherSatExpanded ? '▲' : '▼';
}

function przelaczUlubionySat(satId, event) {
    if (event) event.stopPropagation();
    const idx = favoriteSatIds.indexOf(satId);
    if (idx >= 0) {
        favoriteSatIds.splice(idx, 1);
    } else {
        favoriteSatIds.push(satId);
    }
    localStorage.setItem(STORAGE_FAV_SAT_KEY, JSON.stringify(favoriteSatIds));
    displaySatellites();
}

function otworzFormularzSatelity() {
    document.getElementById('sat-name-input').value = "";
    document.getElementById('sat-lon-input').value = "";
    document.getElementById('custom-sat-form').style.display = "block";
    document.getElementById('btn-toggle-sat-form').style.display = "none";
    document.getElementById('sat-name-input').focus();
}

function zamknijFormularzSatelity() {
    document.getElementById('custom-sat-form').style.display = "none";
    document.getElementById('btn-toggle-sat-form').style.display = "inline-block";
}

function formatujPozycjeOrbitalna(lon) {
    const absVal = Math.abs(lon);
    const kierunek = lon >= 0 ? '°E' : '°W';
    return `${absVal}${kierunek}`;
}

function zapiszNowegoSatelite() {
    const name = document.getElementById('sat-name-input').value.trim();
    const lonRaw = document.getElementById('sat-lon-input').value.trim().replace(',', '.');
    const lon = parseFloat(lonRaw);

    if (!name) {
        alert("Podaj nazwę satelity!");
        return;
    }
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
        alert("Podaj poprawną długość orbitalną (od -180 do 180).");
        return;
    }

    const newSat = {
        id: "custom-sat-" + Date.now(),
        name,
        lon,
        lat: 0.0
    };

    customSatellites.push(newSat);
    localStorage.setItem(STORAGE_CUSTOM_SAT_KEY, JSON.stringify(customSatellites));

    if (!favoriteSatIds.includes(newSat.id)) {
        favoriteSatIds.push(newSat.id);
        localStorage.setItem(STORAGE_FAV_SAT_KEY, JSON.stringify(favoriteSatIds));
    }

    zamknijFormularzSatelity();
    displaySatellites();
}

function zbudujKarteSatelity(sat) {
    const isFav = favoriteSatIds.includes(sat.id);
    const isActive = selectedSatId === sat.id;
    const az = userCoords ? `${calculateAzimuth(userCoords[0], userCoords[1], sat.lon)}°` : "—";
    const el = userCoords ? `${calculateElevation(userCoords[0], userCoords[1], sat.lon)}°` : "—";
    const posLabel = formatujPozycjeOrbitalna(sat.lon);

    const card = document.createElement('div');
    card.className = `sat-card ${isActive ? 'active' : ''}`;
    card.innerHTML = `
        <div class="sat-left">
            <button type="button"
                    class="btn-fav-star ${isFav ? 'is-fav' : ''}"
                    title="${isFav ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}"
                    onclick="przelaczUlubionySat('${sat.id}', event)">${isFav ? '★' : '☆'}</button>
            <div class="sat-info">
                <span class="sat-name">${escapeHTML(sat.name)}</span>
                <span class="sat-pos">Pozycja: ${escapeHTML(posLabel)}</span>
                <span class="sat-angles">Azymut: ${az} | Elewacja: ${el}</span>
            </div>
        </div>
        <button type="button" class="btn-line" onclick="wybierzSatelite('${sat.id}')">${isActive ? 'WYBRANY' : 'WYBIERZ'}</button>
    `;
    return card;
}

function displaySatellites() {
    const favContainer = document.getElementById('favorite-sat-list');
    const otherContainer = document.getElementById('other-sat-list');
    const otherCountEl = document.getElementById('other-sat-count');
    if (!favContainer || !otherContainer) return;

    const all = getAllSatellites();
    const favorites = all.filter(s => favoriteSatIds.includes(s.id));
    const filterQ = (document.getElementById('otherSatFilterInput')?.value || '').trim().toLowerCase();

    const others = all.filter(s => {
        if (favoriteSatIds.includes(s.id)) return false;
        if (!filterQ) return true;
        return (
            s.name.toLowerCase().includes(filterQ) ||
            formatujPozycjeOrbitalna(s.lon).toLowerCase().includes(filterQ)
        );
    });

    if (otherCountEl) {
        otherCountEl.innerText = String(all.filter(s => !favoriteSatIds.includes(s.id)).length);
    }

    favContainer.innerHTML = "";
    if (favorites.length === 0) {
        favContainer.innerHTML = `<div class="gps-placeholder">Brak ulubionych satelitów. Kliknij ☆ przy wybranej pozycji lub dodaj własną.</div>`;
    } else {
        favorites.forEach(sat => favContainer.appendChild(zbudujKarteSatelity(sat)));
    }

    otherContainer.innerHTML = "";
    if (others.length === 0) {
        otherContainer.innerHTML = `<div class="gps-placeholder" style="padding: 12px;">Brak pasujących satelitów.</div>`;
    } else {
        others.forEach(sat => otherContainer.appendChild(zbudujKarteSatelity(sat)));
    }
}

function wybierzSatelite(satId) {
    const sat = getAllSatellites().find(s => s.id === satId);
    if (!sat || !userCoords) return;

    if (selectedSatId === satId) {
        if (currentLine && map) {
            map.removeLayer(currentLine);
            currentLine = null;
        }
        selectedSatId = null;
        displaySatellites();
        return;
    }

    selectedSatId = satId;
    displaySatellites();

    const az = calculateAzimuth(userCoords[0], userCoords[1], sat.lon);
    const el = calculateElevation(userCoords[0], userCoords[1], sat.lon);
    rysujLinieKierunku(sat, az, el, true);
}

function rysujLinieKierunku(sat, az, el, wycentruj = true) {
    if (!userCoords || !map) return;

    if (currentLine) {
        map.removeLayer(currentLine);
        currentLine = null;
    }

    const R = 6371;
    const lat1 = userCoords[0] * Math.PI / 180;
    const lon1 = userCoords[1] * Math.PI / 180;
    const brng = az * Math.PI / 180;

    const dR = 5.0 / R;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dR) + Math.cos(lat1) * Math.sin(dR) * Math.cos(brng));
    const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(dR) * Math.cos(lat1), Math.cos(dR) - Math.sin(lat1) * Math.sin(lat2));

    const endPoint = [lat2 * 180 / Math.PI, lon2 * 180 / Math.PI];

    currentLine = L.polyline([userCoords, endPoint], {
        color: '#00c853',
        weight: 5,
        dashArray: '8, 8'
    }).addTo(map);

    currentLine.bindPopup(`<b>${escapeHTML(sat.name)}</b><br>Azymut: <b>${az}°</b> · Elewacja: <b>${el}°</b>`);
    if (wycentruj) {
        currentLine.openPopup();
        map.setView(userCoords, 16, { animate: true });
    }
}

function calculateAzimuth(lat, lon, satLon) {
    const phi = lat * Math.PI / 180;
    const dL = (lon - satLon) * Math.PI / 180;
    const az = Math.PI + Math.atan2(Math.tan(dL), Math.sin(phi));
    return Math.round((az * 180 / Math.PI) % 360);
}

function calculateElevation(lat, lon, satLon) {
    const phi = lat * Math.PI / 180;
    const dL = (lon - satLon) * Math.PI / 180;
    const R = 6371;
    const r = 42164;
    const num = Math.cos(phi) * Math.cos(dL) - (R / r);
    const den = Math.sqrt(1 - Math.pow(Math.cos(phi) * Math.cos(dL), 2));
    const el = Math.atan2(num, den);
    return Math.round(el * 180 / Math.PI);
}

function toggleFullscreen() {
    const mapElement = document.getElementById('map');
    if (!document.fullscreenElement) {
        if (mapElement.requestFullscreen) mapElement.requestFullscreen();
        else if (mapElement.webkitRequestFullscreen) mapElement.webkitRequestFullscreen();
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
}

/* --- WŁASNE NOTATKI SAT --- */
function renderujCustomAccs() {
    const list = document.getElementById('custom-accordions-list');
    if (!list) return;
    list.innerHTML = "";

    customAccs.forEach((item, index) => {
        list.innerHTML += `
            <div class="accordion">
                <div class="acc-header custom-note" onclick="toggleAcc(this)">
                    <span>📝 ${escapeHTML(item.tytul)}</span>
                    <span>+</span>
                </div>
                <div class="acc-content">
                    <div class="custom-note-body">${escapeHTML(item.tresc)}</div>
                    <div class="custom-note-actions">
                        <button type="button" style="background:#f39c12; color:white;" onclick="edytujCustomAcc(${index})">✏️ Edytuj</button>
                        <button type="button" style="background:#e74c3c; color:white;" onclick="usunCustomAcc(${index})">🗑️ Usuń</button>
                    </div>
                </div>
            </div>
        `;
    });
}

function otworzFormularzAcc() {
    document.getElementById('edit-acc-index').value = "-1";
    document.getElementById('form-acc-title').innerText = "Nowa notatka";
    document.getElementById('acc-title-input').value = "";
    document.getElementById('acc-body-input').value = "";
    document.getElementById('custom-acc-form').style.display = "block";
    document.getElementById('btn-show-form').style.display = "none";
    document.getElementById('acc-title-input').focus();
}

function zamknijFormularzAcc() {
    document.getElementById('custom-acc-form').style.display = "none";
    document.getElementById('btn-show-form').style.display = "block";
}

function zapiszCustomAcc() {
    const idx = parseInt(document.getElementById('edit-acc-index').value, 10);
    const tytul = document.getElementById('acc-title-input').value.trim();
    const tresc = document.getElementById('acc-body-input').value.trim();

    if (!tytul) {
        alert("Podaj tytuł notatki!");
        return;
    }

    if (idx === -1) {
        customAccs.push({ tytul, tresc });
    } else {
        customAccs[idx] = { tytul, tresc };
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(customAccs));
    renderujCustomAccs();
    zamknijFormularzAcc();
}

function edytujCustomAcc(index) {
    const item = customAccs[index];
    if (!item) return;
    document.getElementById('edit-acc-index').value = index;
    document.getElementById('form-acc-title').innerText = "Edytuj notatkę";
    document.getElementById('acc-title-input').value = item.tytul;
    document.getElementById('acc-body-input').value = item.tresc;
    document.getElementById('custom-acc-form').style.display = "block";
    document.getElementById('btn-show-form').style.display = "none";
    document.getElementById('custom-acc-form').scrollIntoView({ behavior: 'smooth' });
}

function usunCustomAcc(index) {
    if (!customAccs[index]) return;
    if (confirm(`Usunąć notatkę „${customAccs[index].tytul}”?`)) {
        customAccs.splice(index, 1);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(customAccs));
        renderujCustomAccs();
    }
}

function escapeHTML(str) {
    return String(str).replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag]));
}

document.addEventListener("fullscreenchange", () => {
    setTimeout(() => { if (map) map.invalidateSize(); }, 200);
});
document.addEventListener("webkitfullscreenchange", () => {
    setTimeout(() => { if (map) map.invalidateSize(); }, 200);
});