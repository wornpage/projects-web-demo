#!/usr/bin/env node

// APCA contrast gate: parses the theme token blocks in assets/demo.css and
// enforces perceptual-contrast floors (APCA Lc, SAPC 0.0.98G-4g constants)
// on every text/background pairing the app actually renders, for every
// theme. Replaces the old prose-only "4.5:1" rule (WCAG 2 ratios overrate
// light-on-dark pairs; APCA exposed four failing dark-theme muted tokens
// and every dark-theme accent label when this gate landed).
//
// Floors (APCA readability levels, magnitude):
//   75  primary body ink on its surfaces
//   60  support text: secondary/muted ink, labels on accent fills, links,
//       status pill text, selected chip text
//   30  non-text indicators: accent as focus ring / progress on bg+surface
//   Borders are reported but not gated — hairlines are deliberate whispers
//   and every bordered surface also separates by layer color.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { apcaLc } from "./apca.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const css = fs.readFileSync(path.join(repoRoot, "assets", "demo.css"), "utf8");

const MAIN_THEMES = ["light", "dark", "forest", "ocean", "sepia"];
const SEASONAL_THEMES = ["holiday", "winter", "halloween"];

const normalizeHex = (value) => {
  const raw = value.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(raw)) {
    return "#" + raw.slice(1).split("").map((c) => c + c).join("");
  }
  return raw;
};

const parseTokens = (block) => {
  const tokens = {};
  for (const match of block.matchAll(/--cockpit-([\w-]+):\s*([^;}]+)/g)) {
    const value = match[2].trim();
    if (/^#[0-9a-f]{3}$|^#[0-9a-f]{6}$/i.test(value)) tokens[match[1]] = normalizeHex(value);
  }
  return tokens;
};

const rootMatch = css.match(/^:root \{([^}]*)\}/m);
const mediaMatch = css.match(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([^}]*)\}/);
const themeBlocks = {};
for (const match of css.matchAll(/html:has\(#theme-([\w]+):checked\)\s*\{([^}]*)\}/g)) {
  themeBlocks[match[1]] = parseTokens(match[2]);
}

let failures = 0;
let checks = 0;
const fail = (message) => {
  failures += 1;
  console.error(`FAIL ${message}`);
};
const pass = (message) => {
  checks += 1;
  if (process.argv.includes("--verbose")) console.log(`ok   ${message}`);
};

if (!rootMatch) fail("could not locate the :root token block");
if (!mediaMatch) fail("could not locate the prefers-color-scheme: dark token block");
for (const name of [...MAIN_THEMES, ...SEASONAL_THEMES]) {
  if (!themeBlocks[name]) fail(`missing html:has(#theme-${name}:checked) token block`);
}
if (failures) {
  console.error(`\nAPCA contrast gate: ${failures} structural failure(s).`);
  process.exit(1);
}

const rootTokens = parseTokens(rootMatch[1]);
const mediaTokens = parseTokens(mediaMatch[1]);

// The explicit light/dark radio blocks must stay in lockstep with :root and
// the media block — the theme radios and the OS preference are two routes to
// the same palette, and silent drift between them is a real bug class.
const compareTokenMaps = (label, base, mirror) => {
  for (const [token, value] of Object.entries(base)) {
    if (!(token in mirror)) fail(`${label}: --cockpit-${token} missing from mirror block`);
    else if (mirror[token] !== value) fail(`${label}: --cockpit-${token} drift (${value} vs ${mirror[token]})`);
    else pass(`${label}: --cockpit-${token} in sync`);
  }
  for (const token of Object.keys(mirror)) {
    if (!(token in base)) fail(`${label}: --cockpit-${token} only present in mirror block`);
  }
};
compareTokenMaps(":root vs theme-light", rootTokens, themeBlocks.light);
compareTokenMaps("media-dark vs theme-dark", mediaTokens, themeBlocks.dark);

const TEXT_75 = [
  ["text", "bg"], ["text", "surface"], ["text", "nav-bg"], ["text", "accent-50"]
];
const TEXT_60 = [
  ["text-secondary", "bg"], ["text-secondary", "surface"], ["text-secondary", "hover-bg"],
  ["text-muted", "bg"], ["text-muted", "surface"], ["text-muted", "nav-bg"],
  ["selected-fg", "selected-bg"],
  ["accent-text", "accent"], ["accent-text", "accent-hover"],
  ["accent", "accent-text"],
  ["link", "bg"], ["link", "surface"], ["link", "nav-bg"],
  ["success-text", "success-bg"], ["warning-text", "warning-bg"], ["danger-text", "danger-bg"]
];
const NONTEXT_30 = [["accent", "bg"], ["accent", "surface"]];
const REPORT_ONLY = [["border", "surface"], ["border-strong", "surface"]];

const checkPair = (theme, tokens, fg, bg, floor) => {
  if (!tokens[fg] || !tokens[bg]) {
    fail(`${theme}: missing token for pair --cockpit-${fg} on --cockpit-${bg}`);
    return;
  }
  const lc = Math.abs(apcaLc(tokens[fg], tokens[bg]));
  if (lc < floor) {
    fail(`${theme}: ${fg} on ${bg} is |Lc| ${lc.toFixed(1)} (floor ${floor}) — ${tokens[fg]} on ${tokens[bg]}`);
  } else {
    pass(`${theme}: ${fg} on ${bg} |Lc| ${lc.toFixed(1)} >= ${floor}`);
  }
};

for (const theme of MAIN_THEMES) {
  const tokens = themeBlocks[theme];
  for (const [fg, bg] of TEXT_75) checkPair(theme, tokens, fg, bg, 75);
  for (const [fg, bg] of TEXT_60) checkPair(theme, tokens, fg, bg, 60);
  for (const [fg, bg] of NONTEXT_30) checkPair(theme, tokens, fg, bg, 30);
  for (const [fg, bg] of REPORT_ONLY) {
    if (tokens[fg] && tokens[bg]) {
      const lc = Math.abs(apcaLc(tokens[fg], tokens[bg]));
      console.log(`note ${theme}: ${fg} on ${bg} |Lc| ${lc.toFixed(1)} (report-only)`);
    }
  }
}

// Seasonal overrides swap the accent while any base theme stays active, so
// their labels must read on their own fills and the accent must stay
// discernible as an indicator over every base theme's surfaces.
for (const season of SEASONAL_THEMES) {
  const tokens = themeBlocks[season];
  for (const required of ["accent", "accent-hover", "accent-text"]) {
    if (!tokens[required]) fail(`${season}: seasonal override must define --cockpit-${required}`);
  }
  if (tokens.accent && tokens["accent-text"]) {
    checkPair(season, tokens, "accent-text", "accent", 60);
    checkPair(season, tokens, "accent", "accent-text", 60);
  }
  if (tokens["accent-hover"] && tokens["accent-text"]) {
    checkPair(season, tokens, "accent-text", "accent-hover", 60);
  }
  if (tokens.accent) {
    for (const base of MAIN_THEMES) {
      for (const surface of ["bg", "surface"]) {
        const baseHex = themeBlocks[base][surface];
        const lc = Math.abs(apcaLc(tokens.accent, baseHex));
        if (lc < 30) {
          fail(`${season} over ${base}: accent on ${surface} is |Lc| ${lc.toFixed(1)} (floor 30)`);
        } else {
          pass(`${season} over ${base}: accent on ${surface} |Lc| ${lc.toFixed(1)} >= 30`);
        }
      }
    }
  }
}

if (failures) {
  console.error(`\nAPCA contrast gate FAILED: ${failures} failure(s) across ${checks + failures} checks.`);
  process.exit(1);
}
console.log(`APCA contrast gate passed: ${checks} checks across ${MAIN_THEMES.length} themes + ${SEASONAL_THEMES.length} seasonal overrides.`);
