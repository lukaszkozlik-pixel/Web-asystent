const STORAGE_KEY = 'wlasne_acc_internet';
let customAccs = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

document.addEventListener("DOMContentLoaded", () => {
    calcSubnet();
    calcSpeed();
    renderujCustomAccs();
});

/* --- PRZEŁĄCZANIE ZAKŁADEK GŁÓWNYCH --- */
function switchMainInternetTab(tabName, btn) {
    const targetPanel = document.getElementById('tab-' + tabName);
    if (!targetPanel) return;

    document.querySelectorAll('.main-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));

    if (btn) btn.classList.add('active');
    targetPanel.classList.add('active');
}

/* --- PRZEŁĄCZANIE ZAKŁADEK KALKULATORA --- */
function switchNetTab(tabName, btn) {
    const targetPanel = document.getElementById('tab-' + tabName);
    if (!targetPanel) return;

    document.querySelectorAll('.calc-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.calc-panel').forEach(p => p.classList.remove('active'));

    if (btn) btn.classList.add('active');
    targetPanel.classList.add('active');
}

/* --- AKORDEONY WIEDZY I NARZĘDZI --- */
function toggleAcc(header) {
    const content = header.nextElementSibling;
    if (!content || !content.classList.contains('acc-content')) return;
    const span = header.querySelector('.acc-icon') || header.querySelector('span');
    const parentPanel = header.closest('.view-panel') || document;

    const isOpening = !content.classList.contains('show');

    parentPanel.querySelectorAll('.acc-header').forEach(h => {
        const c = h.nextElementSibling;
        const s = h.querySelector('.acc-icon') || h.querySelector('span');
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

/* --- 1. KALKULATOR PODSIECI IPv4 / CIDR --- */
function parseIpv4(ipStr) {
    const parts = ipStr.trim().split('.');
    if (parts.length !== 4) return null;
    let num = 0;
    for (let i = 0; i < 4; i++) {
        if (!/^\d+$/.test(parts[i])) return null;
        const octet = Number(parts[i]);
        if (octet < 0 || octet > 255) return null;
        num = ((num << 8) | octet) >>> 0;
    }
    return num;
}

function intToIpv4(num) {
    return [
        (num >>> 24) & 255,
        (num >>> 16) & 255,
        (num >>> 8) & 255,
        num & 255
    ].join('.');
}

function getIpv4Type(ipInt) {
    const b1 = (ipInt >>> 24) & 255;
    const b2 = (ipInt >>> 16) & 255;
    if (b1 === 10) return "Prywatna (RFC 1918 – klasa A)";
    if (b1 === 172 && b2 >= 16 && b2 <= 31) return "Prywatna (RFC 1918 – klasa B)";
    if (b1 === 192 && b2 === 168) return "Prywatna (RFC 1918 – klasa C)";
    if (b1 === 100 && b2 >= 64 && b2 <= 127) return "CGNAT / Shared Address Space (RFC 6598)";
    if (b1 === 169 && b2 === 254) return "APIPA / Link-Local (brak odpowiedzi DHCP)";
    if (b1 === 127) return "Loopback (localhost)";
    if (b1 >= 224 && b1 <= 239) return "Multicast (klasa D)";
    if (b1 >= 240) return "Zarezerwowana (klasa E)";
    return "Publiczna IPv4 (rutowalna w internecie)";
}

function calcSubnet() {
    const ipRaw = document.getElementById('cidrIpInput').value;
    const prefix = parseInt(document.getElementById('cidrMaskInput').value, 10);
    const peerRaw = document.getElementById('cidrPeerInput').value.trim();

    const ipInt = parseIpv4(ipRaw);
    const summaryEl = document.getElementById('subnetSummary');
    const peerAlert = document.getElementById('subPeerAlert');

    if (ipInt === null) {
        summaryEl.innerText = "⚠️ Wpisz poprawny adres IPv4 (np. 192.168.1.108)";
        summaryEl.style.color = "#c62828";
        peerAlert.style.display = "none";
        return;
    }

    summaryEl.style.color = "#4a148c";
    const maskInt = prefix === 0 ? 0 : ((0xFFFFFFFF << (32 - prefix)) >>> 0);
    const wildcardInt = (~maskInt) >>> 0;
    const netInt = (ipInt & maskInt) >>> 0;
    const bcastInt = (netInt | wildcardInt) >>> 0;

    let hostRangeStr = "";
    let hostCount = 0;

    if (prefix === 32) {
        hostRangeStr = `${intToIpv4(ipInt)} (1 host)`;
        hostCount = 1;
    } else if (prefix === 31) {
        hostRangeStr = `${intToIpv4(netInt)} – ${intToIpv4(bcastInt)} (P2P)`;
        hostCount = 2;
    } else {
        const firstHost = intToIpv4((netInt + 1) >>> 0);
        const lastHost = intToIpv4((bcastInt - 1) >>> 0);
        hostRangeStr = `${firstHost} – ${lastHost}`;
        hostCount = Math.pow(2, 32 - prefix) - 2;
    }

    summaryEl.innerText = `Sieć: ${intToIpv4(netInt)}/${prefix}`;
    document.getElementById('subNetAddr').innerText = intToIpv4(netInt);
    document.getElementById('subBcastAddr').innerText = intToIpv4(bcastInt);
    document.getElementById('subMaskDec').innerText = intToIpv4(maskInt);
    document.getElementById('subWildcard').innerText = intToIpv4(wildcardInt);
    document.getElementById('subHostRange').innerText = hostRangeStr;
    document.getElementById('subHostCount').innerText = hostCount.toLocaleString('pl-PL');
    document.getElementById('subIpType').innerText = getIpv4Type(ipInt);

    if (!peerRaw) {
        peerAlert.style.display = "none";
        return;
    }

    peerAlert.style.display = "block";
    const peerInt = parseIpv4(peerRaw);
    if (peerInt === null) {
        peerAlert.className = 'calc-alert warn';
        peerAlert.innerText = "⚠️ Drugi adres IP ma niepoprawny format.";
        return;
    }

    const peerNetInt = (peerInt & maskInt) >>> 0;
    if (peerNetInt === netInt) {
        peerAlert.className = 'calc-alert ok';
        peerAlert.innerText = `✅ Oba adresy należą do podsieci ${intToIpv4(netInt)}/${prefix} – urządzenia widzą się bezpośrednio w sieci lokalnej.`;
    } else {
        peerAlert.className = 'calc-alert danger';
        peerAlert.innerText = `🚨 Różne podsieci! Drugie urządzenie jest w ${intToIpv4(peerNetInt)}/${prefix} – wymagany routing lub zmiana adresu IP.`;
    }
}

/* --- 2. PRZELICZNIK PRĘDKOŚCI I BUDŻET PASMA --- */
function formatDuration(totalSeconds) {
    if (!isFinite(totalSeconds) || totalSeconds <= 0) return "-";
    if (totalSeconds < 60) return `${Math.round(totalSeconds)}s`;
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = Math.round(totalSeconds % 60);
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
    return `${mins}m ${secs}s`;
}

function calcSpeed() {
    const mbps = parseFloat(document.getElementById('speedMbps').value) || 0;
    const fileGb = parseFloat(document.getElementById('fileSizeGb').value) || 0;
    const mbs = mbps / 8;

    document.getElementById('speedRes').innerText = `Realny transfer: ${mbs.toFixed(2)} MB/s`;
    if (mbs > 0) {
        document.getElementById('time1Gb').innerText = formatDuration(1024 / mbs);
        document.getElementById('timeCustomFile').innerText = formatDuration((fileGb * 1024) / mbs);
    } else {
        document.getElementById('time1Gb').innerText = "-";
        document.getElementById('timeCustomFile').innerText = "-";
    }

    const streams = parseInt(document.getElementById('streamCount').value, 10) || 0;
    const kbps = parseFloat(document.getElementById('streamKbps').value) || 0;
    const availMbps = parseFloat(document.getElementById('availUploadMbps').value) || 0;

    const usedMbps = (streams * kbps) / 1024;
    const freeMbps = availMbps - usedMbps;
    const pct = availMbps > 0 ? (usedMbps / availMbps) * 100 : 0;

    document.getElementById('streamTotalRes').innerText = `Łączne pasmo: ${usedMbps.toFixed(2)} Mb/s`;
    document.getElementById('streamUsagePct').innerText = `${pct.toFixed(1)}%`;
    document.getElementById('streamFreeMbps').innerText = `${freeMbps.toFixed(2)} Mb/s`;

    const streamAlert = document.getElementById('streamAlert');
    if (availMbps <= 0 || streams <= 0 || kbps <= 0) {
        streamAlert.style.display = "none";
        return;
    }

    streamAlert.style.display = "block";
    if (pct > 100) {
        streamAlert.className = 'calc-alert danger';
        streamAlert.innerText = `🚨 Brakuje ${(usedMbps - availMbps).toFixed(2)} Mb/s! Strumienie zatkają łącze — obniż bitrate/FPS lub przełącz podgląd na Sub Stream.`;
    } else if (pct > 75) {
        streamAlert.className = 'calc-alert warn';
        streamAlert.innerText = `⚠️ Wysokie obciążenie (${pct.toFixed(0)}%). Przy skokach VBR w ruchu obraz może przycinać — warto zostawić min. 20–25% zapasu.`;
    } else {
        streamAlert.className = 'calc-alert ok';
        streamAlert.innerText = `✅ Bezpieczny zapas pasma (${freeMbps.toFixed(2)} Mb/s wolnego na ruch w tle i skoki bitrate'u).`;
    }
}

/* --- 3. WŁASNE NOTATKI --- */
function renderujCustomAccs() {
    const list = document.getElementById('custom-accordions-list');
    if (!list) return;
    list.innerHTML = "";

    customAccs.forEach((item, index) => {
        list.innerHTML += `
            <div class="accordion">
                <div class="acc-header custom-note" onclick="toggleAcc(this)">
                    <span>📝 ${escapeHTML(item.tytul)}</span>
                    <span class="acc-icon">+</span>
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
