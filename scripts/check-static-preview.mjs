#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = await freePort();
const checks = [];
const server = spawn(process.execPath, ["server/static.js"], {
  cwd: repoRoot,
  env: {
    ...process.env,
    HOST: "127.0.0.1",
    PREVIEW_PORT: String(port)
  },
  stdio: ["ignore", "pipe", "pipe"]
});
let stdout = "";
let stderr = "";
server.stdout.on("data", (chunk) => {
  stdout += chunk;
});
server.stderr.on("data", (chunk) => {
  stderr += chunk;
});

try {
  await waitForPreview(port);

  const frontendSource = await fs.readFile(path.join(repoRoot, "assets/demo.js"), "utf8");
  check("static preview frontend avoids runtime inline style setters", !/\.style\b|setAttribute\(\s*["']style/iu.test(frontendSource), "inline style setter absent");

  for (const pathname of [
    "/",
    "/index.html",
    "/assets/demo.js",
    "/assets/demo.css",
    "/assets/favicon.png",
    "/data/demo-packs.json"
  ]) {
    const response = await request(port, pathname);
    check(`static preview public asset allowed: ${pathname}`, response.status === 200, response.status);
    check(`static preview public asset sends shared headers: ${pathname}`, sharedSecurityHeadersOk(response.headers), sharedSecurityHeaderDetail(response.headers));
  }

  const appShell = await request(port, "/");
  const csp = appShell.headers["content-security-policy"] || "";
  check("static preview app shell sends CSP", csp.includes("default-src 'self'") && csp.includes("script-src 'self'") && csp.includes("object-src 'none'"), csp || "missing");
  check("static preview app shell blocks framing", csp.includes("frame-ancestors 'none'") && appShell.headers["x-frame-options"] === "DENY", `${csp || "missing"} / ${appShell.headers["x-frame-options"] || "missing"}`);
  check("static preview app shell limits network calls", csp.includes("connect-src 'self'"), csp || "missing");
  check("static preview style policy avoids unsafe inline styles", styleSrcDirective(csp) === "style-src 'self'", styleSrcDirective(csp) || "missing");
  check("static preview content policy blocks unused loaders", cspBlocksUnusedLoaders(csp), unusedLoaderDirectiveDetail(csp));

  const unexpectedHostShell = await request(port, "/", {
    headers: { "Host": "preview.example" }
  });
  check("static preview unexpected Host header does not affect routing", unexpectedHostShell.status === 200 && /Projects Demo/u.test(unexpectedHostShell.text), unexpectedHostShell.status);

  const unsupportedMethod = await request(port, "/", { method: "POST" });
  check("static preview rejects non-read methods", unsupportedMethod.status === 405 && unsupportedMethod.headers.allow === "GET, HEAD", `${unsupportedMethod.status} / ${unsupportedMethod.headers.allow || "missing"}`);
  check("static preview error responses send shared headers", sharedSecurityHeadersOk(unsupportedMethod.headers), sharedSecurityHeaderDetail(unsupportedMethod.headers));

  for (const pathname of [
    "/README.md",
    "/Dockerfile",
    "/server/server.js",
    "/server/static.js",
    "/server/package-lock.json",
    "/docs/deploy-outplane.md",
    "/.git/config",
    "/assets/../server/server.js",
    "/assets/%2e%2e/server/server.js",
    "/assets/runtime-config.js",
    "/assets/not-allowlisted.txt",
    "/assets/private/demo.js",
    "/data/not-allowlisted.json",
    "/assets/demo.js.map",
    "/assets/demo.css.map"
  ]) {
    const response = await request(port, pathname);
    check(`static preview non-public file blocked: ${pathname}`, response.status === 404, response.status);
  }

  for (const row of checks) {
    console.log(`${row.ok ? "PASS" : "FAIL"} ${row.name}: ${row.detail}`);
  }

  const failed = checks.filter((row) => !row.ok);
  if (failed.length > 0) {
    process.exitCode = 1;
  } else {
    console.log("\nStatic preview check passed.");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  if (stdout.trim()) {
    console.error(stdout.trim());
  }
  if (stderr.trim()) {
    console.error(stderr.trim());
  }
  process.exitCode = 1;
} finally {
  server.kill();
  await new Promise((resolve) => {
    server.once("exit", resolve);
    setTimeout(resolve, 2000);
  });
}

function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail: String(detail ?? "") });
}

async function waitForPreview(activePort) {
  const started = Date.now();
  while (Date.now() - started < 10000) {
    const response = await request(activePort, "/").catch(() => null);
    if (response?.status === 200) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Static preview server did not become ready.");
}

function request(activePort, pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: "127.0.0.1",
      port: activePort,
      path: pathname,
      method: options.method || "GET",
      headers: {
        ...(options.headers || {})
      }
    }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        text += chunk;
      });
      res.on("end", () => {
        resolve({
          status: res.statusCode || 0,
          headers: res.headers,
          text
        });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

function sharedSecurityHeadersOk(headers) {
  return getHeader(headers, "cache-control") === "no-store"
    && getHeader(headers, "referrer-policy") === "no-referrer"
    && getHeader(headers, "x-content-type-options") === "nosniff"
    && getHeader(headers, "x-frame-options") === "DENY"
    && getHeader(headers, "cross-origin-embedder-policy") === "require-corp"
    && getHeader(headers, "cross-origin-resource-policy") === "same-origin"
    && getHeader(headers, "cross-origin-opener-policy") === "same-origin"
    && getHeader(headers, "origin-agent-cluster") === "?1"
    && getHeader(headers, "strict-transport-security") === "max-age=31536000; includeSubDomains"
    && getHeader(headers, "x-permitted-cross-domain-policies") === "none"
    && getHeader(headers, "x-robots-tag") === "noindex, nofollow, noarchive"
    && permissionsPolicyDisables(getHeader(headers, "permissions-policy"), ["camera", "geolocation", "microphone", "payment", "usb"]);
}

function sharedSecurityHeaderDetail(headers) {
  return [
    "cache-control",
    "referrer-policy",
    "x-content-type-options",
    "x-frame-options",
    "cross-origin-embedder-policy",
    "cross-origin-resource-policy",
    "cross-origin-opener-policy",
    "origin-agent-cluster",
    "strict-transport-security",
    "x-permitted-cross-domain-policies",
    "x-robots-tag",
    "permissions-policy"
  ].map((name) => `${name}=${getHeader(headers, name) || "missing"}`).join("; ");
}

function permissionsPolicyDisables(value, features) {
  const policy = String(value || "");
  return features.every((feature) => policy.includes(`${feature}=()`));
}

function getHeader(headers, name) {
  return headers?.[name] || "";
}

function styleSrcDirective(csp) {
  return cspDirective(csp, "style-src");
}

function cspBlocksUnusedLoaders(csp) {
  return cspDirective(csp, "frame-src") === "frame-src 'none'"
    && cspDirective(csp, "worker-src") === "worker-src 'none'"
    && cspDirective(csp, "font-src") === "font-src 'self'"
    && cspDirective(csp, "media-src") === "media-src 'none'"
    && cspDirective(csp, "manifest-src") === "manifest-src 'none'";
}

function unusedLoaderDirectiveDetail(csp) {
  return ["frame-src", "worker-src", "font-src", "media-src", "manifest-src"]
    .map((name) => cspDirective(csp, name) || `${name}=missing`)
    .join("; ");
}

function cspDirective(csp, name) {
  return csp.split(";").map((part) => part.trim()).find((part) => part.startsWith(name)) || "";
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
