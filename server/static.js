"use strict";

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PREVIEW_PORT || 5181);
const ROOT_DIR = path.resolve(__dirname, "..");
const publicStaticFiles = new Set([
  "/index.html",
  "/landing.html",
  "/sw.js",
  "/manifest.json",
  "/assets/demo.css",
  "/assets/demo.js",
  "/assets/landing.css",
  "/assets/favicon.png",
  "/data/demo-packs.json"
]);
// Pages that carry the strict content-security-policy header. The landing page
// is script-free but gets the same policy so it's held to the app's bar.
const cspPages = new Set([
  path.join(ROOT_DIR, "index.html"),
  path.join(ROOT_DIR, "landing.html")
]);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

const securityHeaders = {
  "cache-control": "no-store",
  "clear-site-data": "\"cookies\"",
  "cross-origin-embedder-policy": "require-corp",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "origin-agent-cluster": "?1",
  "permissions-policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  "referrer-policy": "no-referrer",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "x-permitted-cross-domain-policies": "none",
  "x-robots-tag": "noindex, nofollow, noarchive"
};

const server = http.createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    sendText(response, 405, "Method not allowed", { "allow": "GET, HEAD" });
    return;
  }

  try {
    const file = await resolveFile(request.url || "/");
    const sendsCsp = cspPages.has(path.resolve(file));
    response.writeHead(200, {
      ...securityHeaders,
      ...(sendsCsp ? { "content-security-policy": contentSecurityPolicy() } : {}),
      "content-type": file.endsWith(path.sep + "manifest.json") ? "application/manifest+json" : (contentTypes[path.extname(file).toLowerCase()] || "application/octet-stream")
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    fs.createReadStream(file).pipe(response);
  } catch (error) {
    const status = Number(error.statusCode || 500);
    sendText(response, status, status === 404 ? "Not found" : "Preview server error");
    if (status >= 500) {
      console.error(error);
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Projects demo preview listening at http://${HOST}:${PORT}`);
});

async function resolveFile(rawUrl) {
  const url = requestUrlFor(rawUrl);
  const pathname = normalizePublicStaticPathname(url.pathname);
  if (!isPublicStaticPathname(pathname)) {
    throw httpError(404);
  }

  const file = path.resolve(ROOT_DIR, `.${pathname}`);
  if (!file.startsWith(`${ROOT_DIR}${path.sep}`)) {
    throw httpError(404);
  }

  const stats = await fsp.stat(file).catch(() => null);
  if (!stats) {
    throw httpError(404);
  }

  if (stats.isDirectory()) {
    const indexFile = path.join(file, "index.html");
    const indexStats = await fsp.stat(indexFile).catch(() => null);
    if (indexStats?.isFile()) {
      return indexFile;
    }
    throw httpError(404);
  }

  if (!stats.isFile()) {
    throw httpError(404);
  }

  return file;
}

function requestUrlFor(rawUrl) {
  try {
    return new URL(rawUrl || "/", "http://projects-demo-preview.local");
  } catch {
    throw httpError(400);
  }
}

function normalizePublicStaticPathname(rawPathname) {
  let pathname = "";
  try {
    pathname = decodeURIComponent(rawPathname || "/");
  } catch {
    throw httpError(404);
  }

  if (pathname.includes("\\") || pathname.includes("\0")) {
    throw httpError(404);
  }

  if (!pathname.startsWith("/")) {
    pathname = `/${pathname}`;
  }
  if (pathname.endsWith("/")) {
    pathname += "index.html";
  }

  return path.posix.normalize(pathname);
}

function isPublicStaticPathname(pathname) {
  return publicStaticFiles.has(pathname);
}

function contentSecurityPolicy() {
  return [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "worker-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "font-src 'self'",
    "img-src 'self' data:",
    "media-src 'none'",
    "manifest-src 'self'",
    "connect-src 'self'",
    "form-action 'none'"
  ].join("; ");
}

function sendText(response, statusCode, text, headers = {}) {
  response.writeHead(statusCode, {
    ...securityHeaders,
    ...headers,
    "content-type": "text/plain; charset=utf-8"
  });
  response.end(`${text}\n`);
}

function httpError(statusCode) {
  const error = new Error(`HTTP ${statusCode}`);
  error.statusCode = statusCode;
  return error;
}
