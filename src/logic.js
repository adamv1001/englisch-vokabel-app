/* Englisch-Vokabelspiel – Antwortprüfung und Rundenlogik (Node + Browser) */
(function (root) {
"use strict";
function normSpace(s) {
  return String(s == null ? "" : s)
    .replace(/[\u00a0\u2007\u2009\u200A\u202F\u3000\t]/g, " ")
    .replace(/[\u200B\uFEFF]/g, "")
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2212\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}
function stripDecor(s) {
  // Sternchen (Zusatzwort), optionales (to)/(to …), Anführungszeichen am Rand
  s = normSpace(s);
  s = s.replace(/\s*\*\s*$/, "").replace(/^\*\s*/, "");
  s = s.replace(/^\(to\)\s*/i, "");
  s = s.replace(/^["']|["']$/g, "");
  return s.trim();
}
function lower(s) { return stripDecor(s).toLowerCase(); }
function stripGender(s) {
  // Detektiv/in, meine/r/s → Detektiv, meine
  return s.replace(/\/[a-zäöüß]+/gi, "");
}
function stripParens(s) {
  // "(nach) links abbiegen" → "links abbiegen" und "nach links abbiegen" als Varianten
  return s.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
}
function expandParens(s) {
  // Erzeuge Varianten: mit und ohne Klammerinhalt
  var out = [s], m, re = /\(([^)]+)\)/g, found = [];
  while ((m = re.exec(s))) found.push({ full: m[0], inner: m[1], i: m.index });
  if (!found.length) return out;
  // ohne alle Klammern
  out.push(stripParens(s));
  // nur Inhalt der ersten Klammer eingefügt (bereits im Original)
  return out;
}
function splitMeanings(de) {
  // Komma-getrennte Bedeutungen; Ellipsen "…" behalten
  return String(de).split(/\s*,\s*/).map(function (p) { return p.trim(); }).filter(Boolean);
}
function variants(word, side) {
  // Alle akzeptablen Schreibweisen für eine Seite (en oder de)
  var base = stripDecor(word);
  var list = [base];
  if (side === "de") {
    splitMeanings(base).forEach(function (m) {
      list.push(m);
      expandParens(m).forEach(function (v) { list.push(v); });
      list.push(stripGender(m));
      list.push(stripParens(stripGender(m)));
    });
  } else {
    expandParens(base).forEach(function (v) { list.push(v); });
    // (to) war schon entfernt; falls Original ohne (to) war, Variante mit (to)
    if (/^\(to\)/i.test(normSpace(word))) list.push(stripDecor(word));
    // trailing "..."
    list.push(base.replace(/\s*\.\.\.\s*$/, "").trim());
  }
  // Ellipsis-Varianten
  var more = [];
  list.forEach(function (v) {
    more.push(v.replace(/\u2026/g, "...").replace(/\.\.\./g, "…"));
    more.push(v.replace(/\u2026/g, "..."));
  });
  list = list.concat(more);
  // normalisiert kleingeschrieben, ohne doppelte
  var seen = {}, out = [];
  list.forEach(function (v) {
    var k = lower(v);
    if (k && !seen[k]) { seen[k] = 1; out.push(k); }
  });
  return out;
}
function levenshtein(a, b) {
  a = String(a); b = String(b);
  if (a === b) return 0;
  if (!a.length) return b.length; if (!b.length) return a.length;
  var prev = [], i, j;
  for (j = 0; j <= b.length; j++) prev[j] = j;
  for (i = 1; i <= a.length; i++) {
    var cur = [i];
    for (j = 1; j <= b.length; j++) {
      var cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}
function checkTyped(answer, expected, side) {
  try {
    var raw = normSpace(answer);
    if (!raw) return { res: "hint", msg: "Tippe zuerst eine Antwort ein." };
    var got = lower(raw);
    // (to) am Anfang der Eingabe optional
    got = got.replace(/^\(to\)\s*/, "");
    var opts = variants(expected, side);
    if (opts.indexOf(got) >= 0) return { res: "correct" };
    // 1-Buchstaben-Tippfehler gegen jede Variante
    for (var i = 0; i < opts.length; i++) {
      if (Math.abs(opts[i].length - got.length) <= 1 && levenshtein(got, opts[i]) === 1)
        return { res: "almost", msg: "Fast richtig! Meintest du: " + expected + "?", expect: expected };
    }
    return { res: "wrong" };
  } catch (e) {
    return { res: "wrong" };
  }
}
function checkMc(chosen, correct) {
  return chosen === correct ? { res: "correct" } : { res: "wrong" };
}

function shuffle(a) {
  a = a.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
function pickDistractors(pool, word, side, n) {
  var target = side === "en" ? word.en : word.de;
  var opts = [], used = {};
  used[lower(target)] = 1;
  shuffle(pool).forEach(function (w) {
    if (opts.length >= n) return;
    if (w.id === word.id) return;
    var v = side === "en" ? w.en : w.de;
    var k = lower(v);
    if (used[k]) return;
    used[k] = 1; opts.push(v);
  });
  // falls Pool zu klein, mit Platzhaltern auffüllen (sollte bei 40+ nicht passieren)
  while (opts.length < n) opts.push(side === "en" ? ("word" + opts.length) : ("Wort" + opts.length));
  return opts;
}
function buildRound(allWords, unitIds, direction, mode, count) {
  var pool = allWords.filter(function (w) { return unitIds.indexOf(w.unit) >= 0; });
  if (!pool.length) return [];
  var take = Math.min(count, pool.length);
  var picked = shuffle(pool).slice(0, take);
  return picked.map(function (w) {
    var dir = direction;
    if (dir === "mixed") dir = Math.random() < 0.5 ? "en2de" : "de2en";
    var askSide = dir === "en2de" ? "en" : "de";
    var ansSide = dir === "en2de" ? "de" : "en";
    var prompt = askSide === "en" ? w.en : w.de;
    var answer = ansSide === "en" ? w.en : w.de;
    var item = { word: w, dir: dir, prompt: prompt, answer: answer, askSide: askSide, ansSide: ansSide, mode: mode };
    if (mode === "mc") {
      var distract = pickDistractors(pool, w, ansSide, 3);
      var opts = shuffle([answer].concat(distract));
      item.opts = opts;
      item.correct = opts.indexOf(answer);
    }
    return item;
  });
}
function loadVocab(data) {
  var words = [];
  (data.units || []).forEach(function (u) {
    (u.words || []).forEach(function (w) {
      words.push({ id: w.id, unit: u.id, en: w.en, de: w.de, ex: w.ex || "" });
    });
  });
  return { units: data.units || [], words: words, title: data.title || "Vokabeln" };
}

var api = {
  normSpace: normSpace, stripDecor: stripDecor, lower: lower, variants: variants,
  levenshtein: levenshtein, checkTyped: checkTyped, checkMc: checkMc,
  shuffle: shuffle, buildRound: buildRound, loadVocab: loadVocab, splitMeanings: splitMeanings, pickDistractors: pickDistractors
};
if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Vok = api;
})(this);
