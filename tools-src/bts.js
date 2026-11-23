let map, userMarker, headingMarker, targetMarker;
let btsMarkersLayer = null;
let currentLine = null;
let userCoords = null;
let currentHeading = 0;
let selectedBtsId = null;
let selectedOperator = "ALL";
let maxDistanceKm = 10;

let compassOffset = parseInt(localStorage.getItem('compass_offset') || '0', 10);
if (Number.isNaN(compassOffset)) compassOffset = 0;

const STORAGE_BTS_JSON_KEY = 'bts_wlasna_baza_json';

const OPERATOR_COLORS = {
    "Orange": "#f97316",
    "T-Mobile": "#e20074",
    "Play": "#7c3aed",
    "Plus": "#16a34a",
    "Inny": "#475569"
};

function ustawLimitKm(km, btn) {
    maxDistanceKm = km === 'ALL' ? null : Number(km);
    document.querySelectorAll('.rad-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderBtsList();
    renderBtsMarkers();
}

function getOperatorColor(op) {
    return OPERATOR_COLORS[op] || OPERATOR_COLORS["Inny"];
}

function getStationColor(operators) {
    if (!Array.isArray(operators) || operators.length === 0) return OPERATOR_COLORS["Inny"];
    if (operators.length === 1) return getOperatorColor(operators[0]);
    return "#1e293b"; // wiele operatorów na jednym obiekcie
}

function getStationBorderGradient(operators) {
    if (!Array.isArray(operators) || operators.length === 0) return OPERATOR_COLORS["Inny"];
    if (operators.length === 1) return getOperatorColor(operators[0]);
    const colors = operators.map(getOperatorColor);
    const step = 100 / colors.length;
    const stops = colors.map((c, idx) => `${c} ${(idx * step).toFixed(1)}% ${((idx + 1) * step).toFixed(1)}%`);
    return `linear-gradient(180deg, ${stops.join(', ')})`;
}

// Przykładowa baza startowa (w tym wspólny maszt kilku operatorów)
const sampleBtsStations = [
    { id: "bts-1", operators: ["Orange", "T-Mobile"], name: "Katowice, ul. Mikołowska 100", lat: 50.2512, lon: 19.0045, bands: "LTE 800/1800/2100/2600, 5G 2100" },
    { id: "bts-2", operators: ["Play"],               name: "Katowice, ul. Chorzowska 50",  lat: 50.2645, lon: 19.0018, bands: "LTE 800/1800/2100/2600, 5G 2100" },
    { id: "bts-3", operators: ["Plus"],               name: "Mikołów, ul. Katowicka 25",    lat: 50.1782, lon: 18.9094, bands: "LTE 900/1800/2600, 5G 2600" },
    { id: "bts-4", operators: ["T-Mobile"],           name: "Tychy, al. Bielska 80",        lat: 50.1185, lon: 18.9962, bands: "LTE 800/1800/2100, 5G 2100/3500" },
    { id: "bts-5", operators: ["Orange"],             name: "Żory, ul. Pszczyńska 110",     lat: 50.0361, lon: 18.7042, bands: "LTE 800/1800/2100, 5G 2100" }
];

let btsStations = [...sampleBtsStations];

document.addEventListener("DOMContentLoaded", async () => {
    const range = document.getElementById('offsetRange');
    if (range) {
        range.value = compassOffset;
        document.getElementById('offset-val').innerText = compassOffset;
    }

    await zaladujBazeBts();
    initMap();
    setupCompass();
    renderBtsList();
    renderBtsMarkers();
});

async function zaladujBazeBts() {
    try {
        const res = await fetch('./bts.json', { cache: 'no-store' });
        if (res.ok) {
            const dane = await res.json();
            const znormalizowane = normalizujDaneBts(dane);
            if (znormalizowane.length > 0) {
                btsStations = znormalizowane;
                ustawOpisZrodla(`📡 Baza z pliku bts.json (${btsStations.length})`);
                return;
            }
        }
    } catch (_) {}

    try {
        const zapisane = localStorage.getItem(STORAGE_BTS_JSON_KEY);
        if (zapisane) {
            const znormalizowane = normalizujDaneBts(JSON.parse(zapisane));
            if (znormalizowane.length > 0) {
                btsStations = znormalizowane;
                ustawOpisZrodla(`📡 Wczytana baza BTS (${btsStations.length})`);
                return;
            }
        }
    } catch (_) {}

    btsStations = [...sampleBtsStations];
    ustawOpisZrodla(`📡 Przykładowa baza BTS (${btsStations.length})`);
}

function ustawOpisZrodla(tekst) {
    const el = document.getElementById('bts-source-label');
    if (el) el.innerText = tekst;
}

function normalizujDaneBts(raw) {
    const tablica = Array.isArray(raw) ? raw : (Array.isArray(raw?.stations) ? raw.stations : []);
    const mapBySite = new Map();

    tablica.forEach((item, idx) => {
        const lat = parseFloat(String(item.lat ?? '').replace(',', '.'));
        const lon = parseFloat(String(item.lon ?? '').replace(',', '.'));
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

        const rawOps = Array.isArray(item.operators)
            ? item.operators
            : (item.operator ? String(item.operator).split(/[,/&+]+/) : ['Inny']);

        const ops = rawOps
            .map(o => String(o || '').trim())
            .filter(Boolean);

        const name = String(item.name || item.address || 'Stacja BTS').trim();
        const bands = String(item.bands || item.tech || '').trim();
        const siteKey = `${lat.toFixed(5)}|${lon.toFixed(5)}|${name.toLowerCase()}`;

        if (!mapBySite.has(siteKey)) {
            mapBySite.set(siteKey, {
                id: String(item.id || `bts-${idx}-${lat.toFixed(4)}-${lon.toFixed(4)}`),
                operators: [],
                name,
                lat,
                lon,
                bandsSet: new Set()
            });
        }

        const entry = mapBySite.get(siteKey);
        ops.forEach(op => {
            if (!entry.operators.includes(op)) entry.operators.push(op);
        });
        if (bands) {
            bands.split(',').map(b => b.trim()).filter(Boolean).forEach(b => entry.bandsSet.add(b));
        }
    });

    return Array.from(mapBySite.values()).map(e => ({
        id: e.id,
        operators: e.operators.length > 0 ? e.operators : ['Inny'],
        name: e.name,
        lat: e.lat,
        lon: e.lon,
        bands: Array.from(e.bandsSet).join(', ')
    }));
}

function triggerBtsJsonImport() {
    const input = document.getElementById('bts-json-input');
    if (input) input.click();
}

async function importujPlikBtsJSON(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    try {
        const tekst = await file.text();
        const parsed = JSON.parse(tekst);
        const znormalizowane = normalizujDaneBts(parsed);

        if (znormalizowane.length === 0) {
            alert("Plik JSON nie zawiera poprawnych stacji BTS z polami lat i lon.");
            event.target.value = "";
            return;
        }

        btsStations = znormalizowane;
        localStorage.setItem(STORAGE_BTS_JSON_KEY, JSON.stringify(znormalizowane));
        selectedBtsId = null;
        wyczyscLinieBts();

        ustawOpisZrodla(`📡 Wczytana baza BTS (${btsStations.length})`);
        renderBtsList();
        renderBtsMarkers();
        alert(`✅ Załadowano ${btsStations.length} obiektów BTS.`);
    } catch (err) {
        alert("Błąd odczytu pliku JSON: " + err.message);
    }

    event.target.value = "";
}

function ustawOperatora(op, btn) {
    selectedOperator = op;
    document.querySelectorAll('.op-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderBtsList();
    renderBtsMarkers();
}

function getFilteredBts() {
    const q = (document.getElementById('btsFilterInput')?.value || '').trim().toLowerCase();

    return btsStations
        .filter(st => {
            if (selectedOperator !== "ALL") {
                const maOperatora = (st.operators || []).some(
                    op => op.toLowerCase() === selectedOperator.toLowerCase()
                );
                if (!maOperatora) return false;
            }
            if (!q) return true;
            const opsText = (st.operators || []).join(' ').toLowerCase();
            return (
                st.name.toLowerCase().includes(q) ||
                opsText.includes(q) ||
                st.bands.toLowerCase().includes(q)
            );
        })
        .map(st => {
            if (!userCoords) return { ...st, dist: null, bear: null };
            return {
                ...st,
                dist: calculateDistance(userCoords[0], userCoords[1], st.lat, st.lon),
                bear: calculateBearing(userCoords[0], userCoords[1], st.lat, st.lon)
            };
        })
        .filter(st => {
            if (maxDistanceKm === null || typeof st.dist !== 'number') return true;
            return st.dist <= maxDistanceKm;
        })
        .sort((a, b) => {
            if (typeof a.dist === 'number' && typeof b.dist === 'number') {
                return a.dist - b.dist;
            }
            return a.name.localeCompare(b.name);
        });
}

function createBtsDotIcon(operators) {
    const ops = Array.isArray(operators) && operators.length > 0 ? operators : ['Inny'];
    if (ops.length === 1) {
        const bg = getOperatorColor(ops[0]);
        return L.divIcon({
            className: '',
            html: `<div style="width:14px;height:14px;border-radius:50%;background:${bg};border:2px solid #ffffff;box-shadow:0 0 6px rgba(0,0,0,0.45);"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7]
        });
    }

    // Kilka firm na jednym obiekcie: pierścień z kolorów operatorów + jasny środek
    const colors = ops.map(getOperatorColor);
    const step = 360 / colors.length;
    const conic = colors
        .map((c, idx) => `${c} ${(idx * step).toFixed(1)}deg ${((idx + 1) * step).toFixed(1)}deg`)
        .join(', ');

    return L.divIcon({
        className: '',
        html: `<div style="width:16px;height:16px;border-radius:50%;background:conic-gradient(${conic});border:2px solid #ffffff;box-shadow:0 0 6px rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;"><div style="width:6px;height:6px;border-radius:50%;background:#ffffff;"></div></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });
}

function renderBtsMarkers() {
    if (!map) return;
    if (btsMarkersLayer) {
        map.removeLayer(btsMarkersLayer);
    }

    const filtered = getFilteredBts();
    const markers = filtered.map(st => {
        const marker = L.marker([st.lat, st.lon], {
            icon: createBtsDotIcon(st.operators)
        });
        const opsLabel = escapeHTML((st.operators || []).join(' + '));
        marker.bindPopup(`<b>${opsLabel}</b> — ${escapeHTML(st.name)}<br><small>${escapeHTML(st.bands)}</small>`);
        marker.on('click', () => wybierzStacjeBts(st.id));
        return marker;
    });

    btsMarkersLayer = L.layerGroup(markers).addTo(map);
}

function renderOperatorBadges(operators) {
    return (operators || []).map(op => {
        const color = getOperatorColor(op);
        return `<span class="bts-op-badge" style="background:${color};">${escapeHTML(op)}</span>`;
    }).join('');
}

function renderBtsList() {
    const container = document.getElementById('bts-list');
    if (!container) return;

    const filtered = getFilteredBts();
    if (filtered.length === 0) {
        container.innerHTML = `<div class="gps-placeholder">Brak stacji BTS spełniających kryteria.</div>`;
        return;
    }

    container.innerHTML = "";
    filtered.slice(0, 50).forEach(st => {
        const isActive = selectedBtsId === st.id;
        const distText = typeof st.dist === 'number' ? `${st.dist.toFixed(1)} km` : "—";
        const bearText = typeof st.bear === 'number' ? `${st.bear}°` : "—";
        const borderStyle = getStationBorderGradient(st.operators);

        const card = document.createElement('div');
        card.className = `bts-card ${isActive ? 'active' : ''}`;
        card.style.borderLeftColor = getStationColor(st.operators);
        if ((st.operators || []).length > 1) {
            card.style.borderLeft = '5px solid transparent';
            card.style.borderImage = `${borderStyle} 1`;
        }
        card.onclick = () => wybierzStacjeBts(st.id);

        card.innerHTML = `
            <div style="min-width:0;">
                <div class="bts-badges-row">
                    ${renderOperatorBadges(st.operators)}
                    <span class="bts-dist">Odległość: <b>${distText}</b></span>
                </div>
                <div class="bts-title">${escapeHTML(st.name)}</div>
                ${st.bands ? `<div class="bts-bands">${escapeHTML(st.bands)}</div>` : ''}
            </div>
            <div class="azimuth-container">
                <div class="azimuth-val">${bearText}</div>
                <div style="font-size: 0.65rem; color: #888; text-transform: uppercase; font-weight: bold;">Azymut</div>
            </div>
        `;
        container.appendChild(card);
    });
}

function wyczyscLinieBts() {
    if (currentLine && map) {
        map.removeLayer(currentLine);
        currentLine = null;
    }
    if (targetMarker && map) {
        map.removeLayer(targetMarker);
        targetMarker = null;
    }
}

function wybierzStacjeBts(btsId) {
    const st = btsStations.find(s => s.id === btsId);
    if (!st) return;

    if (selectedBtsId === btsId) {
        wyczyscLinieBts();
        selectedBtsId = null;
        renderBtsList();
        return;
    }

    selectedBtsId = btsId;
    renderBtsList();
    rysujLinieDoBts(st, true);
}

function rysujLinieDoBts(st, dopasujWidok = true) {
    if (!map || !st) return;
    wyczyscLinieBts();

    const txCoords = [st.lat, st.lon];
    const lineColor = getStationColor(st.operators);
    const targetIcon = L.divIcon({
        className: '',
        html: `<div class="bts-target-dot" style="background:${lineColor};"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
    });
    targetMarker = L.marker(txCoords, { icon: targetIcon }).addTo(map);

    const opsLabel = escapeHTML((st.operators || []).join(' + '));

    if (userCoords) {
        const dist = calculateDistance(userCoords[0], userCoords[1], st.lat, st.lon).toFixed(1);
        const bear = calculateBearing(userCoords[0], userCoords[1], st.lat, st.lon);

        currentLine = L.polyline([userCoords, txCoords], {
            color: lineColor,
            weight: 4,
            dashArray: '8, 8'
        }).addTo(map);

        targetMarker.bindPopup(`<b>${opsLabel}</b> · ${escapeHTML(st.name)}<br>Odległość: <b>${dist} km</b> · Azymut: <b>${bear}°</b>`);
        if (dopasujWidok) {
            targetMarker.openPopup();
            map.fitBounds(L.latLngBounds([userCoords, txCoords]), { padding: [36, 36], maxZoom: 16 });
        }
    } else {
        targetMarker.bindPopup(`<b>${opsLabel}</b> · ${escapeHTML(st.name)}`);
        if (dopasujWidok) {
            targetMarker.openPopup();
            map.setView(txCoords, 14, { animate: true });
        }
    }
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

    const satMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Esri Satellite'
    });

    map = L.map('map', {
        center: [50.25, 19.0],
        zoom: 12,
        layers: [satMap],
        zoomControl: false
    });

    L.control.layers({
        "Satelita": satMap,
        "Topografia": topoMap,
        "Mapa": osm
    }, null, { position: 'topright' }).addTo(map);

    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(pos => {
            userCoords = [pos.coords.latitude, pos.coords.longitude];

            if (!userMarker) {
                map.setView(userCoords, 15);
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

            if (selectedBtsId) {
                const wybrany = btsStations.find(s => s.id === selectedBtsId);
                if (wybrany) rysujLinieDoBts(wybrany, false);
            }

            renderBtsList();
        }, err => {
            console.error("Błąd GPS:", err);
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
        map.setView(userCoords, 15, { animate: true });
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

function escapeHTML(str) {
    return String(str ?? '').replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag]));
}

document.addEventListener("fullscreenchange", () => {
    setTimeout(() => { if (map) map.invalidateSize(); }, 200);
});
document.addEventListener("webkitfullscreenchange", () => {
    setTimeout(() => { if (map) map.invalidateSize(); }, 200);
});