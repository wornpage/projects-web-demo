#!/usr/bin/env node

import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const requireFromServer = createRequire(new URL("../server/package.json", import.meta.url));
const { minify } = requireFromServer("terser");
const acorn = requireFromServer("acorn");

const inputPath = path.resolve(process.argv[2] || "assets/demo.js");
const outputPath = path.resolve(process.argv[3] || inputPath);

const protectedStringValues = Object.freeze([
  "/api/packs",
  "/api/packs/",
  "/api/demo-packs",
  "/api/state/restore",
  "/api/state/sync-copy",
  "/api/state/sync",
  "/api/state/filter",
  "/api/state/selected",
  "/api/state/scenario",
  "/api/state/profile",
  "/api/state/reset",
  "/api/state/browser",
  "/api/state/erase",
  "/api/state",
  "Backend API",
  "Backend demo data failed",
  "Projects demo backend action failed.",
  "Projects demo backend command preview failed.",
  "Projects demo backend create failed.",
  "Projects demo backend memory action failed.",
  "Projects demo backend next action failed.",
  "Projects demo backend work path action failed.",
  "Save to backend",
  "Sync codes need the backend app mode.",
  "backend-command-pending",
  "backend API could not load",
  "projects-static-demo-api-client-v1",
  "x-projects-demo-client"
]);

const protectedSubstringValues = Object.freeze([
  "/api/packs",
  "/api/demo-packs",
  "/api/state",
  "projects-static-demo-api-client-v1",
  "x-projects-demo-client"
]);

const bannedReadableNames = Object.freeze([
  "runBackendPackAction",
  "saveBackendPackNextAction",
  "saveBackendStateFilter",
  "saveBackendSelectedWork",
  "saveBackendScenario",
  "saveBackendProfile",
  "loadBackendSeedPacks",
  "loadBackendPackCommandPreview",
  "createBackendPack",
  "addBackendPackMemoryNote",
  "saveBackendPackPath",
  "backendCommandPendingForPack",
  "isBackendCommandPending",
  "backendCommandPendingReason",
  "backendCommandPendingFlowHint",
  "syncCommandActionButton",
  "loadBackendOwnedState",
  "prepareBackendWorkflowRequest"
]);

const source = await fs.readFile(inputPath, "utf8");
const minified = await minify(source, {
  compress: {
    passes: 2,
    toplevel: true
  },
  mangle: {
    toplevel: true
  },
  format: {
    comments: false
  }
});

if (!minified.code) {
  throw new Error("Terser returned no protected frontend output.");
}

const protectedResult = encodeProtectedStrings(minified.code);
const tmpPath = `${outputPath}.tmp-${process.pid}.js`;

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(tmpPath, protectedResult.code, "utf8");

const syntaxCheck = spawnSync(process.execPath, ["--check", tmpPath], {
  encoding: "utf8"
});
if (syntaxCheck.status !== 0) {
  await fs.rm(tmpPath, { force: true });
  throw new Error(`Protected frontend failed syntax check.\n${syntaxCheck.stderr || syntaxCheck.stdout}`);
}

const leakedNames = bannedReadableNames.filter((value) => protectedResult.code.includes(value));
if (leakedNames.length > 0) {
  await fs.rm(tmpPath, { force: true });
  throw new Error(`Protected frontend still exposes readable helper names: ${leakedNames.join(", ")}`);
}

const leakedStrings = findStringLiteralLeaks(protectedResult.code, protectedStringValues);
if (leakedStrings.length > 0) {
  await fs.rm(tmpPath, { force: true });
  throw new Error(`Protected frontend still exposes internal strings: ${leakedStrings.join(", ")}`);
}

const leakedSubstrings = protectedSubstringValues.filter((value) => protectedResult.code.includes(value));
if (leakedSubstrings.length > 0) {
  await fs.rm(tmpPath, { force: true });
  throw new Error(`Protected frontend still exposes internal substrings: ${leakedSubstrings.join(", ")}`);
}

if (protectedResult.replacementCount === 0) {
  await fs.rm(tmpPath, { force: true });
  throw new Error("Protected frontend encoded no internal strings.");
}

await fs.rename(tmpPath, outputPath);

console.log(`Protected ${path.relative(process.cwd(), inputPath)} -> ${path.relative(process.cwd(), outputPath)}`);
console.log(`Encoded ${protectedResult.uniqueStringCount} string(s) across ${protectedResult.replacementCount} literal use(s).`);

function encodeProtectedStrings(code) {
  const ast = acorn.parse(code, {
    ecmaVersion: "latest",
    sourceType: "script"
  });
  const protectedValues = new Set(protectedStringValues);
  const indexedValues = [];
  const valueIndexes = new Map();
  const replacements = [];
  const indexForValue = (value) => {
    let index = valueIndexes.get(value);
    if (index === undefined) {
      index = indexedValues.length;
      valueIndexes.set(value, index);
      indexedValues.push(value);
    }
    return index;
  };

  visit(ast, null, (node, parent) => {
    if (node.type === "TemplateLiteral" && templateContainsProtectedValue(node, protectedValues)) {
      replacements.push({
        start: node.start,
        end: node.end,
        kind: "template",
        node
      });
      for (const quasi of node.quasis) {
        const value = quasi.value?.cooked || "";
        if (value) {
          indexForValue(value);
        }
      }
      return;
    }

    if (node.type !== "Literal" || typeof node.value !== "string") {
      return;
    }
    if (!protectedValues.has(node.value) || shouldKeepLiteral(node, parent)) {
      return;
    }

    replacements.push({
      start: node.start,
      end: node.end,
      kind: "literal",
      index: indexForValue(node.value)
    });
  });

  if (replacements.length === 0) {
    return {
      code,
      replacementCount: 0,
      uniqueStringCount: 0
    };
  }

  const names = uniqueNames(code);
  const encodedValues = indexedValues.map(encodeString);
  const prelude = `const ${names.table}=${JSON.stringify(encodedValues)},${names.cache}=[];function ${names.decode}(${names.index}){return ${names.cache}[${names.index}]||(${names.cache}[${names.index}]=${names.table}[${names.index}].replace(/../g,(${names.hex},${names.offset})=>String.fromCharCode(parseInt(${names.hex},16)^((91+(${names.offset}>>1)*37)&255))))}`;

  let protectedCode = code;
  for (const replacement of withoutOverlaps(replacements).sort((left, right) => right.start - left.start)) {
    const call = replacement.kind === "template"
      ? templateExpression(code, replacement.node, valueIndexes, names.decode)
      : `${names.decode}(${replacement.index})`;
    protectedCode = `${protectedCode.slice(0, replacement.start)}${call}${protectedCode.slice(replacement.end)}`;
  }

  return {
    code: `${prelude};${protectedCode}`,
    replacementCount: replacements.length,
    uniqueStringCount: indexedValues.length
  };
}

function shouldKeepLiteral(node, parent) {
  if (!parent) {
    return true;
  }
  if (parent.type === "ExpressionStatement" && parent.expression === node && parent.directive) {
    return true;
  }
  if ((parent.type === "Property" || parent.type === "MethodDefinition" || parent.type === "PropertyDefinition")
    && parent.key === node && !parent.computed) {
    return true;
  }
  if (parent.type === "ImportDeclaration" || parent.type === "ExportNamedDeclaration" || parent.type === "ExportAllDeclaration") {
    return true;
  }
  return false;
}

function templateContainsProtectedValue(node, protectedValues) {
  return node.quasis.some((quasi) => {
    const value = quasi.value?.cooked || "";
    return [...protectedValues].some((protectedValue) => value.includes(protectedValue));
  });
}

function templateExpression(code, node, valueIndexes, decodeName) {
  const parts = [];
  for (let index = 0; index < node.quasis.length; index += 1) {
    const value = node.quasis[index].value?.cooked || "";
    if (value) {
      parts.push(`${decodeName}(${valueIndexes.get(value)})`);
    }
    const expression = node.expressions[index];
    if (expression) {
      parts.push(`String(${code.slice(expression.start, expression.end)})`);
    }
  }
  return parts.length > 0 ? parts.join("+") : "\"\"";
}

function withoutOverlaps(replacements) {
  const kept = [];
  for (const replacement of replacements.sort((left, right) => left.start - right.start || right.end - left.end)) {
    const overlaps = kept.some((existing) => replacement.start < existing.end && existing.start < replacement.end);
    if (!overlaps) {
      kept.push(replacement);
    }
  }
  return kept;
}

function visit(node, parent, onNode) {
  if (!node || typeof node !== "object") {
    return;
  }

  onNode(node, parent);
  for (const key of Object.keys(node)) {
    if (key === "start" || key === "end" || key === "loc" || key === "range") {
      continue;
    }

    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        visit(item, node, onNode);
      }
      continue;
    }
    visit(child, node, onNode);
  }
}

function encodeString(value) {
  const codes = [];
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code > 255) {
      throw new Error(`Protected string is not byte-sized: ${value}`);
    }
    codes.push((code ^ ((91 + index * 37) & 255)).toString(16).padStart(2, "0"));
  }
  return codes.join("");
}

function uniqueNames(code) {
  for (let index = 0; index < 1000; index += 1) {
    const suffix = index.toString(36);
    const names = {
      table: `_0xp${suffix}a`,
      cache: `_0xp${suffix}b`,
      decode: `_0xp${suffix}c`,
      index: `_0xp${suffix}d`,
      hex: `_0xp${suffix}e`,
      offset: `_0xp${suffix}f`
    };
    if (Object.values(names).every((name) => !code.includes(name))) {
      return names;
    }
  }
  throw new Error("Could not find unique frontend protection symbol names.");
}

function findStringLiteralLeaks(code, values) {
  const valueSet = new Set(values);
  const ast = acorn.parse(code, {
    ecmaVersion: "latest",
    sourceType: "script"
  });
  const leaks = new Set();
  visit(ast, null, (node) => {
    if (node.type === "Literal" && typeof node.value === "string" && valueSet.has(node.value)) {
      leaks.add(node.value);
    }
    if (node.type === "TemplateElement" && typeof node.value?.cooked === "string" && valueSet.has(node.value.cooked)) {
      leaks.add(node.value.cooked);
    }
  });
  return [...leaks];
}
