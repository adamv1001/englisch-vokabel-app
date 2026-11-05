const pw = require("/tmp/pp/node_modules/playwright");
const BASE = process.argv[2];
const BROWSERS = (process.argv[3] || "chromium,webkit").split(",");
let pass = 0, fail = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fail++; fails.push(m); } };
const UA_IP = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const DEV = {
  iphone15: { viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: UA_IP },
  ipad13: { viewport: { width: 1032, height: 1376 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA_IP.replace("iPhone; CPU iPhone OS", "iPad; CPU OS") }
};
async function layout(page, tag) {
  const r = await page.evaluate(() => {
    const vw = window.innerWidth, bad = [], small = [];
    document.querySelectorAll("button,input").forEach(el => {
      if (el.closest(".screen") && !el.closest(".screen.on")) return;
      if (el.closest("#dlg") && !document.getElementById("dlg").classList.contains("on")) return;
      if (el.closest("#update") && getComputedStyle(el.closest("#update")).display === "none") return;
      const b = el.getBoundingClientRect(); if (!b.width || !b.height) return;
      if (b.height < 43.5 || b.width < 43.5) bad.push((el.id || el.className || "").toString().slice(0, 40) + " " + b.width.toFixed(0) + "x" + b.height.toFixed(0));
      if (b.right > vw + 1) bad.push("overflow " + (el.id || el.className));
      if (el.tagName === "INPUT" && parseFloat(getComputedStyle(el).fontSize) < 18) small.push(el.id);
    });
    return { over: document.documentElement.scrollWidth > vw + 1, bad: bad.slice(0, 6), small };
  });
  ok(!r.over, tag + ": kein H-Scroll");
  ok(!r.bad.length, tag + ": Tap>=44 " + r.bad.join("; "));
  ok(!r.small.length, tag + ": Input>=18px " + r.small);
}
(async () => {
  for (const bname of BROWSERS) {
    const browser = bname === "webkit" ? await pw.webkit.launch() :
      await pw.chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
    for (const [dev, opt] of Object.entries(DEV)) {
      const tag = bname + "/" + dev;
      const ctx = await browser.newContext(opt);
      const page = await ctx.newPage();
      const errs = [];
      page.on("pageerror", e => errs.push(e.message));
      page.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
      page.on("dialog", d => { errs.push("native " + d.type()); d.dismiss(); });
      const resp = await page.goto(BASE, { waitUntil: "load" });
      ok(resp && resp.status() === 200, tag + ": 200");
      await page.waitForSelector(".unit");
      const sw = await page.evaluate(async () => {
        if (!("serviceWorker" in navigator)) return "kein API";
        const r = await Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(() => r(null), 12000))]);
        return r && r.active ? "aktiv" : "nein";
      });
      ok(sw === "aktiv", tag + ": SW " + sw);
      await page.reload({ waitUntil: "load" });
      await page.waitForSelector(".unit");
      ok(await page.evaluate(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller)), tag + ": SW kontrolliert");
      ok((await page.$$(".unit")).length >= 2, tag + ": Units sichtbar");
      await layout(page, tag + " Start");
      if (bname === "chromium" && dev === "iphone15") await page.screenshot({ path: "/workspace/vok_iphone_start.png" });

      // Unit 1 only
      await page.click('.unit[data-u="Unit 2"]'); // toggle off if on
      // ensure Unit 1 on, Unit 2 off
      await page.evaluate(() => {
        const S = window.__vok.S; S.units = ["Unit 1"];
        localStorage.setItem("vok_units", JSON.stringify(["Unit 1"]));
      });
      await page.reload({ waitUntil: "load" }); await page.waitForSelector(".unit");

      // Mode MC
      await page.click('#mode button[data-v="mc"]');
      await page.click('#dir button[data-v="en2de"]');
      await page.click('#len button[data-v="10"]');
      await page.click("#b-start");
      await page.waitForSelector(".opt");
      await layout(page, tag + " MC");
      if (bname === "chromium" && dev === "iphone15") await page.screenshot({ path: "/workspace/vok_iphone_frage.png" });
      if (bname === "chromium" && dev === "ipad13") await page.screenshot({ path: "/workspace/vok_ipad.png" });
      // wrong then right
      const wrongI = await page.evaluate(() => {
        const r = window.__vok.S.round[window.__vok.S.i];
        return (r.correct + 1) % 4;
      });
      await page.click(`.opt[data-i="${wrongI}"]`);
      await page.waitForSelector(".fb.no");
      ok((await page.innerText(".fb")).includes("Richtig"), tag + ": MC falsch + Lösung");
      ok((await page.innerText("#t-h")).includes("🤍"), tag + ": Herz weg");
      await page.click("#b-w");
      // rest correct
      for (let n = 0; n < 20; n++) {
        if (await page.isVisible("#s-end")) break;
        if (await page.isVisible(".fb")) { await page.click("#b-w"); continue; }
        const ci = await page.evaluate(() => window.__vok.S.round[window.__vok.S.i].correct);
        await page.click(`.opt[data-i="${ci}"]`);
        await page.waitForSelector(".fb.ok, .fb.no");
        await page.click("#b-w");
      }
      ok(await page.isVisible("#s-end"), tag + ": Auswertung MC");
      await page.click("#b-home");

      // Tippen
      await page.click('#mode button[data-v="type"]');
      await page.click("#b-start");
      await page.waitForSelector("#inp");
      ok(await page.getAttribute("#inp", "autocapitalize") === "off", tag + ": autocapitalize off");
      ok(await page.getAttribute("#inp", "spellcheck") === "false", tag + ": spellcheck off");
      const ans = await page.evaluate(() => window.__vok.S.round[0].answer);
      await page.fill("#inp", "xxxxwrong"); await page.click("#b-ok");
      await page.waitForSelector(".fb.no"); await page.click("#b-w");
      // almost / correct for remaining – just finish with correct
      for (let n = 0; n < 15; n++) {
        if (await page.isVisible("#s-end")) break;
        if (await page.isVisible(".fb")) { await page.click("#b-w"); continue; }
        const a = await page.evaluate(() => window.__vok.S.round[window.__vok.S.i].answer);
        await page.fill("#inp", a); await page.click("#b-ok");
        await page.waitForSelector(".fb"); await page.click("#b-w");
      }
      ok(await page.isVisible("#s-end"), tag + ": Auswertung Tippen");
      await page.click("#b-home");

      // Karten
      await page.click('#mode button[data-v="cards"]');
      await page.click('#len button[data-v="10"]');
      await page.click("#b-start");
      await page.waitForSelector("#flip");
      await page.click("#flip");
      ok(await page.evaluate(() => document.getElementById("flip").classList.contains("show")), tag + ": Karte umgedreht");
      await page.click("#b-knew");
      await page.waitForSelector(".fb.ok"); await page.click("#b-w");
      for (let n = 0; n < 15; n++) {
        if (await page.isVisible("#s-end")) break;
        if (await page.isVisible(".fb")) { await page.click("#b-w"); continue; }
        await page.click("#b-knew"); await page.waitForSelector(".fb"); await page.click("#b-w");
      }
      ok(await page.isVisible("#s-end"), tag + ": Auswertung Karten");
      await page.click("#b-home");

      // Zuordnen
      await page.click('#mode button[data-v="match"]');
      await page.click("#b-start");
      await page.waitForSelector("#match");
      // pair all by data-i
      const pairs = await page.evaluate(() => window.__vok.S.matchPairs.length);
      for (let i = 0; i < pairs; i++) {
        await page.click(`.tile[data-side="L"][data-i="${i}"]:not(.done)`);
        await page.click(`.tile[data-side="R"][data-i="${i}"]:not(.done)`);
      }
      await page.waitForSelector(".fb.ok");
      ok((await page.innerText(".fb")).includes("Paare"), tag + ": Zuordnen fertig");
      await page.click("#b-w");
      ok(await page.isVisible("#s-end"), tag + ": Auswertung Zuordnen");
      await page.click("#b-home");

      // Sprechen-Modus: UI zeigt Mic + Hinweis (Erkennung ggf. nicht verfügbar in Headless)
      await page.click('#mode button[data-v="speak"]');
      await page.click("#b-start");
      await page.waitForSelector("#b-mic");
      ok(await page.isVisible("#inp"), tag + ": Sprechen behält Eingabefeld");
      await page.click("#b-mic");
      await page.waitForTimeout(500);
      const heard = await page.innerText("#heard");
      // In Headless: oft Fehler oder "höre zu" – jedenfalls kein Crash
      ok(true, tag + ": Mic geklickt, heard=" + heard.slice(0, 60));
      // tippend beenden
      for (let n = 0; n < 15; n++) {
        if (await page.isVisible("#s-end")) break;
        if (await page.isVisible(".fb")) { await page.click("#b-w"); continue; }
        const a = await page.evaluate(() => window.__vok.S.round[window.__vok.S.i].answer);
        await page.fill("#inp", a); await page.click("#b-ok");
        await page.waitForSelector(".fb"); await page.click("#b-w");
      }
      ok(await page.isVisible("#s-end"), tag + ": Auswertung Sprechen (getippt)");

      // Offline
      await page.click("#b-home");
      await ctx.setOffline(true);
      let off = false;
      try {
        await page.reload({ waitUntil: "load" });
        await page.waitForSelector(".unit");
        off = (await page.$$(".unit")).length >= 2;
        await page.click("#b-start");
        off = off && (await page.isVisible("#q-word") || await page.isVisible("#match") || await page.isVisible("#flip"));
      } catch (e) { off = false; }
      ok(off, tag + ": Offline nach erstem Laden");
      await ctx.setOffline(false);

      ok(!errs.length, tag + ": keine JS-Fehler " + errs.join(" | "));
      await ctx.close();
    }
    await browser.close();
  }
  console.log(fails.join("\n"));
  console.log(`Browser-Checks: ${pass}/${pass + fail} bestanden`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
