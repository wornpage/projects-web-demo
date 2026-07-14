// Batch-refactor demo.js: extract bindXxxControls() from each route handler.
// Run: node scripts/refactor-hydration.mjs
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const demoPath = path.join(repoRoot, "src", "demo", "demo.js");
let source = await fs.readFile(demoPath, "utf8");

// Each entry: [old binding block, new `bindXxxControls();` call, new function body]
const transforms = [
  // --- renderReview ---
  {
    old: `  el("copy-standup")?.addEventListener("click", copyStandup);\n  bindListActions();\n}`,
    replace: `  bindReviewControls();\n}`,
    after: `\nfunction bindReviewControls() {\n  el("copy-standup")?.addEventListener("click", copyStandup);\n  bindListActions();\n}`
  },
  // --- renderNext ---
  {
    old: `  el("next-action-choice").addEventListener("change", () => syncNextChoicePreview(pack));\n  el("apply-next-action").addEventListener("click", () => applyNextChoice(pack.id));\n  syncNextChoicePreview(pack);\n  bindListActions();\n}`,
    replace: `  bindNextControls(pack);\n}`,
    after: `\nfunction bindNextControls(pack) {\n  el("next-action-choice").addEventListener("change", () => syncNextChoicePreview(pack));\n  el("apply-next-action").addEventListener("click", () => applyNextChoice(pack.id));\n  syncNextChoicePreview(pack);\n  bindListActions();\n}`
  }
];

for (const t of transforms) {
  if (!source.includes(t.old)) {
    console.error("OLD NOT FOUND:", t.old.slice(0, 80) + "...");
    continue;
  }
  source = source.replace(t.old, t.replace);
  // Insert the new function after the `}` that ends the function.
  // The function body is placed right after the `bindXxxControls();` call block.
  // We insert by finding the replace text and appending after the closing `}`.
  const insertAfter = t.replace + "\n";
  const idx = source.indexOf(insertAfter);
  if (idx !== -1) {
    source = source.slice(0, idx + insertAfter.length) + t.after + source.slice(idx + insertAfter.length);
  }
  console.log("Applied:", t.replace);
}

await fs.writeFile(demoPath, source, "utf8");
console.log("Done.");
