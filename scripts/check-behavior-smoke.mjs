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
    if (message.type() === "error") {
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

  await page.evaluate(() => document.getElementById("density-toggle")?.click());
  await page.waitForTimeout(150);
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

  // Review screen: the standup export control is present and builds text.
  await gotoRoute(page, "review");
  const standup = await page.evaluate(() => ({
    button: Boolean(document.getElementById("copy-standup")),
    text: typeof buildStandupText === "function" ? buildStandupText() : ""
  }));
  check("review standup control is present and builds text", standup.button && standup.text.length > 0, standup.text ? standup.text.split("\n")[0] : "missing");

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
