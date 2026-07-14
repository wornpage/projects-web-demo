// Unit tests for the dependency-free Access JWT validator. A throwaway RSA key
// signs tokens; a fake fetch serves the matching JWKS, so no network is used.

import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign as nodeSign } from "node:crypto";

import { accessDenied, verifyAccessJwt, _resetJwksCache } from "./access-jwt.mjs";

const KID = "test-key-1";
const ENV = {
  ACCESS_AUD: "aud-abc123",
  ACCESS_TEAM_DOMAIN: "https://team.cloudflareaccess.com"
};

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = publicKey.export({ format: "jwk" });

// A fake fetch returning our single signing key under KID.
function jwksFetch(keys = [{ ...publicJwk, kid: KID, alg: "RS256", use: "sig" }]) {
  return async () => ({ ok: true, json: async () => ({ keys }) });
}
const deps = { fetch: jwksFetch() };

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

function makeToken({
  iss = ENV.ACCESS_TEAM_DOMAIN,
  aud = ENV.ACCESS_AUD,
  exp = Math.floor(Date.now() / 1000) + 3600,
  kid = KID,
  overridePayload = null
} = {}) {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid }));
  const payload = b64url(JSON.stringify({ iss, aud, exp, iat: Math.floor(Date.now() / 1000) }));
  const signature = nodeSign("RSA-SHA256", Buffer.from(`${header}.${payload}`), privateKey)
    .toString("base64url");
  const body = overridePayload ? b64url(JSON.stringify(overridePayload)) : payload;
  return `${header}.${body}.${signature}`;
}

function request(token) {
  const headers = token ? { "cf-access-jwt-assertion": token } : {};
  return new Request("https://demo.example/", { headers });
}

test.beforeEach(() => _resetJwksCache());

test("accepts a valid token", async () => {
  const payload = await verifyAccessJwt(makeToken(), ENV, deps);
  assert.equal(payload.aud, ENV.ACCESS_AUD);
  assert.equal(payload.iss, ENV.ACCESS_TEAM_DOMAIN);
});

test("accessDenied returns null for a valid token", async () => {
  assert.equal(await accessDenied(request(makeToken()), ENV, {}, deps), null);
});

test("accessDenied 403s when the token is missing", async () => {
  const response = await accessDenied(request(null), ENV, {}, deps);
  assert.equal(response.status, 403);
});

test("reads the token from the CF_Authorization cookie fallback", async () => {
  const req = new Request("https://demo.example/", {
    headers: { cookie: `CF_Authorization=${makeToken()}; other=1` }
  });
  assert.equal(await accessDenied(req, ENV, {}, deps), null);
});

test("rejects a wrong audience", async () => {
  await assert.rejects(verifyAccessJwt(makeToken({ aud: "someone-else" }), ENV, deps), /audience/u);
});

test("rejects a wrong issuer", async () => {
  await assert.rejects(
    verifyAccessJwt(makeToken({ iss: "https://evil.cloudflareaccess.com" }), ENV, deps),
    /issuer/u
  );
});

test("rejects an expired token", async () => {
  await assert.rejects(
    verifyAccessJwt(makeToken({ exp: Math.floor(Date.now() / 1000) - 3600 }), ENV, deps),
    /expired/u
  );
});

test("rejects a tampered payload (signature no longer matches)", async () => {
  const token = makeToken({ overridePayload: { iss: ENV.ACCESS_TEAM_DOMAIN, aud: ENV.ACCESS_AUD, exp: 9999999999, sub: "attacker" } });
  await assert.rejects(verifyAccessJwt(token, ENV, deps), /signature/u);
});

test("rejects an unknown key id", async () => {
  await assert.rejects(verifyAccessJwt(makeToken({ kid: "not-a-real-kid" }), ENV, deps), /unknown kid/u);
});

test("rejects a non-RS256 alg without touching the key set", async () => {
  const header = b64url(JSON.stringify({ alg: "none", typ: "JWT", kid: KID }));
  const payload = b64url(JSON.stringify({ iss: ENV.ACCESS_TEAM_DOMAIN, aud: ENV.ACCESS_AUD }));
  await assert.rejects(verifyAccessJwt(`${header}.${payload}.`, ENV, deps), /alg/u);
});

test("no-ops when Access is not configured", async () => {
  assert.equal(await accessDenied(request(null), {}, {}, deps), null);
  assert.equal(await accessDenied(request(null), { ACCESS_AUD: "only-one" }, {}, deps), null);
});
