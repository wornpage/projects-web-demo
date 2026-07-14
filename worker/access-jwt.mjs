// Cloudflare Access JWT validation for the demo Worker — dependency-free.
//
// Cloudflare Access already challenges visitors at the edge, but a request that
// reaches the Worker directly (a misconfiguration, or the raw workers.dev URL if
// the policy is ever scoped to a custom hostname) would otherwise bypass it.
// This is the documented backstop: reject anything without a valid, unexpired
// Access JWT whose `aud` and `iss` match this application.
//   https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
//
// The Cloudflare example uses the `jose` npm package; this Worker deliberately
// bundles no external dependencies (only node:crypto, cloudflare:workers, and
// local modules — even `pg` is aliased to a stub), so verification is done with
// WebCrypto (RSASSA-PKCS1-v1_5 / SHA-256) instead.
//
// Enforcement is a no-op unless BOTH ACCESS_AUD and ACCESS_TEAM_DOMAIN are set,
// so `wrangler dev` and CI (which run without an Access session) are unaffected.
// Set those two variables on the production Worker to turn validation on.

import { webcrypto } from "node:crypto";

// Global crypto in the Workers runtime and Node >= 20; node:crypto's webcrypto
// covers older Node used by the test runner.
const subtle = (globalThis.crypto && globalThis.crypto.subtle) || webcrypto.subtle;

const JWKS_TTL_MS = 60 * 60 * 1000;
const CLOCK_SKEW_S = 60;

// certsUrl -> { keys: Map<kid, CryptoKey>, fetchedAt }. Access rotates signing
// keys, so a cache miss on `kid` forces a refetch even inside the TTL.
const jwksCache = new Map();

export function accessConfigured(env) {
  return Boolean(env && env.ACCESS_AUD && env.ACCESS_TEAM_DOMAIN);
}

// Returns a 403 Response when Access validation is enabled and the request has
// no valid Access JWT; returns null when the request is allowed (valid token, or
// validation not configured). `headers` are merged into the 403 (e.g. the app's
// security headers).
export async function accessDenied(request, env, headers = {}, deps = {}) {
  if (!accessConfigured(env)) {
    return null;
  }
  const token = readToken(request);
  if (!token) {
    return forbid("Missing Cloudflare Access token.", headers);
  }
  try {
    await verifyAccessJwt(token, env, deps);
    return null;
  } catch {
    return forbid("Invalid Cloudflare Access token.", headers);
  }
}

// Verifies signature and claims. Resolves with the decoded payload, throws on
// any failure. Exported for unit testing.
export async function verifyAccessJwt(token, env, deps = {}) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("malformed token");
  }
  const [headerB64, payloadB64, signatureB64] = parts;
  const header = JSON.parse(decodeSegment(headerB64));
  if (header.alg !== "RS256") {
    throw new Error("unexpected alg");
  }

  const key = await keyForKid(env, header.kid, deps);
  const signed = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlToBytes(signatureB64);
  const validSignature = await subtle.verify("RSASSA-PKCS1-v1_5", key, signature, signed);
  if (!validSignature) {
    throw new Error("bad signature");
  }

  const payload = JSON.parse(decodeSegment(payloadB64));
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp + CLOCK_SKEW_S < now) {
    throw new Error("expired");
  }
  if (typeof payload.nbf === "number" && payload.nbf - CLOCK_SKEW_S > now) {
    throw new Error("not yet valid");
  }
  if (payload.iss !== env.ACCESS_TEAM_DOMAIN) {
    throw new Error("bad issuer");
  }
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(env.ACCESS_AUD)) {
    throw new Error("bad audience");
  }
  return payload;
}

function forbid(message, headers) {
  return new Response(message, {
    status: 403,
    headers: { ...headers, "content-type": "text/plain; charset=utf-8" }
  });
}

function readToken(request) {
  // Prefer the header: the CF_Authorization cookie is not guaranteed to be
  // forwarded, per Cloudflare's guidance.
  const assertion = request.headers.get("cf-access-jwt-assertion");
  if (assertion) {
    return assertion.trim();
  }
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/(?:^|;\s*)CF_Authorization=([^;]+)/u);
  return match ? decodeURIComponent(match[1]) : "";
}

async function keyForKid(env, kid, deps) {
  if (!kid) {
    throw new Error("missing kid");
  }
  const certsUrl = `${env.ACCESS_TEAM_DOMAIN.replace(/\/+$/u, "")}/cdn-cgi/access/certs`;
  let entry = jwksCache.get(certsUrl);
  const fresh = entry && Date.now() - entry.fetchedAt < JWKS_TTL_MS;
  if (!entry || !fresh || !entry.keys.has(kid)) {
    entry = await loadJwks(certsUrl, deps);
    jwksCache.set(certsUrl, entry);
  }
  const key = entry.keys.get(kid);
  if (!key) {
    throw new Error("unknown kid");
  }
  return key;
}

async function loadJwks(certsUrl, deps) {
  const fetchImpl = deps.fetch || globalThis.fetch;
  const response = await fetchImpl(certsUrl, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!response.ok) {
    throw new Error(`jwks fetch failed: ${response.status}`);
  }
  const body = await response.json();
  const keys = new Map();
  for (const jwk of body.keys || []) {
    if (jwk.kty !== "RSA" || !jwk.kid) {
      continue;
    }
    const key = await subtle.importKey(
      "jwk",
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    keys.set(jwk.kid, key);
  }
  return { keys, fetchedAt: Date.now() };
}

function decodeSegment(segment) {
  return new TextDecoder().decode(base64UrlToBytes(segment));
}

function base64UrlToBytes(segment) {
  const base64 = segment.replace(/-/gu, "+").replace(/_/gu, "/")
    .padEnd(Math.ceil(segment.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Test seam: reset the module-level JWKS cache between cases.
export function _resetJwksCache() {
  jwksCache.clear();
}
