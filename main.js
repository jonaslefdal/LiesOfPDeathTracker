document.getElementById("upload").addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function () {
        const buffer = reader.result;
        const results = {};

        for (const key of ["YouDieCount", "TotalReceiveDamage", "PlayerLevel", "CharacterPlayTime"]) {
            let val;
            if (key === "CharacterPlayTime") {
                val = extractDoubleProperty(buffer, key);
            } else {
                val = extractIntProperty(buffer, key);
            }
            if (val !== null) results[key] = val;
        }
        
        if ("CharacterPlayTime" in results && typeof results.CharacterPlayTime === "number") {
            const totalSeconds = results.CharacterPlayTime;
            const h = Math.floor(totalSeconds / 3600);
            const m = Math.floor((totalSeconds % 3600) / 60);
            const s = Math.floor(totalSeconds % 60);
            results.CharacterPlayTime =
                h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
        }

        const error = document.getElementById('error-message');
        const subtitleGroup = document.getElementById('subtitle-group');
        const resultsBox = document.getElementById('results');

        if (Object.keys(results).length > 0) {
            // Default missing stats to 0
            if (!results.YouDieCount) results.YouDieCount = 0;
            if (!results.TotalReceiveDamage) results.TotalReceiveDamage = 0;
            if (!results.PlayerLevel) results.PlayerLevel = 0;
            if (!results.hasOwnProperty("CharacterPlayTime")) {
                delete results.CharacterPlayTime;
            }
console.log("Parsed results:", results);

            renderStats(results);
            error.classList.add('hidden');
            resultsBox.classList.remove('hidden');
            subtitleGroup.style.display = 'none';
        } else {
            error.classList.remove('hidden');
            resultsBox.classList.add('hidden');
            subtitleGroup.style.display = 'block';
        }
    };
    reader.readAsArrayBuffer(file);
});

document.getElementById('upload').addEventListener('change', function () {
  const label = document.getElementById('upload-label');
  const file = this.files[0];

  const subtitleGroup = document.getElementById('subtitle-group');
  const results = document.getElementById('results');

  if (file) {
    label.textContent = file.name;
    subtitleGroup.style.display = 'none';
    results.classList.remove('hidden');
  } else {
    label.textContent = "Open Save File";
    subtitleGroup.style.display = 'block';
    results.classList.add('hidden');
  }
});

function extractIntProperty(buffer, key) {
    const view = new DataView(buffer);
    const decoder = new TextDecoder("utf-8");
    const decoderUtf16 = new TextDecoder("utf-16le");

    for (let offset = 0; offset < buffer.byteLength - 4; offset++) {
        try {
            const nameLen = view.getInt32(offset, true);
            const isUtf16 = nameLen < 0;
            const len = Math.abs(nameLen);

            if (len === 0 || len > 100) continue; // skip junk

            let str;
            if (isUtf16) {
                const bytes = new Uint8Array(buffer, offset + 4, len * 2);
                str = decoderUtf16.decode(bytes).replace(/\0/g, "");
            } else {
                const bytes = new Uint8Array(buffer, offset + 4, len);
                str = decoder.decode(bytes).replace(/\0/g, "");
            }

            if (str !== key) continue;

            // Read type FString
            let typeOffset = offset + 4 + len * (isUtf16 ? 2 : 1);
            const typeLen = view.getInt32(typeOffset, true);
            const isUtf16Type = typeLen < 0;
            const typeStrLen = Math.abs(typeLen);
            const typeDecoder = isUtf16Type ? decoderUtf16 : decoder;
            const typeBytes = new Uint8Array(buffer, typeOffset + 4, typeStrLen * (isUtf16Type ? 2 : 1));
            const typeStr = typeDecoder.decode(typeBytes).replace(/\0/g, "");

            if (typeStr !== "IntProperty") continue;

            // Skip metadata: 4 bytes size + 1 + 4
            let valueOffset = typeOffset + 4 + typeStrLen * (isUtf16Type ? 2 : 1) + 4 + 1 + 4;
            return view.getInt32(valueOffset, true);
        } catch (e) {
            continue;
        }
    }
    return null;
}

function extractDoubleProperty(buffer, key) {
    const view = new DataView(buffer);
    const decoder = new TextDecoder("utf-8");

    const keyBytes = new TextEncoder().encode(key + "\0");
    const dpBytes = new TextEncoder().encode("DoubleProperty\0");

    for (let offset = 0; offset < buffer.byteLength - keyBytes.length; offset++) {
        let match = true;
        for (let i = 0; i < keyBytes.length; i++) {
            if (view.getUint8(offset + i) !== keyBytes[i]) {
                match = false;
                break;
            }
        }
        if (!match) continue;

        let foundType = false;
        let typeIdx = offset + keyBytes.length;
        while (typeIdx < buffer.byteLength - dpBytes.length) {
            let matchType = true;
            for (let i = 0; i < dpBytes.length; i++) {
                if (view.getUint8(typeIdx + i) !== dpBytes[i]) {
                    matchType = false;
                    break;
                }
            }
            if (matchType) {
                foundType = true;
                break;
            }
            typeIdx++;
        }
        if (!foundType) {
            console.log(`❌ Fant ${key}, men ikke DoubleProperty etterpå (offset ${offset})`);
            continue;
        }

        const valueOffset = typeIdx + dpBytes.length + 4 + 1 + 4;
        if (valueOffset + 8 > buffer.byteLength) continue;

        const val = view.getFloat64(valueOffset, true);
        console.log(`✅ Fant ${key}: ${val} (offset ${offset})`);

        if (val > 0 && val < 1e8) {
            return val;
        }
    }
    console.log(`❌ Fant ikke gyldig ${key}`);
    return null;
}

// Helper: guess length of next FString
function dataLengthFString(bytes, offset) {
    if (offset + 4 > bytes.length) return null;
    const length = new DataView(bytes.buffer).getInt32(offset, true);
    return Math.abs(length);
}

function renderStats(stats) {
    const list = document.getElementById("statList");
    list.innerHTML = "";

    const labelMap = {
        YouDieCount: "Deaths",
        TotalReceiveDamage: "Damage Taken",
        PlayerLevel: "Player Level",
        CharacterPlayTime: "Play Time"
    };

    for (const [key, value] of Object.entries(stats)) {
        const li = document.createElement("li");
        const label = labelMap[key] || key;

        let displayValue = value;
        if (typeof value === "number") {
            displayValue = value.toLocaleString("nb-NO");
        }

        li.innerHTML = `<strong>${label}:</strong> ${displayValue}`;
        list.appendChild(li);
        console.log("Rendering stat:", label, displayValue);
    }

    document.getElementById("results").classList.remove("hidden");
}


