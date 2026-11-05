const pw = require("/tmp/pp/node_modules/playwright");
const BASE = process.argv[2] || "http://localhost:8767/";
let pass = 0, fail = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fail++; fails.push(m); } };
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
(async () => {
  for (const [bname, launch] of [["chromium", () => pw.chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] })], ["webkit", () => pw.webkit.launch()]]) {
    const browser = await launch();
    for (const [dev, opt] of Object.entries({
      iphone15: { viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: UA },
      ipad13: { viewport: { width: 1032, height: 1376 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA.replace("iPhone; CPU iPhone OS", "iPad; CPU OS") }
    })) {
      const tag = bname + "/" + dev;
      const ctx = await browser.newContext(opt);
      const page = await ctx.newPage();
      const errs = [];
      page.on("pageerror", e => errs.push(e.message));
      page.on("dialog", d => { errs.push("native " + d.type()); d.dismiss(); });
      await page.goto(BASE, { waitUntil: "load" });
      await page.waitForSelector(".unit");
      await page.evaluate(() => { localStorage.clear(); });
      await page.reload({ waitUntil: "load" });
      await page.waitForSelector(".unit");

      // Unit 1 only
      await page.evaluate(() => { localStorage.setItem("vok_units", JSON.stringify(["Unit 1"])); });
      await page.reload({ waitUntil: "load" }); await page.waitForSelector(".unit");

      await page.click('#mode button[data-v="test"]');
      await page.waitForFunction(() => !document.getElementById("test-opts").hidden);
      ok(await page.isVisible("#test-opts"), tag + ": Test-Optionen sichtbar");
      await page.click('#testlen button[data-v="10"]');
      // Richtung disabled + mixed
      ok(await page.evaluate(() => document.querySelector('#dir button[data-v="mixed"]').classList.contains("on")), tag + ": Richtung gemischt");
      await page.click("#b-start");
      await page.waitForSelector("#inp");
      ok(await page.isVisible("#b-submit"), tag + ": Abgeben-Button");
      ok(!(await page.$(".fb")), tag + ": kein Feedback während des Tests");
      ok((await page.innerText("#t-h")).includes("📝"), tag + ": keine Herzen im Test");

      // Draft: answer 3, quit, resume
      for (let i = 0; i < 3; i++) {
        const a = await page.evaluate(() => window.__vok.S.round[window.__vok.S.i].answer);
        await page.fill("#inp", a);
        await page.click("#b-nextq");
        await page.waitForTimeout(100);
      }
      await page.click("#b-quit");
      await page.waitForSelector("#dlg.on");
      await page.click("#dlg-yes");
      await page.waitForSelector("#s-home");
      ok(await page.isVisible("#b-resume"), tag + ": Weitermachen sichtbar");
      await page.click("#b-resume");
      await page.waitForSelector("#inp");
      const idx = await page.evaluate(() => window.__vok.S.i);
      ok(idx === 3, tag + ": Resume bei Wort 4 (war " + idx + ")");

      // Fill remaining: mix of correct, wrong, almost
      for (let n = 0; n < 20; n++) {
        if (await page.isVisible("#s-end")) break;
        const i = await page.evaluate(() => window.__vok.S.i);
        const total = await page.evaluate(() => window.__vok.S.round.length);
        const a = await page.evaluate(() => window.__vok.S.round[window.__vok.S.i].answer);
        let typed = a;
        if (i === total - 3) typed = "XXXXFALSCH";
        else if (i === total - 2) {
          // 1-letter typo if possible
          typed = a.length > 2 ? a.slice(0, -1) + (a.slice(-1) === "a" ? "e" : "a") : "x" + a;
        } else if (i === total - 1) typed = "";
        await page.fill("#inp", typed);
        if (i + 1 >= total) {
          await page.click("#b-submit");
          await page.waitForSelector("#dlg.on");
          await page.click("#dlg-yes");
          break;
        } else {
          await page.click("#b-nextq");
          await page.waitForTimeout(80);
        }
      }
      await page.waitForSelector("#s-end");
      const note = await page.innerText(".note-big");
      const pctTxt = await page.innerText("#e-p");
      const okTxt = await page.innerText("#e-ok");
      ok(/^[1-6]$/.test(note.trim()), tag + ": Note 1–6 angezeigt (" + note + ")");
      ok(pctTxt.includes("%"), tag + ": Prozent " + pctTxt);
      ok(okTxt.includes("/"), tag + ": Punkte " + okTxt);
      ok((await page.innerText("#e-x")).includes("92"), tag + ": Notenschlüssel sichtbar");
      ok((await page.$$(".rev li")).length === 10, tag + ": 10 Zeilen in der Auswertung");
      ok((await page.$$(".rev li.ok")).length >= 5, tag + ": mehrere richtig markiert");
      ok(await page.isVisible("#b-retry") || (await page.$$(".rev li.bad,.rev li.half")).length === 0, tag + ": Falsche üben oder alles richtig");
      // history
      await page.click("#b-home");
      await page.waitForSelector("#s-home");
      ok((await page.innerText("#past-tests")).includes("Note"), tag + ": Test in History (" + (await page.innerText("#past-tests")).slice(0,80) + ")");
      ok(!(await page.isVisible("#b-resume")), tag + ": kein Resume nach Abgabe");

      if (bname === "chromium" && dev === "iphone15") {
        // Nochmal kurzer Test für Screenshot vom Ergebnis
        await page.click('#mode button[data-v="test"]');
        await page.waitForFunction(() => !document.getElementById("test-opts").hidden);
        await page.click('#testlen button[data-v="10"]');
        await page.click("#b-start");
        await page.waitForSelector("#inp");
        for (let n = 0; n < 12; n++) {
          if (await page.isVisible("#s-end")) break;
          const i = await page.evaluate(() => window.__vok.S.i);
          const total = await page.evaluate(() => window.__vok.S.round.length);
          const a = await page.evaluate(() => window.__vok.S.round[window.__vok.S.i].answer);
          await page.fill("#inp", n === 7 ? "falsch" : a);
          if (i + 1 >= total) {
            await page.click("#b-submit"); await page.click("#dlg-yes"); break;
          }
          await page.click("#b-nextq");
        }
        await page.waitForSelector(".note-big");
        await page.waitForTimeout(400);
        await page.screenshot({ path: "/workspace/vok_iphone_test_ergebnis.png", fullPage: false });
      }

      ok(!errs.length, tag + ": keine Fehler " + errs.join("|"));
      await ctx.close();
    }
    await browser.close();
  }
  // noteFromPct pure check via page
  console.log(fails.join("\n"));
  console.log(`Test-Modus-Checks: ${pass}/${pass + fail} bestanden`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
