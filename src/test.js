const V = require("./logic.js");
const data = require("../vocab.json");
const { words } = V.loadVocab(data);
let pass = 0, fail = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fail++; if (fails.length < 40) fails.push(m); } };

ok(data.units.length === 6, "6 Units");
ok(words.length === 756, "756 Wörter (war " + words.length + ")");
const counts = data.units.map(u => u.words.length);
ok(JSON.stringify(counts) === JSON.stringify([134,130,117,108,141,126]), "Unit-Zahlen " + counts);
ok(!data.units.some(u => u.words.some(w => String(w.de).includes(";"))), "keine Semikolons in de");
ok(!!data.source_note, "source_note");

// IDs eindeutig
ok(new Set(words.map(w => w.id)).size === words.length, "IDs unique");

// Alte Kern-IDs 0..79 sollten existieren (Fortschritt)
for (let i = 0; i < 80; i++) ok(words.some(w => w.id === i), "alte id " + i);

// Beispielsätze nur wo vorhanden – mind. 70
ok(words.filter(w => w.ex).length >= 70, "Beispielsätze >=70 (" + words.filter(w => w.ex).length + ")");

// Self-check Stichprobe + alle Unit-1
words.filter(w => w.unit === "Unit 1").forEach(w => {
  ok(V.checkTyped(w.en, w.en, "en").res === "correct", "en self " + w.en);
  ok(V.checkTyped(w.de, w.de, "de").res === "correct", "de self " + w.de);
});

const dl = words.find(w => w.en === "(to) download");
ok(!!dl, "download vorhanden");
ok(V.checkTyped("download", dl.en, "en").res === "correct", "(to) weglassbar");
ok(V.checkTyped("(to) download", dl.en, "en").res === "correct", "(to) mit");

const cam = words.find(w => w.en === "camera");
ok(V.checkTyped("Kamera", cam.de, "de").res === "correct", "Kamera allein");
ok(V.checkTyped("Fotoapparat", cam.de, "de").res === "correct", "Fotoapparat allein");

// Slash-Alternativen (falls vorhanden)
const slash = words.find(w => / \/. /.test(w.en) || / \/. /.test(w.de));
if (slash) {
  const side = / \/. /.test(slash.de) ? "de" : "en";
  const val = side === "de" ? slash.de : slash.en;
  const first = val.split(/\s+\/\s+/)[0].trim();
  ok(V.checkTyped(first, val, side).res === "correct", "slash alt " + first);
}

// Klammern
const beOn = words.find(w => w.en === "(to) be on");
if (beOn) {
  ok(V.checkTyped("gezeigt werden, stattfinden", beOn.de, "de").res === "correct" ||
     V.checkTyped("stattfinden", beOn.de, "de").res === "correct", "Klammern/Teilbedeutung");
}

ok(V.checkTyped("donload", dl.en, "en").res === "almost", "Tippfehler almost");
ok(V.checkTyped("", "media", "en").res === "hint", "leer");

["mc", "type", "cards"].forEach(mode => {
  ["en2de", "de2en", "mixed"].forEach(dir => {
    const round = V.buildRound(words, ["Unit 1"], dir, mode, 10);
    ok(round.length === 10, `Runde ${mode}/${dir} Länge`);
    if (mode === "mc") {
      round.forEach(r => {
        ok(r.opts.length === 4, "4 Optionen");
        ok(r.opts[r.correct] === r.answer, "correct Index");
        ok(new Set(r.opts.map(V.lower)).size === 4, "Optionen verschieden");
        // Distraktoren möglichst gleiche Unit
        const poolUnit = "Unit 1";
        ok(r.opts.every(o => o === r.answer || words.some(w => w.unit === poolUnit && (w.en === o || w.de === o))), "MC aus Unit");
      });
    }
  });
});

const all6 = V.buildRound(words, data.units.map(u => u.id), "mixed", "mc", 30);
ok(all6.length === 30, "30 aus allen Units");

// Unit 6 exists
ok(words.some(w => w.unit === "Unit 6"), "Unit 6 Wörter");

console.log(pass + " passed, " + fail + " failed");
if (fails.length) fails.forEach(f => console.log("FAIL:", f));
process.exit(fail ? 1 : 0);
