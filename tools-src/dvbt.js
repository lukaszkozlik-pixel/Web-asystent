let map, userMarker, headingMarker, targetMarker;
let currentLine = null;
let userCoords = null;
let currentHeading = 0;
let selectedTxId = null;
let otherTxExpanded = false;

let compassOffset = parseInt(localStorage.getItem('compass_offset') || '0', 10);
if (Number.isNaN(compassOffset)) compassOffset = 0;

const STORAGE_FAV_TX_KEY = 'dvbt_ulubione_tx';
const STORAGE_CUSTOM_TX_KEY = 'dvbt_wlasne_tx';

const defaultTransmitters = [
    { id: "katowice-kosztowy", name: "RTCN Katowice / Kosztowy", lat: 50.1878, lon: 19.1161, info: "UHF / VHF" },
    { id: "wisla-skrzyczne", name: "RTON Wisła / Skrzyczne", lat: 49.6844, lon: 19.0303, info: "UHF / VHF" },
    { id: "ostrava-hostalkovice", name: "Ostrava / Hostálkovice", lat: 49.8514, lon: 18.2111, info: "CZ DVB-T2" },
    { id: "rybnik-chwalowice", name: "Rybnik / Chwałowice", lat: 50.0658, lon: 18.5539, info: "Lokalny / L2" },
    { id: "krakow-choragwica", name: "RTCN Kraków / Chorągwica", lat: 50.0086, lon: 20.1381, info: "UHF / VHF" },
    { id: "czestochowa-wreczyca", name: "RTCN Częstochowa / Wręczyca", lat: 50.8850, lon: 18.8050, info: "UHF / VHF" },
    { id: "kielce-swiety-krzyz", name: "RTCN Kielce / Święty Krzyż", lat: 50.8781, lon: 21.0556, info: "UHF / VHF" },
    { id: "wroclaw-sleza", name: "RTCN Wrocław / Ślęża", lat: 50.8658, lon: 16.7089, info: "UHF / VHF" },
    { id: "klodzko-czarna-gora", name: "RTON Kłodzko / Czarna Góra", lat: 50.2519, lon: 16.8439, info: "UHF / VHF" }
];

const defaultFavoriteIds = [
    "katowice-kosztowy",
    "wisla-skrzyczne",
    "ostrava-hostalkovice",
    "rybnik-chwalowice"
];

let customTransmitters = JSON.parse(localStorage.getItem(STORAGE_CUSTOM_TX_KEY)) || [];
let favoriteTxIds = JSON.parse(localStorage.getItem(STORAGE_FAV_TX_KEY));
if (!Array.isArray(favoriteTxIds)) {
    favoriteTxIds = [...defaultFavoriteIds];
    localStorage.setItem(STORAGE_FAV_TX_KEY, JSON.stringify(favoriteTxIds));
}

const freqReferenceData = [
    { ch: 5,  mhz: "177.5", band: "VHF", mux: "" },
    { ch: 6,  mhz: "184.5", band: "VHF", mux: "MUX-8" },
    { ch: 7,  mhz: "191.5", band: "VHF", mux: "MUX-8" },
    { ch: 8,  mhz: "198.5", band: "VHF", mux: "" },
    { ch: 9,  mhz: "205.5", band: "VHF", mux: "" },
    { ch: 10, mhz: "212.5", band: "VHF", mux: "" },
    { ch: 11, mhz: "219.5", band: "VHF", mux: "" },
    { ch: 12, mhz: "226.5", band: "VHF", mux: "" },
    { ch: 21, mhz: "474",   band: "UHF", mux: "MUX-4" },
    { ch: 22, mhz: "482",   band: "UHF", mux: "MUX-3-KRAKÓW" },
    { ch: 23, mhz: "490",   band: "UHF", mux: "MUX-2" },
    { ch: 24, mhz: "498",   band: "UHF", mux: "MUX-6" },
    { ch: 25, mhz: "506",   band: "UHF", mux: "" },
    { ch: 26, mhz: "514",   band: "UHF", mux: "CZ-Mux21" },
    { ch: 27, mhz: "522",   band: "UHF", mux: "" },
    { ch: 28, mhz: "530",   band: "UHF", mux: "CZ-Mux22" },
    { ch: 29, mhz: "538",   band: "UHF", mux: "" },
    { ch: 30, mhz: "546",   band: "UHF", mux: "" },
    { ch: 31, mhz: "554",   band: "UHF", mux: "CZ-Mux23" },
    { ch: 32, mhz: "562",   band: "UHF", mux: "" },
    { ch: 33, mhz: "570",   band: "UHF", mux: "" },
    { ch: 34, mhz: "578",   band: "UHF", mux: "" },
    { ch: 35, mhz: "586",   band: "UHF", mux: "" },
    { ch: 36, mhz: "594",   band: "UHF", mux: "" },
    { ch: 37, mhz: "602",   band: "UHF", mux: "" },
    { ch: 38, mhz: "610",   band: "UHF", mux: "" },
    { ch: 39, mhz: "618",   band: "UHF", mux: "" },
    { ch: 40, mhz: "626",   band: "UHF", mux: "" },
    { ch: 41, mhz: "634",   band: "UHF", mux: "MUX-3" },
    { ch: 42, mhz: "642",   band: "UHF", mux: "" },
    { ch: 43, mhz: "650",   band: "UHF", mux: "" },
    { ch: 44, mhz: "658",   band: "UHF", mux: "" },
    { ch: 45, mhz: "666",   band: "UHF", mux: "MUX CZ-sląsk" },
    { ch: 46, mhz: "674",   band: "UHF", mux: "" },
    { ch: 47, mhz: "682",   band: "UHF", mux: "MUX-L2" },
    { ch: 48, mhz: "690",   band: "UHF", mux: "" }
];

document.addEventListener("DOMContentLoaded", () => {
    const range = document.getElementById('offsetRange');
    if (range) {
        range.value = compassOffset;
        document.getElementById('offset-val').innerText = compassOffset;
    }
    renderFreqTable(freqReferenceData);
    initMap();
    setupCompass();
    renderujCustomAccs();
});

function getAllTransmitters() {
    return [...defaultTransmitters, ...customTransmitters];
}

/* --- PRZEŁĄCZANIE ZAKŁADEK GŁÓWNYCH --- */
function switchDvbtTab(tabName, btn) {
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

/* --- TABELA CZĘSTOTLIWOŚCI VHF / UHF --- */
function renderFreqTable(rows) {
    const tbody = document.getElementById('freqReferenceBody');
    if (!tbody) return;

    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#777;">Brak pasujących kanałów.</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map(row => {
        const badgeClass = row.band === 'VHF' ? 'band-vhf' : 'band-uhf';
        return `
            <tr>
                <td class="ch-num">${row.ch}</td>
                <td>
                    <span class="freq-val">${row.mhz} MHz</span>
                    <div style="text-align:center;"><span class="band-badge ${badgeClass}">${row.band}</span></div>
                </td>
                <td><b>${row.mux || '—'}</b></td>
            </tr>
        `;
    }).join('');
}

function filterFreqTable() {
    const q = (document.getElementById('freqFilterInput').value || '').trim().toLowerCase();
    if (!q) {
        renderFreqTable(freqReferenceData);
        return;
    }
    const filtered = freqReferenceData.filter(r =>
        String(r.ch).includes(q) ||
        r.mhz.toLowerCase().includes(q) ||
        r.band.toLowerCase().includes(q) ||
        r.mux.toLowerCase().includes(q)
    );
    renderFreqTable(filtered);
}

/* --- MAPA, GPS I KOMPAS --- */
function initMap(lat, lon) {
    const startLat = lat || 50.25;
    const startLon = lon || 19.0;

    map = L.map('map', { zoomControl: false }).setView([startLat, startLon], 15);

    const streetMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    });

    const topoMap = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        attribution: '© OpenTopoMap'
    });

    const satMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Esri Satellite'
    });

    satMap.addTo(map);

    L.control.layers({
        "Satelita": satMap,
        "Topografia": topoMap,
        "Mapa": streetMap
    }, null, { position: 'topright' }).addTo(map);

    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(pos => {
            userCoords = [pos.coords.latitude, pos.coords.longitude];

            if (!userMarker) {
                map.setView(userCoords, 16);
                userMarker = L.circleMarker(userCoords, {
                    color: '#ffffff',
                    fillColor: '#1a73e8',
                    fillOpacity: 1,
                    weight: 3,
                    radius: 9
                }).addTo(map);

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

            if (selectedTxId) {
                const wybranyTx = getAllTransmitters().find(t => t.id === selectedTxId);
                if (wybranyTx) {
                    rysujLinieDoNadajnika(wybranyTx, false);
                }
            }

            renderList();
        }, err => {
            console.error("Błąd GPS:", err);
            document.getElementById("favorite-transmitter-list").innerHTML =
                `<div class="gps-placeholder" style="color:#d93025; font-weight:bold;">
                    ⚠️ Brak sygnału GPS (${err.message}).<br><small style="color:#666;">Włącz lokalizację w ustawieniach.</small>
                 </div>`;
        }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
    } else {
        renderList();
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

/* --- ULUBIONE, ROZWIJANA LISTA I FORMULARZ WŁASNEGO NADAJNIKA --- */
function przelaczPozostaleNadajniki() {
    otherTxExpanded = !otherTxExpanded;
    const drawer = document.getElementById('other-tx-drawer');
    const arrow = document.getElementById('other-tx-arrow');
    if (drawer) drawer.style.display = otherTxExpanded ? 'block' : 'none';
    if (arrow) arrow.innerText = otherTxExpanded ? '▲' : '▼';
}

function przelaczUlubiony(txId, event) {
    if (event) event.stopPropagation();
    const idx = favoriteTxIds.indexOf(txId);
    if (idx >= 0) {
        favoriteTxIds.splice(idx, 1);
    } else {
        favoriteTxIds.push(txId);
    }
    localStorage.setItem(STORAGE_FAV_TX_KEY, JSON.stringify(favoriteTxIds));
    renderList();
}

function otworzFormularzNadajnika() {
    document.getElementById('tx-name-input').value = "";
    document.getElementById('tx-lat-input').value = "";
    document.getElementById('tx-lon-input').value = "";
    document.getElementById('tx-info-input').value = "";
    document.getElementById('custom-tx-form').style.display = "block";
    document.getElementById('btn-toggle-tx-form').style.display = "none";
    document.getElementById('tx-name-input').focus();
}

function zamknijFormularzNadajnika() {
    document.getElementById('custom-tx-form').style.display = "none";
    document.getElementById('btn-toggle-tx-form').style.display = "inline-block";
}

function zapiszNowyNadajnik() {
    const name = document.getElementById('tx-name-input').value.trim();
    const latRaw = document.getElementById('tx-lat-input').value.trim().replace(',', '.');
    const lonRaw = document.getElementById('tx-lon-input').value.trim().replace(',', '.');
    const info = document.getElementById('tx-info-input').value.trim() || "Własny nadajnik";

    const lat = parseFloat(latRaw);
    const lon = parseFloat(lonRaw);

    if (!name) {
        alert("Podaj nazwę nadajnika!");
        return;
    }
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
        alert("Podaj poprawne współrzędne geograficzne (lat i lon).");
        return;
    }

    const newTx = {
        id: "custom-" + Date.now(),
        name,
        lat,
        lon,
        info
    };

    customTransmitters.push(newTx);
    localStorage.setItem(STORAGE_CUSTOM_TX_KEY, JSON.stringify(customTransmitters));

    if (!favoriteTxIds.includes(newTx.id)) {
        favoriteTxIds.push(newTx.id);
        localStorage.setItem(STORAGE_FAV_TX_KEY, JSON.stringify(favoriteTxIds));
    }

    zamknijFormularzNadajnika();
    renderList();
}

function zbudujKarteNadajnika(tx) {
    const isFav = favoriteTxIds.includes(tx.id);
    const isActive = selectedTxId === tx.id;
    const distText = typeof tx.dist === 'number' ? `${tx.dist.toFixed(1)} km` : "—";
    const bearText = typeof tx.bear === 'number' ? `${tx.bear}°` : "—";

    const card = document.createElement('div');
    card.className = `transmitter-card ${isActive ? 'active' : ''}`;
    card.onclick = () => wybierzNadajnik(tx.id);

    card.innerHTML = `
        <div class="tx-left">
            <button type="button"
                    class="btn-fav-star ${isFav ? 'is-fav' : ''}"
                    title="${isFav ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}"
                    onclick="przelaczUlubiony('${tx.id}', event)">${isFav ? '★' : '☆'}</button>
            <div style="min-width:0;">
                <div class="tx-name">${escapeHTML(tx.name)}</div>
                <div class="distance">Odległość: <b>${distText}</b></div>
                <div class="tx-meta">${escapeHTML(tx.info || '')}</div>
            </div>
        </div>
        <div class="azimuth-container">
            <div class="azimuth-val">${bearText}</div>
            <div style="font-size: 0.65rem; color: #888; text-transform: uppercase; font-weight: bold;">Azymut</div>
        </div>
    `;
    return card;
}

function renderList() {
    const favContainer = document.getElementById("favorite-transmitter-list");
    const otherContainer = document.getElementById("other-transmitter-list");
    const otherCountEl = document.getElementById("other-tx-count");
    if (!favContainer || !otherContainer) return;

    const all = getAllTransmitters().map(tx => {
        if (!userCoords) {
            return { ...tx, dist: null, bear: null };
        }
        return {
            ...tx,
            dist: calculateDistance(userCoords[0], userCoords[1], tx.lat, tx.lon),
            bear: calculateBearing(userCoords[0], userCoords[1], tx.lat, tx.lon)
        };
    });

    if (userCoords) {
        all.sort((a, b) => a.dist - b.dist);
    }

    const favorites = all.filter(tx => favoriteTxIds.includes(tx.id));
    const filterQ = (document.getElementById('otherTxFilterInput')?.value || '').trim().toLowerCase();
    const others = all.filter(tx => {
        if (favoriteTxIds.includes(tx.id)) return false;
        if (!filterQ) return true;
        return (
            tx.name.toLowerCase().includes(filterQ) ||
            (tx.info || '').toLowerCase().includes(filterQ)
        );
    });

    if (otherCountEl) {
        otherCountEl.innerText = String(all.filter(tx => !favoriteTxIds.includes(tx.id)).length);
    }

    favContainer.innerHTML = "";
    if (favorites.length === 0) {
        favContainer.innerHTML = `<div class="gps-placeholder">Brak ulubionych nadajników. Kliknij ☆ przy wybranym obiekcie lub dodaj własny.</div>`;
    } else {
        favorites.forEach(tx => favContainer.appendChild(zbudujKarteNadajnika(tx)));
    }

    otherContainer.innerHTML = "";
    if (others.length === 0) {
        otherContainer.innerHTML = `<div class="gps-placeholder" style="padding: 12px;">Brak pasujących nadajników.</div>`;
    } else {
        others.forEach(tx => otherContainer.appendChild(zbudujKarteNadajnika(tx)));
    }
}

function wybierzNadajnik(txId) {
    const tx = getAllTransmitters().find(t => t.id === txId);
    if (!tx) return;

    if (selectedTxId === txId) {
        wyczyscLinieNadajnika();
        selectedTxId = null;
        renderList();
        return;
    }

    selectedTxId = txId;
    renderList();
    rysujLinieDoNadajnika(tx, true);
}

function wyczyscLinieNadajnika() {
    if (currentLine && map) {
        map.removeLayer(currentLine);
        currentLine = null;
    }
    if (targetMarker && map) {
        map.removeLayer(targetMarker);
        targetMarker = null;
    }
}

function rysujLinieDoNadajnika(tx, dopasujWidok = true) {
    if (!map || !tx) return;

    wyczyscLinieNadajnika();

    const txCoords = [tx.lat, tx.lon];
    const targetIcon = L.divIcon({
        className: '',
        html: '<div class="tx-target-dot"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7]
    });

    targetMarker = L.marker(txCoords, { icon: targetIcon }).addTo(map);

    if (userCoords) {
        const dist = calculateDistance(userCoords[0], userCoords[1], tx.lat, tx.lon).toFixed(1);
        const bear = calculateBearing(userCoords[0], userCoords[1], tx.lat, tx.lon);

        currentLine = L.polyline([userCoords, txCoords], {
            color: '#d93025',
            weight: 4,
            dashArray: '8, 8'
        }).addTo(map);

        targetMarker.bindPopup(`<b>${escapeHTML(tx.name)}</b><br>Odległość: <b>${dist} km</b> · Azymut: <b>${bear}°</b>`);
        if (dopasujWidok) {
            targetMarker.openPopup();
            const bounds = L.latLngBounds([userCoords, txCoords]);
            map.fitBounds(bounds, { padding: [36, 36], maxZoom: 16 });
        }
    } else {
        targetMarker.bindPopup(`<b>${escapeHTML(tx.name)}</b><br><small>Brak pozycji GPS do wyznaczenia linii</small>`);
        if (dopasujWidok) {
            targetMarker.openPopup();
            map.setView(txCoords, 13, { animate: true });
        }
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateBearing(lat1, lon1, lat2, lon2) {
    const l1 = lat1 * Math.PI / 180;
    const l2 = lat2 * Math.PI / 180;
    const dl = (lon2 - lon1) * Math.PI / 180;
    const y = Math.sin(dl) * Math.cos(l2);
    const x = Math.cos(l1) * Math.sin(l2) - Math.sin(l1) * Math.cos(l2) * Math.cos(dl);
    return Math.round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360);
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

/* --- WŁASNE NOTATKI (AKORDEONY) --- */
const STORAGE_KEY = 'wlasne_acc_dvbt';
let customAccs = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

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