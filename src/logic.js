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
function splitAlts(s) {
  // Alternativen mit " / " (nicht Detektiv/in – das ist Geschlecht)
  // Nur splitten, wenn Leerzeichen um den Slash sind oder beidseitig Wörter
  var parts = String(s).split(/\s+\/\s+/);
  if (parts.length > 1) return parts.map(function (p) { return p.trim(); }).filter(Boolean);
  return [String(s).trim()];
}
function variants(word, side) {
  // Alle akzeptablen Schreibweisen für eine Seite (en oder de)
  var base = stripDecor(word);
  var list = [base];
  function addForm(m) {
    list.push(m);
    expandParens(m).forEach(function (v) { list.push(v); });
    list.push(stripGender(m));
    list.push(stripParens(stripGender(m)));
    // Alternativen "a / b"
    splitAlts(m).forEach(function (a) {
      list.push(a);
      expandParens(a).forEach(function (v) { list.push(v); });
      list.push(stripGender(a));
      list.push(stripParens(stripGender(a)));
    });
  }
  if (side === "de") {
    splitMeanings(base).forEach(addForm);
  } else {
    splitAlts(base).forEach(function (m) { addForm(m); });
    expandParens(base).forEach(function (v) { list.push(v); });
    // (to) war schon entfernt; falls Original ohne (to) war, Variante mit (to)
    if (/^\(to\)/i.test(normSpace(word))) list.push(stripDecor(word));
    // trailing "..."
    list.push(base.replace(/\s*\.\.\.\s*$/, "").trim());
    // "forget, forgot" → erste Form
    if (base.indexOf(",") >= 0) list.push(base.split(",")[0].trim());
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
function guessKind(text) {
  var raw = String(text || "").trim();
  var s = stripDecor(raw);
  if (/^\(to\)/i.test(raw)) return "verb";
  if (/\?$/.test(s) || /\.\.\.$/.test(s) || /…$/.test(s)) return "phrase";
  if (/^(I |you |he |she |we |they |you'll|you will |not )/i.test(s)) return "phrase";
  return "other";
}
function pickDistractors(pool, word, side, n) {
  var target = side === "en" ? word.en : word.de;
  var opts = [], used = {};
  used[lower(target)] = 1;
  var wantKind = guessKind(side === "en" ? word.en : word.de);
  var tlen = stripDecor(target).length;
  function score(w) {
    var v = side === "en" ? w.en : w.de;
    var sc = 0;
    if (w.unit === word.unit) sc += 50;
    var k = guessKind(side === "en" ? w.en : w.de);
    if (k === wantKind) sc += 20;
    var dl = Math.abs(stripDecor(v).length - tlen);
    sc += Math.max(0, 15 - dl);
    return sc;
  }
  var ranked = pool.filter(function (w) { return w.id !== word.id; }).slice();
  ranked.sort(function (a, b) {
    var ds = score(b) - score(a);
    if (ds) return ds;
    return Math.random() - 0.5;
  });
  // leicht mischen innerhalb ähnlicher Scores: nimm Top-Kandidaten und shuffle
  var top = ranked.slice(0, Math.max(n * 6, 12));
  shuffle(top).forEach(function (w) {
    if (opts.length >= n) return;
    var v = side === "en" ? w.en : w.de;
    var k = lower(v);
    if (used[k]) return;
    used[k] = 1; opts.push(v);
  });
  // Rest aus ganzem Pool
  if (opts.length < n) {
    shuffle(pool).forEach(function (w) {
      if (opts.length >= n) return;
      if (w.id === word.id) return;
      var v = side === "en" ? w.en : w.de;
      var k = lower(v);
      if (used[k]) return;
      used[k] = 1; opts.push(v);
    });
  }
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
