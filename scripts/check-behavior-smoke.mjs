#!/usr/bin/env node

// Behavioral smoke gate: launches the static preview in a real headless
// browser and asserts rendered outcomes, not source strings. This catches the
// class of bug the string-pin gates structurally cannot — blank buttons,
// hidden-attribute leaks, unreachable nav items, console errors on a route —
// which have shipped through the source gates before.

import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireFromServer = createRequire(new URL("../server/package.json", import.meta.url));

let chromium;
try {
  ({ chromium } = requireFromServer("playwright"));
} catch {
  console.error("Behavior smoke gate needs Playwright. Run: npm --prefix server install && npx --prefix server playwright install chromium");
  process.exitCode = 1;
  process.exit();
}

const checks = [];
const consoleErrors = [];
// Environment noise, not app defects: CI runners have no audio output device,
// so Chromium logs this whenever WebAudio rendering starts. The app already
// gates beeps behind a user gesture; the device error is outside its control.
const ignoredConsoleNoise = [
  "The AudioContext encountered an error from the audio device or the WebAudio renderer."
];
const port = await freePort();
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["server/static.js"], {
  cwd: repoRoot,
  env: { ...process.env, HOST: "127.0.0.1", PREVIEW_PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"]
});

let browser;
try {
  await waitForStatic(port);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on("console", (message) => {
    if (message.type() === "error" && !ignoredConsoleNoise.some((noise) => message.text().includes(noise))) {
      consoleErrors.push(`${page.url().split("#")[1] || "/"}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(`${page.url().split("#")[1] || "/"}: ${error.message}`);
  });

  // Derive the route list from the app's own navigation so every destination
  // a concurrent agent adds is smoke-tested automatically, plus "terms" which
  // is a reachable route outside the nav. This closes the gap where the newest,
  // least-exercised routes went untested.
  await gotoRoute(page, "home");
  const navRoutes = await page.evaluate(() => [...document.querySelectorAll("#demo-nav .demo-nav-item")].map((item) => item.dataset.route).filter(Boolean));
  const routes = [...new Set([...navRoutes, "terms"])];
  check("navigation exposes the expected core routes", ["home", "review", "work", "create"].every((route) => navRoutes.includes(route)), navRoutes.join(", ") || "empty nav");
  for (const route of routes) {
    await gotoRoute(page, route);
    const contentFilled = await page.evaluate(() => {
      const content = document.getElementById("screen-content");
      return Boolean(content && content.textContent.trim().length > 0);
    });
    check(`route #/${route} renders content`, contentFilled, contentFilled ? "screen-content filled" : "screen-content empty");
    const leaks = await hiddenLeaks(page);
    check(`route #/${route} keeps hidden elements hidden`, leaks.length === 0, leaks.join(", ") || "no [hidden] leaks");
  }

  // Work screen: primary "run next" buttons must render a visible label
  // (a blank command button shipped twice — card view and table view).
  await gotoRoute(page, "work");
  const cardLabels = await runNextLabels(page);
  check(
    "work cards render non-empty run-next labels",
    cardLabels.length > 0 && cardLabels.every((label) => label.length > 0),
    cardLabels.length ? `${cardLabels.length} buttons, blanks: ${cardLabels.filter((l) => !l).length}` : "no run-next buttons found"
  );

  // Cycle the view toggle until the table view actually materializes instead
  // of assuming two blind clicks from "card" — a saved view, a late-bound
  // toggle after the fresh page load, or a slow view transition on CI makes
  // the fixed double-click land wrong (this step flaked on CI once).
  await page.waitForFunction(() => document.getElementById("density-toggle"), { timeout: 5000 }).catch(() => {});
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const view = await page.evaluate(() => {
      if (document.querySelector(".demo-work-table .demo-table-row")) return "table";
      document.getElementById("density-toggle")?.click();
      return document.querySelector(".demo-work-table .demo-table-row") ? "table" : "pending";
    });
    if (view === "table") break;
    await page.waitForTimeout(250);
  }
  const tableLabels = await runNextLabels(page, ".demo-table-row");
  check(
    "table view renders non-empty run-next labels",
    tableLabels.length > 0 && tableLabels.every((label) => label.length > 0),
    tableLabels.length ? `${tableLabels.length} buttons, blanks: ${tableLabels.filter((l) => !l).length}` : "no table run-next buttons found"
  );

  // List interaction: selecting a work item navigates to its route.
  await gotoRoute(page, "work");
  const navigated = await page.evaluate(() => {
    const before = location.hash;
    const title = document.querySelector('.demo-work-card [data-action="select"], .demo-table-row');
    title?.click();
    return { before, after: location.hash };
  });
  check(
    "selecting a work item navigates",
    navigated.after !== navigated.before && /#\/(work|pack)\//u.test(navigated.after),
    `${navigated.before} -> ${navigated.after}`
  );

  // Subtask authoring on the pack page: typing enables Add, adding appends a
  // row and bumps the count, removing takes it back to the baseline. Land on
  // the pack route explicitly — the select click above routes to the work
  // path or the pack view depending on the active list view. Counts are
  // polled rather than read synchronously: render() defers its DOM swap
  // behind a view transition.
  await gotoRoute(page, "pack/lighting-checklist");
  const subtaskSetup = await page.evaluate(() => {
    const input = document.querySelector("[data-subtask-input]");
    const add = document.querySelector("[data-subtask-add]");
    if (!input || !add) return { present: false };
    const before = document.querySelectorAll(".demo-subtask").length;
    const disabledBefore = add.disabled;
    input.value = "Smoke-added subtask";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const enabledAfterTyping = !add.disabled;
    add.click();
    return { present: true, before, disabledBefore, enabledAfterTyping };
  });
  let subtaskAdded = false;
  let subtaskRemoved = false;
  if (subtaskSetup.present) {
    subtaskAdded = await page
      .waitForFunction(
        (want) => document.querySelectorAll(".demo-subtask").length === want,
        subtaskSetup.before + 1,
        { timeout: 5000 }
      )
      .then(() => true)
      .catch(() => false);
  }
  if (subtaskAdded) {
    await page.evaluate(() => {
      const removeButtons = document.querySelectorAll("[data-subtask-remove]");
      removeButtons[removeButtons.length - 1]?.click();
    });
    subtaskRemoved = await page
      .waitForFunction(
        (want) => document.querySelectorAll(".demo-subtask").length === want,
        subtaskSetup.before,
        { timeout: 5000 }
      )
      .then(() => true)
      .catch(() => false);
  }
  check(
    "subtask authoring adds and removes rows",
    subtaskSetup.present && subtaskSetup.disabledBefore && subtaskSetup.enabledAfterTyping && subtaskAdded && subtaskRemoved,
    JSON.stringify({ ...subtaskSetup, subtaskAdded, subtaskRemoved })
  );

  // Review screen: the standup export control is present and builds text.
  await gotoRoute(page, "review");
  const standup = await page.evaluate(() => ({
    button: Boolean(document.getElementById("copy-standup")),
    text: typeof buildStandupText === "function" ? buildStandupText() : ""
  }));
  check("review standup control is present and builds text", standup.button && standup.text.length > 0, standup.text ? standup.text.split("\n")[0] : "missing");

  // Memory screen: the work-chooser chips must actually be bound. The whole
  // screen once rendered with dead [data-action] buttons because renderMemory
  // skipped bindListActions — a class of bug only a real click can catch.
  await gotoRoute(page, "memory");
  const memoryChip = await page.evaluate(() => {
    const chips = [...document.querySelectorAll('#screen-content [data-action="memory"]')];
    const target = chips.find((chip) => chip.getAttribute("aria-pressed") !== "true");
    if (!target) {
      return { clicked: false, before: location.hash, after: location.hash };
    }
    const before = location.hash;
    target.click();
    return { clicked: true, before, after: location.hash, pack: target.dataset.pack };
  });
  check(
    "memory chooser chips are bound and switch the target",
    memoryChip.clicked && memoryChip.after !== memoryChip.before && memoryChip.after.includes(memoryChip.pack),
    `${memoryChip.before} -> ${memoryChip.after}`
  );

  // Phantom-button sweep: every enabled visible button on every route must
  // produce an observable effect when clicked — a hash change, any DOM
  // change (screen content OR the command sidecar, where receipts land), an
  // open dialog, or a confirm() call. Buttons are deduped by action family
  // (one representative per data-action/data-go + label shape) so the sweep
  // stays fast, and already-pressed toggles (aria-pressed="true") are
  // legitimate no-ops. The Memory screen shipped ~100 dead buttons once;
  // this closes that class for good.
  await page.evaluate(() => { window.confirm = () => { window.__confirmed = true; return false; }; });
  const phantoms = [];
  const sweptFamilies = new Set();
  for (const route of routes) {
    if (route === "terms") continue;
    await gotoRoute(page, route);
    const families = await page.evaluate(() => {
      // Buttons inside collapsed <details> (e.g. the work card's "Other
      // actions") have offsetParent === null and would escape the sweep —
      // the snooze/open ReferenceError regression hid there once.
      document.querySelectorAll("#screen-content details:not([open])").forEach((d) => { d.open = true; });
      const seen = new Set();
      return [...document.querySelectorAll("#screen-content button:not([disabled]), #screen-content a.btn, .demo-command-brief button:not([disabled]), .demo-bottom-brief button:not([disabled]), .demo-bottom-brief a")]
        .filter((el) => el.offsetParent !== null && el.getAttribute("aria-pressed") !== "true" && el.getAttribute("aria-disabled") !== "true")
        .map((el) => `${el.id || ""}|${el.dataset.action || el.dataset.go || ""}|${(el.textContent || "").trim().replace(/\d+/g, "#").slice(0, 24)}`)
        .filter((key) => !seen.has(key) && seen.add(key));
    });
    for (const family of families) {
      if (sweptFamilies.has(family)) continue;
      sweptFamilies.add(family);
      await gotoRoute(page, route);
      const result = await page.evaluate((key) => {
        document.querySelectorAll("#screen-content details:not([open])").forEach((d) => { d.open = true; });
        const seen = new Set();
        const target = [...document.querySelectorAll("#screen-content button:not([disabled]), #screen-content a.btn")]
          .filter((el) => el.offsetParent !== null && el.getAttribute("aria-pressed") !== "true" && el.getAttribute("aria-disabled") !== "true")
          .find((el) => `${el.id || ""}|${el.dataset.action || el.dataset.go || ""}|${(el.textContent || "").trim().replace(/\d+/g, "#").slice(0, 24)}` === key);
        if (!target) return { skipped: true };
        window.__confirmed = false;
        const beforeHash = location.hash;
        // Poll for the effect instead of sampling once at a fixed delay:
        // render() defers its DOM swap behind a view transition, and a slow
        // CI runner can land it past any single-shot window (the settings
        // "Download backup" receipt was flagged dead this way). A mutation
        // observer armed before the click catches synchronous effects too,
        // and real effects resolve at the first poll, so the sweep gets
        // faster for the common case.
        let mutated = false;
        const observer = new MutationObserver(() => { mutated = true; });
        observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
        target.click();
        return new Promise((resolve) => {
          const startedAt = Date.now();
          const poll = () => {
            const changed = location.hash !== beforeHash
              || mutated
              || window.__confirmed
              || Boolean(document.querySelector("dialog[open]"));
            if (changed || Date.now() - startedAt > 1200) {
              observer.disconnect();
              const dialog = document.querySelector("dialog[open]");
              if (dialog) dialog.close();
              resolve({ changed });
            } else {
              setTimeout(poll, 60);
            }
          };
          setTimeout(poll, 60);
        });
      }, family);
      if (!result.skipped && !result.changed) {
        phantoms.push(`${route}: ${family}`);
      }
    }
  }
  check(
    "every enabled button produces an observable effect",
    phantoms.length === 0,
    phantoms.length ? phantoms.slice(0, 6).join(" ; ") : `${sweptFamilies.size} button families swept, none dead`
  );

  // Mobile nav: every destination (including Create) must be reachable
  // without a hidden horizontal scroll.
  await page.setViewportSize({ width: 375, height: 812 });
  await gotoRoute(page, "home");
  const navReach = await page.evaluate(() => {
    const nav = document.getElementById("demo-nav");
    const items = [...nav.querySelectorAll(".demo-nav-item")];
    const navRect = nav.getBoundingClientRect();
    const clipped = items
      .filter((item) => item.getBoundingClientRect().right > navRect.right + 1)
      .map((item) => item.dataset.route);
    return {
      total: items.length,
      clipped,
      createPresent: items.some((item) => item.dataset.route === "create"),
      scrollable: nav.scrollWidth > nav.clientWidth + 2
    };
  });
  check(
    "mobile nav keeps every destination reachable",
    navReach.createPresent && navReach.clipped.length === 0 && !navReach.scrollable,
    navReach.clipped.length ? `clipped: ${navReach.clipped.join(", ")}` : `${navReach.total} items, none clipped`
  );

  check("no console errors across routes", consoleErrors.length === 0, consoleErrors.slice(0, 5).join(" | ") || "clean");
} catch (error) {
  check("behavior smoke gate ran", false, error instanceof Error ? error.message : String(error));
} finally {
  if (browser) {
    await browser.close().catch(() => {});
  }
  server.kill();
  await new Promise((resolve) => {
    server.once("exit", resolve);
    setTimeout(resolve, 2000);
  });
}

for (const row of checks) {
  console.log(`${row.ok ? "PASS" : "FAIL"} ${row.name}: ${row.detail}`);
}
const failed = checks.filter((row) => !row.ok);
if (failed.length > 0) {
  process.exitCode = 1;
} else {
  console.log("\nBehavior smoke check passed.");
}

function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail: String(detail ?? "") });
}

async function gotoRoute(page, route) {
  await page.goto(`${baseUrl}/#/${route}`, { waitUntil: "load" });
  await page.waitForFunction(() => {
    const content = document.getElementById("screen-content");
    return content && content.textContent.trim().length > 0;
  }, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(120);
}

function runNextLabels(page, scope = ".demo-work-card") {
  return page.evaluate((selector) => [...document.querySelectorAll(`${selector} [data-action="run-next"]`)].map((button) => button.textContent.trim()), scope);
}

function hiddenLeaks(page) {
  return page.evaluate(() => [...document.querySelectorAll("[hidden]")]
    .filter((element) => getComputedStyle(element).display !== "none")
    .map((element) => element.id || element.className || element.tagName));
}

function waitForStatic(activePort) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const attempt = () => {
      const req = http.get({ host: "127.0.0.1", port: activePort, path: "/" }, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          resolve();
        } else {
          retry();
        }
      });
      req.on("error", retry);
    };
    const retry = () => {
      if (Date.now() - started > 10000) {
        reject(new Error("Static preview server did not become ready."));
        return;
      }
      setTimeout(attempt, 100);
    };
    attempt();
  });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() => {
        if (!address || typeof address === "string") {
          reject(new Error("Could not allocate a local port."));
          return;
        }
        resolve(address.port);
      });
    });
  });
}
