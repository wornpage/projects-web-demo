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
import constants from "../server/src/constants.js";
import security from "../server/src/security.js";
import seed from "../server/src/seed.js";
import validation from "../server/src/validation.js";
import demoPacks from "../data/demo-packs.json";

seed.setSeedPacksSource(demoPacks);

const STORAGE_MODE = "durable-object";

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

// --- Static artifact serving ---

async function staticAssetResponse(request, nodeRequest, url, env) {
  const assetResponse = await env.ASSETS.fetch(request);
  if (!assetResponse.ok) {
    const { shim, response } = nodeResponseCapture();
    server.sendJson(nodeRequest, shim, 404, { error: "Not found" });
    return response;
  }

  const pathname = url.pathname.replace(/\/+$/u, "") || "/";
  const isIndexPage = pathname === "/" || pathname === "/index.html";
  const isLandingPage = pathname === "/landing.html";

  if (isIndexPage || isLandingPage) {
    const html = await assetResponse.text();
    const body = isIndexPage ? server.injectAppApiBase(html) : html;
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
