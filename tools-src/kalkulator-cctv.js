document.addEventListener("DOMContentLoaded", () => {
    calcHDD();
    switchPowerMode();
    calcDORI();
});

/* --- PRZEŁĄCZANIE ZAKŁADEK KALKULATORA --- */
function switchCalcTab(tabName, btn) {
    document.querySelectorAll('.calc-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.calc-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + tabName).classList.add('active');
}

/* --- 1. KALKULATOR HDD --- */
function toggleCustomBitrate() {
    const codec = document.getElementById('camCodec').value;
    document.getElementById('customBitrateWrap').style.display = (codec === 'custom') ? 'block' : 'none';
}

function getBitrateKbps(mpx, codec) {
    // Typowy średni bitrate [kb/s] dla kamery w zależności od rozdzielczości i kodeka
    const matrix = {
        "2": { smart265: 1024, h265: 2048, h264: 4096 },
        "4": { smart265: 2048, h265: 4096, h264: 6144 },
        "5": { smart265: 2560, h265: 5120, h264: 8192 },
        "6": { smart265: 3072, h265: 5120, h264: 8192 },
        "8": { smart265: 4096, h265: 6144, h264: 8192 }
    };
    const row = matrix[String(mpx)] || matrix["4"];
    return row[codec] || 4096;
}

function calcHDD() {
    const cams = parseInt(document.getElementById('camCount').value) || 0;
    const days = parseInt(document.getElementById('recDays').value) || 0;
    const mpx = document.getElementById('camMpx').value;
    const codec = document.getElementById('camCodec').value;
    const duty = parseFloat(document.getElementById('recDuty').value) || 1.0;
    const bays = parseInt(document.getElementById('hddBays').value) || 1;
    
    const kbps = (codec === 'custom') 
        ? (parseInt(document.getElementById('customBitrateVal').value) || 0) 
        : getBitrateKbps(mpx, codec);

    const alertBox = document.getElementById('hddAlert');

    if (cams <= 0 || days <= 0 || kbps <= 0) {
        document.getElementById('hddRes').innerText = "Wymagane: 0 TB";
        document.getElementById('totalBandwidth').innerText = "0 kb/s (0.0 Mb/s)";
        document.getElementById('dailyStorage').innerText = "0 GB/dzień";
        document.getElementById('realDays').innerText = "0 dni";
        document.getElementById('usableSpace').innerText = "0 TB";
        alertBox.style.display = 'none';
        return;
    }

    const totalMbps = (cams * kbps) / 1024;
    // Uwaga: przelicznik bitów na bajty (1000^3 lub 1024^3) – tutaj używamy spójnego przelicznika jednostek binarnych (GiB/TiB)
    const gbPerDay = ((totalMbps / 8) * 86400 / 1024) * duty;
    const totalTB = (gbPerDay * days) / 1024;

    const sizes = [1, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20];

    // Najmniejsza pojemność pojedynczego dysku, która w wybranej liczbie zatok pokryje wymagane TB (z uwzględnieniem ~91% po formacie)
    const perBayRequired = totalTB / bays;
    const singleDriveSize = sizes.find(s => s * 0.91 >= perBayRequired) || Math.ceil(perBayRequired / 0.91);

    // Sprawdzenie, czy nie ma lepszego wariantu mieszanego (np. 1 lub 2 większe dyski zamiast powielania nadmiaru w 4 zatokach)
    let recLabel = `${bays}× ${singleDriveSize} TB`;
    let totalNominalTB = singleDriveSize * bays;

    if (bays > 1) {
        // Szukamy najmniejszej łącznej pojemności nominalnej przy użyciu do `bays` dysków (w praktyce w NVR stosuje się równe dyski, ale warto pokazać równe sztuki)
        recLabel = `${bays}× ${singleDriveSize} TB`;
    } else {
        recLabel = `1× ${singleDriveSize} TB`;
    }

    const usableTB = totalNominalTB * 0.91;
    const realDays = (usableTB * 1024) / gbPerDay;

    document.getElementById('hddRes').innerText = `Wymagane: ~${totalTB.toFixed(2)} TB → Zalecane: ${recLabel}`;
    document.getElementById('totalBandwidth').innerText = `${kbps} kb/s (${totalMbps.toFixed(1)} Mb/s)`;
    document.getElementById('dailyStorage').innerText = `${gbPerDay.toFixed(1)} GB/dzień`;
    document.getElementById('realDays').innerText = `~${realDays.toFixed(1)} dni`;
    document.getElementById('usableSpace').innerText = `${usableTB.toFixed(2)} TB (z ${totalNominalTB} TB)`;

    // Komunikaty ostrzegawcze i wyjaśniające podział na zatoki
    let alerts = [];

    if (bays > 1 && singleDriveSize === 1 && totalTB < 1.8) {
        alerts.push(`💡 Masz ${bays} zatoki, ale łączne zapotrzebowanie to ~${totalTB.toFixed(2)} TB. W praktyce często wystarczy 1 większy dysk (np. 2 TB lub 4 TB) zamiast obsadzać wszystkie ${bays} zatoki.`);
    } else if (bays >= 4 && (totalNominalTB - totalTB) > 3.0) {
        alerts.push(`💡 Przy ${bays} zatokach kalkulator dobiera równe dyski (${recLabel}), co daje łącznie ${totalNominalTB} TB. Jeśli nie planujesz RAID/nadmiarowości, możesz włożyć np. 1 lub 2 większe dyski zamiast 4.`);
    }

    if (totalMbps > 80 && totalMbps <= 160) {
        alerts.push(`⚠️ Pasmo ${totalMbps.toFixed(1)} Mb/s przekracza limit tanich rejestratorów budżetowych (zwykle 80 Mb/s). Wybierz NVR z pasmem min. 160–256 Mb/s.`);
    } else if (totalMbps > 160) {
        alerts.push(`🚨 Wysokie pasmo zapisu (${totalMbps.toFixed(1)} Mb/s)! Wymagany wydajny rejestrator (np. seria NVR4xxx-EI / NVR5xxx z pasmem 256–320 Mb/s).`);
    }

    if (singleDriveSize > 10) {
        alerts.push(`⚠️ Upewnij się w specyfikacji rejestratora, czy obsługuje dyski o pojemności ${singleDriveSize} TB na jedną zatokę (starsze NVR mają limit 6 TB, 8 TB lub 10 TB/HDD).`);
    }

    if (alerts.length > 0) {
        alertBox.className = alerts.some(a => a.startsWith('🚨')) ? 'calc-alert danger' : 'calc-alert warn';
        alertBox.style.display = 'block';
        alertBox.innerHTML = alerts.join('<br><br>');
    } else {
        alertBox.style.display = 'none';
    }
}

/* --- 2. ZASILANIE: WSPÓLNY WYBÓR PoE LUB 12V DC (2x0.75 / UTP) --- */
function switchPowerMode() {
    const mode = document.getElementById('powerMode').value;
    const poeBox = document.getElementById('powerModePoe');
    const dcBox = document.getElementById('powerModeDc');

    if (mode === 'poe') {
        poeBox.style.display = 'block';
        dcBox.style.display = 'none';
        calcPoE();
    } else {
        poeBox.style.display = 'none';
        dcBox.style.display = 'block';
        calcDC();
    }
}

function toggleCustomWatt() {
    const val = document.getElementById('poeCamType').value;
    document.getElementById('customWattWrap').style.display = (val === 'custom') ? 'block' : 'none';
}

function calcPoE() {
    const cams = parseInt(document.getElementById('poeCamCount').value) || 0;
    const selWatt = document.getElementById('poeCamType').value;
    const wattPerCam = (selWatt === 'custom') 
        ? (parseFloat(document.getElementById('customWattVal').value) || 0) 
        : (parseFloat(selWatt) || 0);
    const cableLen = parseFloat(document.getElementById('poeCableLen').value) || 0;
    const alertBox = document.getElementById('poeAlert');

    if (cams <= 0 || wattPerCam <= 0) {
        document.getElementById('poeRes').innerText = "Wymagany standard: brak danych";
        return;
    }

    let stdName = "802.3af (PoE)";
    let stdLimitText = "do 12.95 W (802.3af)";
    if (wattPerCam > 25.5) {
        stdName = "802.3bt (PoE++)";
        stdLimitText = "do 51–71 W (802.3bt)";
    } else if (wattPerCam > 12.95) {
        stdName = "802.3at (PoE+)";
        stdLimitText = "do 25.5 W (802.3at)";
    }

    const rawWatts = cams * wattPerCam;
    const safeWatts = rawWatts * 1.2;

    let switchPorts = cams <= 4 ? 4 : (cams <= 8 ? 8 : (cams <= 16 ? 16 : 24));
    const budgets = [36, 60, 96, 120, 150, 250, 370, 500];
    const recBudget = budgets.find(b => b >= safeWatts) || Math.ceil(safeWatts / 50) * 50;

    document.getElementById('poeRes').innerText = `Wymagany standard: ${stdName}`;
    document.getElementById('poeRawWatt').innerText = `${rawWatts.toFixed(1)} W (${cams} × ${wattPerCam} W)`;
    document.getElementById('poeSafeWatt').innerText = `~${safeWatts.toFixed(1)} W`;
    document.getElementById('poeSwitchRec').innerText = `${switchPorts}-port (min. ${recBudget}W)`;
    document.getElementById('poeStdLimit').innerText = stdLimitText;

    if (cableLen > 100 && cableLen <= 250) {
        alertBox.className = 'calc-alert warn';
        alertBox.style.display = 'block';
        alertBox.innerText = `⚠️ Odcinek ${cableLen} m przekracza standard Ethernet 100 m! Wymagany switch z trybem Extend (CCTV) lub wzmacniacz PoE po drodze.`;
    } else if (cableLen > 250) {
        alertBox.className = 'calc-alert danger';
        alertBox.style.display = 'block';
        alertBox.innerText = `🚨 Odległość ${cableLen} m jest za duża dla zwykłego PoE! Zastosuj technologię Dahua ePoE (do 800 m) lub światłowód.`;
    } else {
        alertBox.className = 'calc-alert ok';
        alertBox.style.display = 'block';
        alertBox.innerText = `✅ Dla kamery ${wattPerCam} W wymagany jest port w standardzie ${stdName} oraz łączny budżet switcha min. ${recBudget} W.`;
    }
}

function calcDC() {
    const wireType = document.getElementById('dcWireType').value;
    const cableLen = parseFloat(document.getElementById('dcCableLen').value) || 0;
    const wattPerCam = parseFloat(document.getElementById('dcCamWatt').value) || 0;
    const cams = parseInt(document.getElementById('dcCamCount').value) || 1;
    const alertBox = document.getElementById('dcAlert');

    if (cableLen <= 0 || wattPerCam <= 0) return;

    const loopResPerMeter = {
        "0.5":  0.0712,
        "0.75": 0.0475,
        "1.0":  0.0356,
        "1.5":  0.0237,
        "utp1": 0.1880,
        "utp2": 0.0940
    };

    const rLoop = (loopResPerMeter[wireType] || 0.0475) * cableLen;
    const currentCam = wattPerCam / 12.0;
    const voltageDrop = currentCam * rLoop;
    const endVoltage = Math.max(0, 12.0 - voltageDrop);

    const totalWatts = wattPerCam * cams;
    const safeAmps = (totalWatts / 12.0) * 1.25;
    const safeWatts = totalWatts * 1.25;

    document.getElementById('dcDropVolt').innerText = `${voltageDrop.toFixed(2)} V (prąd ${currentCam.toFixed(2)} A/kam)`;
    document.getElementById('dcPsuRec').innerText = `12V / min. ${safeAmps.toFixed(1)} A (~${Math.ceil(safeWatts)} W)`;

    if (endVoltage >= 11.0) {
        document.getElementById('dcRes').innerText = `Napięcie na kamerze: ${endVoltage.toFixed(2)} V (Bardzo dobre)`;
        alertBox.className = 'calc-alert ok';
        alertBox.style.display = 'block';
        alertBox.innerText = `✅ Spadek napięcia wynosi tylko ${voltageDrop.toFixed(2)} V. Kamera będzie działać stabilnie również w nocy przy pełnej mocy IR.`;
    } else if (endVoltage >= 10.5) {
        document.getElementById('dcRes').innerText = `Napięcie na kamerze: ${endVoltage.toFixed(2)} V (Na granicy)`;
        alertBox.className = 'calc-alert warn';
        alertBox.style.display = 'block';
        alertBox.innerText = `⚠️ Napięcie spada do ${endVoltage.toFixed(2)} V. Przy włączeniu IR w nocy kamera może się restartować. Zastosuj grubszy przewód lub zasilacz z regulacją podkręcony na 13.5 V.`;
    } else {
        document.getElementById('dcRes').innerText = `🚨 Napięcie na kamerze: ${endVoltage.toFixed(2)} V (Za niskie!)`;
        alertBox.className = 'calc-alert danger';
        alertBox.style.display = 'block';
        alertBox.innerText = `🚨 Krytyczny spadek napięcia (-${voltageDrop.toFixed(2)} V)! Kamera nie ruszy lub będzie wpadać w pętlę restartów w nocy. Użyj grubszego kabla lub przejdź na PoE.`;
    }
}

/* --- 3. KALKULATOR OBIEKTYWU I DORI --- */
function toggleCustomLens() {
    const val = document.getElementById('doriLens').value;
    document.getElementById('customLensWrap').style.display = (val === 'custom') ? 'block' : 'none';
}

function calcDORI() {
    const horizPx = parseInt(document.getElementById('doriRes').value) || 2688;
    const sensorWidthMm = parseFloat(document.getElementById('doriSensor').value) || 5.57;
    const selLens = document.getElementById('doriLens').value;
    const focalMm = (selLens === 'custom') 
        ? (parseFloat(document.getElementById('customLensVal').value) || 2.8) 
        : (parseFloat(selLens) || 2.8);
    const distM = parseFloat(document.getElementById('doriDist').value) || 1;
    const alertBox = document.getElementById('doriAlert');

    const sceneWidthM = (distM * sensorWidthMm) / focalMm;
    const ppm = horizPx / sceneWidthM;

    const hfovDeg = 2 * Math.atan(sensorWidthMm / (2 * focalMm)) * (180 / Math.PI);

    const maxRecM = (horizPx * focalMm) / (125 * sensorWidthMm);
    const maxIdM = (horizPx * focalMm) / (250 * sensorWidthMm);
    const diffM = (distM - maxIdM).toFixed(1);

    let levelText = "";
    if (ppm >= 250) {
        levelText = `✅ Identyfikacja (I) – ${Math.round(ppm)} px/m`;
        alertBox.className = 'calc-alert ok';
        alertBox.style.display = 'block';
        alertBox.innerText = `Na ${distM} m uzyskasz pewną identyfikację twarzy oraz odczyt tablic (maksymalny zasięg tej kamery to ${maxIdM.toFixed(1)} m).`;
    } else if (ppm >= 125) {
        levelText = `🟢 Rozpoznanie (R) – ${Math.round(ppm)} px/m`;
        alertBox.className = 'calc-alert ok';
        alertBox.style.display = 'block';
        alertBox.innerText = `Na ${distM} m rozpoznasz znajomą osobę. Granica pewnej identyfikacji obcego to max ${maxIdM.toFixed(1)} m (obiekt jest o ${diffM} m za daleko).`;
    } else if (ppm >= 62) {
        levelText = `🟡 Obserwacja (O) – ${Math.round(ppm)} px/m`;
        alertBox.className = 'calc-alert warn';
        alertBox.style.display = 'block';
        alertBox.innerText = `Na ${distM} m widać ubiór i ruch, ale twarz jest za daleko (zasięg rozpoznania R: max ${maxRecM.toFixed(1)} m, identyfikacji I: max ${maxIdM.toFixed(1)} m).`;
    } else if (ppm >= 25) {
        levelText = `🟠 Detekcja (D) – ${Math.round(ppm)} px/m`;
        alertBox.className = 'calc-alert warn';
        alertBox.style.display = 'block';
        alertBox.innerText = `Na ${distM} m wykryjesz tylko obecność sylwetki. Do szczegółów wybierz dłuższą ogniskową (np. 6 mm lub 12 mm).`;
    } else {
        levelText = `🔴 Poniżej normy DORI (${Math.round(ppm)} px/m)`;
        alertBox.className = 'calc-alert danger';
        alertBox.style.display = 'block';
        alertBox.innerText = `Odległość ${distM} m jest za duża dla tego obiektywu – sylwetka będzie zajmować zaledwie kilka pikseli.`;
    }

    document.getElementById('doriMainRes').innerText = levelText;
    document.getElementById('doriWidth').innerText = `${sceneWidthM.toFixed(1)} m (~${Math.round(hfovDeg)}°)`;
    document.getElementById('doriPpm').innerText = `${Math.round(ppm)} px/m`;
    document.getElementById('doriMaxRec').innerText = `${maxRecM.toFixed(1)} m`;
    document.getElementById('doriMaxId').innerText = `${maxIdM.toFixed(1)} m`;
}