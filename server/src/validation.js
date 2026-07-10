"use strict";

// ---------------------------------------------------------------------------
// Module: validation
// Pure validation helpers with no I/O
// ---------------------------------------------------------------------------

const constants = require("./constants.js");
const rules = require("./workflow-rules.js");

// The pure text/blocker normalizers live in the shared workflow-rules module so
// the static client and this backend stay byte-identical. Re-export them here
// under their existing names so the rest of server/src is unchanged.
const normalizeText = rules.normalizeText;

function normalizeStringArray(value, maxItems, maxLength) {
  return Array.isArray(value)
    ? value.slice(0, maxItems).map((item) => normalizeText(item, maxLength)).filter(Boolean)
    : [];
}

function workflowPayloadObject(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw httpError(400, "Workflow request must be a JSON object.");
  }
  return payload;
}

function workflowTextField(source, key, maxLength, options = {}) {
  if (!Object.prototype.hasOwnProperty.call(source, key)) {
    if (options.required) {
      throw httpError(400, `Workflow ${key} is required.`);
    }
    return "";
  }
  if (typeof source[key] !== "string") {
    throw httpError(400, `Workflow ${key} must be text.`);
  }

  const value = normalizeText(source[key], maxLength + 1);
  if (options.required && !value) {
    throw httpError(400, `Workflow ${key} is required.`);
  }
  if (value.length > maxLength) {
    throw httpError(400, `Workflow ${key} cannot be more than ${maxLength} characters.`);
  }
  return value;
}

function workflowStringArrayField(source, key, maxItems, maxLength) {
  if (!Object.prototype.hasOwnProperty.call(source, key)) {
    return [];
  }
  if (!Array.isArray(source[key])) {
    throw httpError(400, `Workflow ${key} must be a text array.`);
  }
  if (source[key].length > maxItems) {
    throw httpError(400, `Workflow ${key} cannot contain more than ${maxItems} entries.`);
  }

  return source[key].map((entry) => {
    if (typeof entry !== "string") {
      throw httpError(400, `Workflow ${key} entries must be text.`);
    }
    const normalized = normalizeText(entry, maxLength + 1);
    if (!normalized || normalized.length > maxLength) {
      throw httpError(400, `Workflow ${key} entries must be nonblank text up to ${maxLength} characters.`);
    }
    return normalized;
  });
}

const isPlaceholderNext = rules.isPlaceholderNext;
const normalizeLegacyBlockerCopy = rules.normalizeLegacyBlockerCopy;
const normalizeStoredBlocker = rules.normalizeStoredBlocker;

function sanitizePack(source) {
  return {
    id: normalizeText(source.id, 120),
    title: normalizeText(source.title, 200),
    purpose: normalizeText(source.purpose, 1000),
    status: normalizeText(source.status, 40) || "active",
    blocker: normalizeStoredBlocker(source.blocker),
    blockedBy: normalizeText(source.blockedBy, 120),
    next: normalizeText(source.next, 200),
    doneWhen: normalizeText(source.doneWhen, 1000),
    owner: normalizeText(source.owner, 120),
    due: normalizeText(source.due, 40),
    type: normalizeText(source.type, 40),
    energy: ["low", "medium", "high"].includes(source.energy) ? source.energy : "",
    milestone: normalizeText(source.milestone, 200),
    location: normalizeText(source.location, 200),
    progress: normalizePackProgress(source.progress),
    reactions: normalizePackReactions(source.reactions),
    subtasks: normalizePackSubtasks(source.subtasks),
    sources: normalizeStringArray(source.sources, 50, 200),
    memory: normalizeStringArray(source.memory, 100, 2000),
    activity: normalizeStringArray(source.activity, 100, 400),
    signature: normalizeText(source.signature, 80)
  };
}

function normalizePackProgress(value) {
  const progress = Number(value);
  if (!Number.isFinite(progress)) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round(progress)));
}

function normalizePackSubtasks(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .slice(0, 50)
    .map((entry) => ({
      text: normalizeText(entry && typeof entry === "object" ? entry.text : "", 200),
      done: Boolean(entry && typeof entry === "object" && entry.done)
    }))
    .filter((entry) => entry.text);
}

function normalizePackReactions(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const reactions = {};
  for (const [key, count] of Object.entries(value).slice(0, 8)) {
    const emoji = normalizeText(key, 8);
    const total = Number(count);
    if (emoji && Number.isFinite(total) && total > 0) {
      reactions[emoji] = Math.min(9999, Math.round(total));
    }
  }
  return reactions;
}

function sanitizePlainObject(value, depth = 0) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  if (depth >= constants.MAX_PLAIN_VALUE_DEPTH) {
    return null;
  }

  return Object.fromEntries(
    Object.entries(value)
      .slice(0, constants.MAX_PLAIN_OBJECT_KEYS)
      .map(([k, v]) => [normalizeText(k, 80), sanitizePlainValue(v, depth + 1)])
      .filter(([k]) => k)
  );
}

function sanitizePlainValue(value, depth = 0) {
  if (Array.isArray(value)) {
    if (depth >= constants.MAX_PLAIN_VALUE_DEPTH) {
      return null;
    }
    return value.slice(0, constants.MAX_PLAIN_ARRAY_ITEMS).map((entry) => sanitizePlainValue(entry, depth + 1));
  }

  if (value && typeof value === "object") {
    return sanitizePlainObject(value, depth);
  }

  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return value;
  }

  return normalizeText(value, 2000);
}

function validatePlainValueShape(value, depth = 0) {
  if (typeof value === "string") {
    const normalized = normalizeText(value, 2001);
    if (normalized.length > 2000) {
      throw httpError(400, "Action receipt text cannot be more than 2000 characters.");
    }
    return;
  }

  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return;
  }

  if (depth >= constants.MAX_PLAIN_VALUE_DEPTH) {
    throw httpError(400, "Action receipt value is too deeply nested.");
  }

  if (Array.isArray(value)) {
    if (value.length > constants.MAX_PLAIN_ARRAY_ITEMS) {
      throw httpError(400, "Action receipt array cannot have more than 100 items.");
    }
    value.forEach((entry) => validatePlainValueShape(entry, depth + 1));
    return;
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length > constants.MAX_PLAIN_OBJECT_KEYS) {
      throw httpError(400, "Action receipt object cannot have more than 40 keys.");
    }
    Object.values(value).forEach((v) => validatePlainValueShape(v, depth + 1));
    return;
  }

  throw httpError(400, "Action receipt value is not valid.");
}

function sanitizeState(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const packs = Array.isArray(source.packs) ? source.packs.slice(0, constants.MAX_STATE_PACKS).map(sanitizePack).filter((pack) => pack.id) : [];
  clearDanglingBlockedBy(packs);
  const selectedId = normalizeText(source.selectedId, 120);
  return {
    packs,
    copyProfile: normalizeText(source.copyProfile, 40) || "general",
    scenarioId: normalizeText(source.scenarioId, 80) || "default",
    selectedId: packs.some((pack) => pack.id === selectedId) ? selectedId : packs[0]?.id || "",
    status: normalizeText(source.status, 1000),
    actionReceipt: sanitizePlainObject(source.actionReceipt),
    filter: normalizeText(source.filter, 40) || "all",
    query: normalizeText(source.query, 200),
    savedAt: normalizeText(source.savedAt, 80)
  };
}

function clearDanglingBlockedBy(packs) {
  const ids = new Set(packs.map((pack) => pack.id));
  for (const pack of packs) {
    if (pack.blockedBy && (pack.blockedBy === pack.id || !ids.has(pack.blockedBy))) {
      pack.blockedBy = "";
    }
  }
  return packs;
}

function envInteger(name, fallback, min, max) {
  const rawValue = normalizeText(process.env[name], 40);
  if (!rawValue) {
    return fallback;
  }

  if (!/^\d+$/u.test(rawValue)) {
    throw new Error(`${name} must be an integer from ${min} to ${max}.`);
  }

  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}.`);
  }

  return value;
}

function httpError(statusCode, message, detail) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.detail = detail;
  return error;
}

module.exports = {
  normalizeText,
  normalizeStringArray,
  workflowPayloadObject,
  workflowTextField,
  workflowStringArrayField,
  isPlaceholderNext,
  normalizeLegacyBlockerCopy,
  normalizeStoredBlocker,
  sanitizePack,
  sanitizePlainObject,
  sanitizePlainValue,
  validatePlainValueShape,
  sanitizeState,
  clearDanglingBlockedBy,
  envInteger,
  httpError
};
