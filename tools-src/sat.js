let map, userMarker, headingMarker, currentLine;
let userCoords = null;
let currentHeading = 0;

let compassOffset = parseInt(localStorage.getItem('compass_offset') || '0', 10);
if (Number.isNaN(compassOffset)) compassOffset = 0;

const STORAGE_KEY = 'wlasne_acc_sat';
let customAccs = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

const satellites = [
    { name: "Hotbird 13°E", lon: 13.0, lat: 0.0 },
    { name: "Astra 19.2°E", lon: 19.2, lat: 0.0 },
    { name: "Astra 23.5°E", lon: 23.5, lat: 0.0 },
    { name: "Thor 0.8°W", lon: -0.8, lat: 0.0 },
    { name: "Hispasat 30°W", lon: -30.0, lat: 0.0 }
];

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
            if (s && !h.classList.contains('custom-note')) {
                s.innerText = '+';
            } else if (s && h.classList.contains('custom-note')) {
                s.innerText = '+';
            }
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

            displaySatellites();
        }, () => {
            document.getElementById('satList').innerHTML =
                "<p style='text-align:center; padding:20px; color:#d93025; font-weight:bold;'>Błąd GPS. Włącz lokalizację w telefonie.</p>";
        }, { enableHighAccuracy: true });
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

function displaySatellites() {
    const list = document.getElementById('satList');
    if (!list || !userCoords) return;
    list.innerHTML = "";

    satellites.forEach(sat => {
        const az = calculateAzimuth(userCoords[0], userCoords[1], sat.lon);
        const el = calculateElevation(userCoords[0], userCoords[1], sat.lon);

        const card = document.createElement('div');
        card.className = 'sat-card';
        card.innerHTML = `
            <div class="sat-info">
                <span class="sat-name">${sat.name}</span>
                <span class="sat-pos">Pozycja: ${sat.lon}°</span>
                <span class="sat-angles">Azymut: ${az}° | Elewacja: ${el}°</span>
            </div>
            <button class="btn-line" onclick="drawLine(${az}, this)">WYBIERZ</button>
        `;
        list.appendChild(card);
    });
}

function drawLine(az, btn) {
    if (!userCoords) return;

    document.querySelectorAll('.sat-card').forEach(c => c.classList.remove('active'));
    if (btn && btn.closest('.sat-card')) {
        btn.closest('.sat-card').classList.add('active');
    }

    if (currentLine) map.removeLayer(currentLine);

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

    map.setView(userCoords, 16, { animate: true });
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