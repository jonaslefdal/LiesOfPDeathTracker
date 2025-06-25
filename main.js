document.getElementById("upload").addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function () {
        const buffer = reader.result;
        const results = {};

        for (const key of ["YouDieCount", "TotalReceiveDamage", "PlayerLevel"]) {
            const val = extractIntProperty(buffer, key);
            if (val !== null) results[key] = val;
        }

        const error = document.getElementById('error-message');
        const subtitleGroup = document.getElementById('subtitle-group');
        const resultsBox = document.getElementById('results');

        if (Object.keys(results).length > 0) {
            // Default missing stats to 0
            if (!results.YouDieCount) results.YouDieCount = 0;
            if (!results.TotalReceiveDamage) results.TotalReceiveDamage = 0;

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

document.getElementById("deathCount").textContent = parsedSaveData.YouDieCount;
document.getElementById("damageTaken").textContent = parsedSaveData.TotalReceiveDamage;
document.getElementById("playerLevel").textContent = parsedSaveData.PlayerLevel;

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
            PlayerLevel: "Player Level"
        };

    for (const [key, value] of Object.entries(stats)) {
        const li = document.createElement("li");
        const label = labelMap[key] || key; // fallback to key if no mapping
        li.innerHTML = `<strong>${label}:</strong> ${value}`;
        list.appendChild(li);
    }

    document.getElementById("results").classList.remove("hidden");
}

