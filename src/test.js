const V = require("./logic.js");
const data = require("../vocab.json");
const { words } = V.loadVocab(data);
let pass = 0, fail = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fail++; if (fails.length < 30) fails.push(m); } };

ok(words.length === 80, "80 Wörter");
ok(data.units.length === 2, "2 Units");
ok(data.units[0].words.length === 40 && data.units[1].words.length === 40, "40 je Unit");

// Jedes Wort: Englisch und Deutsch gegen sich selbst korrekt
words.forEach(w => {
  ok(V.checkTyped(w.en, w.en, "en").res === "correct", "en self " + w.en);
  ok(V.checkTyped(w.de, w.de, "de").res === "correct", "de self " + w.de);
  // Groß/Klein
  ok(V.checkTyped(w.en.toUpperCase(), w.en, "en").res === "correct", "en upper " + w.en);
  ok(V.checkTyped("  " + w.de + "  ", w.de, "de").res === "correct", "de trim " + w.de);
  // falsch
  ok(V.checkTyped("xxxxx", w.en, "en").res === "wrong", "en wrong");
  ok(V.checkTyped("xxxxx", w.de, "de").res === "wrong", "de wrong");
});

// (to) optional
const dl = words.find(w => w.en === "(to) download");
ok(V.checkTyped("download", dl.en, "en").res === "correct", "(to) weglassbar");
ok(V.checkTyped("(to) download", dl.en, "en").res === "correct", "(to) mit");
ok(V.checkTyped("DOWNLOAD", dl.en, "en").res === "correct", "(to) upper");

// Mehrere deutsche Bedeutungen: eine reicht
const cam = words.find(w => w.en === "camera");
ok(V.checkTyped("Kamera", cam.de, "de").res === "correct", "Kamera allein");
ok(V.checkTyped("Fotoapparat", cam.de, "de").res === "correct", "Fotoapparat allein");
ok(V.checkTyped("Fotoapparat, Kamera", cam.de, "de").res === "correct", "beide");

const phone = words.find(w => w.en === "(to) phone");
ok(V.checkTyped("anrufen", phone.de, "de").res === "correct", "anrufen");
ok(V.checkTyped("telefonieren", phone.de, "de").res === "correct", "telefonieren");

// /in
const det = words.find(w => w.en === "detective");
ok(V.checkTyped("Detektiv", det.de, "de").res === "correct", "Detektiv ohne /in");
ok(V.checkTyped("Detektiv/in", det.de, "de").res === "correct", "Detektiv/in");

// Sternchen
const danger = words.find(w => w.en.includes("danger"));
ok(V.checkTyped("danger", danger.en, "en").res === "correct", "danger ohne *");
ok(V.checkTyped("danger *", danger.en, "en").res === "correct", "danger mit *");
ok(V.checkTyped("Gefahr", danger.de, "de").res === "correct", "Gefahr ohne *");

// 1-Buchstaben-Tippfehler
ok(V.checkTyped("donload", dl.en, "en").res === "almost", "Tippfehler almost");
ok(V.checkTyped("Kamerra", cam.de, "de").res === "almost", "Kamera Tippfehler");
ok(V.checkTyped("Kamerax", cam.de, "de").res === "almost" || V.checkTyped("Kamerax", cam.de, "de").res === "wrong", "1-Edit");

// Leer
ok(V.checkTyped("", "media", "en").res === "hint", "leer");
ok(V.checkTyped("   ", "media", "en").res === "hint", "leer spaces");

// Rundenbau
["mc", "type", "cards"].forEach(mode => {
  ["en2de", "de2en", "mixed"].forEach(dir => {
    const round = V.buildRound(words, ["Unit 1"], dir, mode, 10);
    ok(round.length === 10, `Runde ${mode}/${dir} Länge`);
    const ids = new Set(round.map(r => r.word.id));
    ok(ids.size === 10, `Runde ${mode}/${dir} einzigartig`);
    if (mode === "mc") {
      round.forEach(r => {
        ok(r.opts.length === 4, "4 Optionen");
        ok(r.opts[r.correct] === r.answer, "correct Index");
        ok(new Set(r.opts.map(V.lower)).size === 4, "Optionen verschieden " + r.opts);
      });
    }
  });
});

// Unit 1+2
const all = V.buildRound(words, ["Unit 1", "Unit 2"], "mixed", "mc", 20);
ok(all.length === 20, "20 aus beiden Units");

// Fuzz
let fuzz = 0;
const alphabet = "abcdefghijklmnopqrstuvwxyzäöüß ,./-()'*";
let seed = 42; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
words.slice(0, 20).forEach(w => {
  for (let i = 0; i < 50; i++) {
    let s = ""; for (let k = 0; k < 1 + Math.floor(rnd() * 10); k++) s += alphabet[Math.floor(rnd() * alphabet.length)];
    let r; try { r = V.checkTyped(s, w.en, "en"); } catch (e) { fail++; fails.push("throw " + s); return; }
    ok(r && ["correct", "wrong", "almost", "hint"].includes(r.res), "fuzz res");
    fuzz++;
  }
});
ok(true, "fuzz " + fuzz);

console.log(fails.join("\n"));
console.log(`Logic-Tests: ${pass}/${pass + fail} bestanden`);
process.exit(fail ? 1 : 0);
