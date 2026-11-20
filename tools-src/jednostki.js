const OFFSETS = {
    75: 108.75,
    50: 106.99
};

const REFERENCE_LEVELS = [
    { label: "DVB-T2 min:", dbuv: 48 },
    { label: "DVB-T2 max:", dbuv: 74 },
    { label: "SAT min:",    dbuv: 47 },
    { label: "SAT max:",    dbuv: 77 }
];

let currentOhm = 75;
let lastEdited = 'dbuv';

document.addEventListener("DOMContentLoaded", () => {
    renderReferenceTable();
});

function renderReferenceTable() {
    const tbody = document.getElementById('refTableBody');
    if (!tbody) return;

    const offset = OFFSETS[currentOhm] || 108.75;
    tbody.innerHTML = REFERENCE_LEVELS.map(row => {
        const dbmVal = (row.dbuv - offset).toFixed(2);
        return `
            <tr>
                <td><b>${row.label}</b></td>
                <td>${row.dbuv} dBµV</td>
                <td>${dbmVal} dBm</td>
            </tr>
        `;
    }).join('');
}

function setImpedance(ohm, btn) {
    currentOhm = ohm === 50 ? 50 : 75;

    document.querySelectorAll('.ohm-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const titleEl = document.getElementById('pageTitle');
    if (titleEl) {
        titleEl.textContent = `Przelicznik Jednostek ${currentOhm} Ω`;
    }

    const infoEl = document.getElementById('offsetInfo');
    if (infoEl) {
        infoEl.textContent = `Impedancja: ${currentOhm} Ω (offset ${OFFSETS[currentOhm].toFixed(2)})`;
    }

    renderReferenceTable();

    const dbuvInput = document.getElementById('dbuv');
    const dbmInput = document.getElementById('dbm');
    if (dbuvInput && dbmInput && (dbuvInput.value.trim() !== '' || dbmInput.value.trim() !== '')) {
        convert(lastEdited);
    }
}

function convert(source) {
    const dbuvInput = document.getElementById('dbuv');
    const dbmInput = document.getElementById('dbm');
    if (!dbuvInput || !dbmInput) return;

    lastEdited = source;
    const offset = OFFSETS[currentOhm] || 108.75;

    if (source === 'dbuv') {
        const raw = dbuvInput.value.trim();
        if (raw === '') {
            dbmInput.value = '';
            return;
        }
        const val = parseFloat(raw);
        dbmInput.value = Number.isNaN(val) ? '' : (val - offset).toFixed(2);
    } else {
        const raw = dbmInput.value.trim();
        if (raw === '') {
            dbuvInput.value = '';
            return;
        }
        const val = parseFloat(raw);
        dbuvInput.value = Number.isNaN(val) ? '' : (val + offset).toFixed(2);
    }
}