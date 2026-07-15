// Cloudflare Workers entry for the Projects web demo backend ("app mode").
//
// Parity is structural, not duplicated: API requests run through the exact
// routeRequest from server/server.js via small node:http request/response
// shims. Only the pieces the Workers runtime cannot provide are swapped —
// state lives in one Durable Object per demo client instead of a file or
// Postgres, seed packs come from the bundled JSON instead of disk, and the
// protected static artifact (dist/static-publish) is served by the ASSETS
// binding instead of fs streams.

import { DurableObject } from "cloudflare:workers";
import crypto from "node:crypto";

import server from "../server/server.js";
import ssr from "../server/src/render-html.js";
import constants from "../server/src/constants.js";
import security from "../server/src/security.js";
import seed from "../server/src/seed.js";
import validation from "../server/src/validation.js";
import demoPacks from "../data/demo-packs.json";
import { accessDenied } from "./access-jwt.mjs";

seed.setSeedPacksSource(demoPacks);

const STORAGE_MODE = "durable-object";

// Edge-level AI-crawler block. User-agent matching is the only signal the free
// Workers plan gives us (bot-management/verified-bots are paid), so we mirror
// the well-known scraper/LLM-training tokens and reject them before any routing
// runs. See https://www.openshadow.io/guides/blocking-ai-bots-cloudflare-workers.
// Substring, case-insensitive: these tokens don't collide with real browser UAs.
const BLOCKED_AI_BOT_UAS = new RegExp([
  "GPTBot", "ChatGPT-User", "OAI-SearchBot",
  "ClaudeBot", "Claude-Web", "anthropic-ai", "Claude-SearchBot", "Claude-User",
  "Google-Extended", "Applebot-Extended",
  "Bytespider", "CCBot", "PerplexityBot", "Perplexity-User",
  "Diffbot", "ImagesiftBot", "omgili", "Amazonbot", "YouBot",
  "cohere-ai", "Meta-ExternalAgent", "Meta-ExternalFetcher", "FacebookBot",
  "Timpibot", "DataForSeoBot", "Scrapy", "AI2Bot"
].join("|"), "iu");

// Served to every client (even the blocked bots, which run the block first for
// everything else) so cooperative crawlers see an explicit policy.
const ROBOTS_TXT = [
  "User-agent: GPTBot",
  "User-agent: ChatGPT-User",
  "User-agent: OAI-SearchBot",
  "User-agent: ClaudeBot",
  "User-agent: anthropic-ai",
  "User-agent: Claude-Web",
  "User-agent: Google-Extended",
  "User-agent: Applebot-Extended",
  "User-agent: Bytespider",
  "User-agent: CCBot",
  "User-agent: PerplexityBot",
  "User-agent: Amazonbot",
  "User-agent: cohere-ai",
  "User-agent: Meta-ExternalAgent",
  "Disallow: /",
  "",
  "User-agent: *",
  "Allow: /",
  ""
].join("\n");

export class DemoStateDurableObject extends DurableObject {
  async readState() {
    return (await this.ctx.storage.get("state")) ?? null;
  }

  async writeState(state) {
    await this.ctx.storage.put("state", state);
  }

  async eraseState() {
    await this.ctx.storage.delete("state");
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/u, "") || "/";

const denied = await accessDenied(request, env, constants.securityHeaders);
    if (denied) {
      return denied;
    }

    // Robots policy is always readable, ahead of the bot block, so cooperative
    // crawlers can fetch the disallow list.
    if (pathname === "/robots.txt" && (request.method === "GET" || request.method === "HEAD")) {
      return new Response(request.method === "HEAD" ? null : ROBOTS_TXT, {
        status: 200,
        headers: {
          ...constants.securityHeaders,
          "content-type": "text/plain; charset=utf-8"
        }
      });
    }

    // Block known AI crawlers/scrapers by user-agent before doing any work.
    if (BLOCKED_AI_BOT_UAS.test(request.headers.get("user-agent") || "")) {
      return new Response("Forbidden", {
        status: 403,
        headers: { ...constants.securityHeaders, "content-type": "text/plain; charset=utf-8" }
      });
    }

    const nodeRequest = await nodeRequestFrom(request, url);

    if (request.method === "OPTIONS") {
      const { shim, response } = nodeResponseCapture();
      if (security.isCorsRequestAllowed(nodeRequest)) {
        server.sendEmpty(nodeRequest, shim, 204);
      } else {
        server.sendEmpty(shim, 403);
      }
      return response;
    }

    if (security.isApiPathname(pathname)) {
      return apiResponse(nodeRequest, url, env);
    }

    if (pathname === constants.RUNTIME_CONFIG_PATHNAME) {
      return new Response(server.runtimeConfigScript(STORAGE_MODE), {
        status: 200,
        headers: {
          ...constants.securityHeaders,
          "content-type": constants.contentTypes[".js"]
        }
      });
    }

    // Turnstile verification — client completes the widget and POSTs the token.
    // The Worker validates it with Cloudflare and sets a cookie.
    if (pathname === "/api/turnstile/verify" && request.method === "POST") {
      return verifyTurnstile(request, env);
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      const { shim, response } = nodeResponseCapture();
      server.sendJson(nodeRequest, shim, 404, { error: "Not found" });
      return response;
    }

    return staticAssetResponse(request, nodeRequest, url, env);
  }
};

// --- API routing through the shared Node handler ---

async function apiResponse(nodeRequest, url, env) {
  nodeRequest._requestId = crypto.randomUUID().slice(0, 8);
  const { shim, response } = nodeResponseCapture();
  try {
    await server.routeRequest(nodeRequest, shim, url, durableObjectStateStorage(env));
  } catch (error) {
    const status = Number(error.statusCode || 500);
    const payload = {
      error: status >= 500 ? "Internal server error" : error.message,
      detail: status >= 500 ? undefined : error.detail
    };
    if (status >= 500) {
      payload.requestId = nodeRequest._requestId;
      server.jsonLog("error", error.message, {
        requestId: nodeRequest._requestId,
        statusCode: status,
        method: nodeRequest.method,
        url: nodeRequest.url,
        stack: error.stack?.split("\n").slice(0, 4).join(" ")
      });
    }
    server.sendJson(nodeRequest, shim, status, payload);
  }
  return response;
}

// --- Durable Object state storage (same contract as file/postgres modes) ---

function durableObjectStateStorage(env) {
  return {
    label: "durable-object:demo-state",
    mode: STORAGE_MODE,
    ready: Promise.resolve(),
    close: async () => {},
    async read(stateKey) {
      const stored = await stubFor(env, stateKey).readState();
      return stored ? validation.sanitizeState(stored) : seed.defaultState();
    },
    async write(payload, stateKey) {
      const state = validation.sanitizeState(payload);
      state.savedAt = new Date().toISOString();
      await stubFor(env, stateKey).writeState(state);
      return state;
    },
    async erase(stateKey) {
      await stubFor(env, stateKey).eraseState();
      return { ok: true, state: await seed.defaultState() };
    },
    defaultState: seed.defaultState
  };
}

function stubFor(env, stateKey) {
  // Same privacy property as file storage's hashed filenames: raw client
  // keys never become storage identifiers.
  const digest = crypto.createHash("sha256")
    .update(validation.normalizeText(stateKey, 120))
    .digest("hex");
  return env.DEMO_STATE.get(env.DEMO_STATE.idFromName(digest));
}


// --- Turnstile verification ---

async function verifyTurnstile(request, env) {
  let body = {};
  try { body = await request.json(); } catch { /* keep empty */ }
  const token = String(body.token || "").trim();
  if (!token) {
    return new Response(JSON.stringify({ ok: false, error: "Missing token" }), {
      status: 400,
      headers: { ...constants.securityHeaders, "content-type": "application/json" }
    });
  }

  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return new Response(JSON.stringify({ ok: false, error: "Turnstile not configured" }), {
      status: 500,
      headers: { ...constants.securityHeaders, "content-type": "application/json" }
    });
  }

  const verify = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret, response: token })
  });

  const result = await verify.json();
  if (!result.success) {
    return new Response(JSON.stringify({ ok: false, error: "Verification failed" }), {
      status: 400,
      headers: { ...constants.securityHeaders, "content-type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      ...constants.securityHeaders,
      "content-type": "application/json",
      "set-cookie": "turnstile_verified=1; Path=/; Max-Age=86400; HttpOnly; Secure; SameSite=Lax"
    }
  });
}

function isTurnstileVerified(request) {
  const cookie = request.headers.get("Cookie") || "";
  return cookie.includes("turnstile_verified=1");
}
// --- Static artifact serving ---

async function staticAssetResponse(request, nodeRequest, url, env) {
  // Fetch the asset with a clean absolute URL — the incoming request's full
  // URL can confuse the ASSETS binding when run_worker_first is true.
  // Build a clean URL from pathname so ASSETS serves the file directly.
  const cleanUrl = new URL(url.pathname + url.search, url.origin).href;
  const assetResponse = await env.ASSETS.fetch(new Request(cleanUrl));
  if (!assetResponse.ok) {
    const { shim, response } = nodeResponseCapture();
    server.sendJson(nodeRequest, shim, 404, { error: "Not found" });
    return response;
  }


  const pathname = url.pathname.replace(/\/+$/u, "") || "/";

  // NOTE: the Turnstile *asset* gate (redirect/403 on demo.js/demo-app.js/
  // demo.css without the turnstile_verified cookie) was removed — it blocked
  // the client bundle from loading for legitimate browsers, leaving only the
  // SSR/static HTML with no JS. The verification endpoint (/api/turnstile/
  // verify) is kept for the client-side gate.

  const isIndexPage = pathname === "/" || pathname === "/index.html";
  const isLandingPage = pathname === "/landing.html";

  if (isIndexPage || isLandingPage) {
    const html = await assetResponse.text();
    let body = isLandingPage ? html : server.injectAppApiBase(html);
    // SSR the index page (parity with server/server.js): render the current
    // route's content into #screen-content using the client's Durable Object
    // state. ?nossr=1 or any failure falls back to the injected empty shell.
    if (isIndexPage && !url.searchParams.has("nossr")) {
      try {
        const stateKey = security.stateKeyForRequest(nodeRequest);
        const serverState = await durableObjectStateStorage(env).read(stateKey);
        const route = (url.searchParams.get("route") || "home").replace(/^#\/?/u, "");
        body = server.injectAppApiBase(ssr.renderPageHtml(serverState, route, html));
      } catch {
        // Keep the injected empty shell — the client renders on hydration.
      }
    }
    return new Response(request.method === "HEAD" ? null : body, {
      status: 200,
      headers: {
        ...constants.securityHeaders,
        "content-security-policy": security.contentSecurityPolicy(),
        "content-type": constants.contentTypes[".html"]
      }
    });
  }

  const headers = new Headers(assetResponse.headers);
  for (const [name, value] of Object.entries(constants.securityHeaders)) {
    headers.set(name, value);
  }
  return new Response(assetResponse.body, {
    status: assetResponse.status,
    statusText: assetResponse.statusText,
    headers
  });
}

// --- node:http shims ---

async function nodeRequestFrom(request, url) {
  const headers = {};
  for (const [name, value] of request.headers) {
    headers[name.toLowerCase()] = value;
  }
  const bodyText = request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS"
    ? ""
    : await request.text();

  return {
    method: request.method,
    url: `${url.pathname}${url.search}`,
    headers,
    socket: {
      remoteFamily: "cf",
      remoteAddress: headers["cf-connecting-ip"] || "unknown"
    },
    async *[Symbol.asyncIterator]() {
      if (bodyText) {
        yield bodyText;
      }
    }
  };
}

function nodeResponseCapture() {
  let settle;
  const response = new Promise((resolve) => {
    settle = resolve;
  });
  const shim = {
    statusCode: 200,
    headers: {},
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      this.headers = headers;
      return this;
    },
    end(body) {
      settle(new Response(body || null, { status: this.statusCode, headers: this.headers }));
    }
  };
  return { shim, response };
}
