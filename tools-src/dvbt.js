let map, userMarker, headingMarker;
let currentLine = null;
let userCoords = null;
let currentHeading = 0;

let compassOffset = parseInt(localStorage.getItem('compass_offset') || '0', 10);
if (Number.isNaN(compassOffset)) compassOffset = 0;

const transmitters = [
    { name: "RTCN Katowice / Kosztowy", lat: 50.1878, lon: 19.1161, info: "UHF / VHF" },
    { name: "RTON Wisła / Skrzyczne", lat: 49.6844, lon: 19.0303, info: "UHF / VHF" },
    { name: "Ostrava / Hostálkovice", lat: 49.8514, lon: 18.2111, info: "CZ DVB-T2" },
    { name: "Rybnik / Chwałowice", lat: 50.0658, lon: 18.5539, info: "Lokalny / L2" }
];

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
            renderList();
        }, err => {
            console.error("Błąd GPS:", err);
            document.getElementById("transmitter-list").innerHTML =
                `<div style="padding:20px; text-align:center; color:#d93025; font-weight:bold;">
                    ⚠️ Brak sygnału GPS (${err.message}).<br><small style="color:#666;">Włącz lokalizację w ustawieniach.</small>
                 </div>`;
        }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
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

function renderList() {
    const list = document.getElementById("transmitter-list");
    if (!userCoords) return;

    list.innerHTML = "";

    const results = transmitters.map(tx => ({
        ...tx,
        dist: calculateDistance(userCoords[0], userCoords[1], tx.lat, tx.lon),
        bear: calculateBearing(userCoords[0], userCoords[1], tx.lat, tx.lon)
    })).sort((a, b) => a.dist - b.dist);

    results.forEach(tx => {
        const card = document.createElement('div');
        card.className = 'transmitter-card';
        card.onclick = function() { drawLine(tx, this); };

        card.innerHTML = `
            <div>
                <div class="tx-name">${tx.name}</div>
                <div class="distance">Odległość: <b>${tx.dist.toFixed(1)} km</b></div>
                <div class="tx-meta">${tx.info}</div>
            </div>
            <div class="azimuth-container">
                <div class="azimuth-val">${tx.bear}°</div>
                <div style="font-size: 0.65rem; color: #888; text-transform: uppercase; font-weight: bold;">Azymut</div>
            </div>
        `;
        list.appendChild(card);
    });
}

function drawLine(tx, card) {
    if (!userCoords) return;

    document.querySelectorAll('.transmitter-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');

    if (currentLine) map.removeLayer(currentLine);

    const R = 6371;
    const lat1 = userCoords[0] * Math.PI / 180;
    const lon1 = userCoords[1] * Math.PI / 180;
    const brng = calculateBearing(userCoords[0], userCoords[1], tx.lat, tx.lon) * Math.PI / 180;

    const dR = 5.0 / R;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dR) + Math.cos(lat1) * Math.sin(dR) * Math.cos(brng));
    const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(dR) * Math.cos(lat1), Math.cos(dR) - Math.sin(lat1) * Math.sin(lat2));

    const endPoint = [lat2 * 180 / Math.PI, lon2 * 180 / Math.PI];

    currentLine = L.polyline([userCoords, endPoint], {
        color: '#d93025',
        weight: 5,
        dashArray: '8, 8'
    }).addTo(map);

    map.setView(userCoords, 16, { animate: true });
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
                        <button style="background:#f39c12; color:white;" onclick="edytujCustomAcc(${index})">✏️ Edytuj</button>
                        <button style="background:#e74c3c; color:white;" onclick="usunCustomAcc(${index})">🗑️ Usuń</button>
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

