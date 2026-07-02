"use strict";

// ---------------------------------------------------------------------------
// Module: seed
// Seed pack loading, default state, scenario/profile/filter actions
// ---------------------------------------------------------------------------

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const constants = require("./constants.js");
const validation = require("./validation.js");
const workflow = require("./workflow.js");

const ROOT_DIR = path.resolve(__dirname, "..", "..");
const SEED_PACKS_FILE = path.join(ROOT_DIR, "data", "demo-packs.json");

async function readSeedPacks() {
  return JSON.parse(await fs.readFile(SEED_PACKS_FILE, "utf8"));
}

async function defaultState() {
  const packs = await readSeedPacks();
  return validation.sanitizeState({
    packs,
    copyProfile: "general",
    scenarioId: "default",
    selectedId: packs[0]?.id || "",
    status: "Demo buttons update work through the backend API.",
    actionReceipt: null,
    filter: "all",
    query: ""
  });
}

async function resetStateAction() {
  const state = await defaultState();
  state.status = "Where: Start. Blocker: None. Next action: review reset backend row.";
  state.actionReceipt = null;
  return { reset: true, state };
}

// --- Pack creation ---

function createPackFromPayload(state, payload) {
  if (state.packs.length >= constants.MAX_STATE_PACKS) {
    throw validation.httpError(400, `Demo state cannot contain more than ${constants.MAX_STATE_PACKS} work items.`);
  }

  const source = validation.workflowPayloadObject(payload);
  const values = createPackValues(source);
  const initialWorkflow = initialWorkflowForCreatedPack(values.title, values.owner, values.next);
  if (!initialWorkflow.canSave) {
    throw validation.httpError(400, initialWorkflow.help);
  }

  const pack = validation.sanitizePack({
    id: uniquePackId(state.packs, slugify(values.title || "sample-work")),
    title: values.title,
    type: validation.workflowTextField(source, "type", 80) || state.copyProfile || "general",
    status: initialWorkflow.status,
    blocker: initialWorkflow.blocker,
    next: values.next,
    due: values.due,
    owner: values.owner,
    purpose: values.purpose || "Work created in the backend demo.",
    doneWhen: values.doneWhen || "Result is described.",
    sources: validation.workflowStringArrayField(source, "sources", 50, 200),
    memory: validation.workflowStringArrayField(source, "memory", 100, 2000),
    activity: ["Created through backend API."]
  });

  if (pack.sources.length === 0) {
    pack.sources = ["backend-state"];
  }
  state.packs.unshift(pack);
  state.selectedId = pack.id;
  const next = workflow.resolvePrimaryCommandForPack(pack);
  const receipt = workflow.actionReceiptForPack(
    pack,
    `Created ${workflow.workTitle(pack)}. State: ${workflow.workflowStateForPack(pack, next).label}. Blocker: ${workflow.blockerTextForPack(pack)}. Next action: ${next.label}.`,
    next
  );
  state.status = receipt.summary;
  state.actionReceipt = receipt;
  return {
    created: true,
    pack: validation.sanitizePack(pack),
    receipt,
    state: validation.sanitizeState(state)
  };
}

function createPackValues(source) {
  return {
    title: validation.workflowTextField(source, "title", 200),
    owner: validation.workflowTextField(source, "owner", 120),
    next: validation.workflowTextField(source, "next", 120),
    due: validation.workflowTextField(source, "due", 40),
    purpose: validation.workflowTextField(source, "purpose", 1000),
    doneWhen: validation.workflowTextField(source, "doneWhen", 1000)
  };
}

function initialWorkflowForCreatedPack(title, owner, next) {
  if (!validation.normalizeText(title, 200)) {
    return createBlockedWorkflow("missing title", "Fill title");
  }
  if (validation.isPlaceholderNext(next)) {
    return createBlockedWorkflow("missing next action", "Choose next action");
  }
  if (isMissingOwnerValue(owner)) {
    return createBlockedWorkflow("missing owner", "Fill owner");
  }
  return {
    status: "active",
    blocker: constants.DEMO_BLOCKER_NONE,
    canSave: true,
    help: "Where: Create. Blocker: None. Next action: save work."
  };
}

function createBlockedWorkflow(blocker, next) {
  return {
    status: "draft",
    blocker,
    canSave: false,
    help: `Where: Create. Blocker: ${blocker}. Next action: ${next}.`
  };
}

function isMissingOwnerValue(value) {
  return !validation.normalizeText(value, 120) || validation.normalizeText(value, 120).toLowerCase() === "no owner" || validation.normalizeText(value, 120).toLowerCase() === "unowned";
}

function slugify(value) {
  return validation.normalizeText(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "") || "sample-work";
}

function uniquePackId(packs, seed) {
  let candidate = seed;
  let suffix = 1;
  while (packs.some((pack) => pack.id === candidate)) {
    candidate = `${seed}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

// --- Browser state ---

function browserStatePayload(payload, currentState = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw validation.httpError(400, "Browser state write must be a JSON object.");
  }
  if (payload.kind !== "projects-browser-state-v1") {
    throw validation.httpError(400, "Browser state write kind is not supported.");
  }
  if (!payload.state || typeof payload.state !== "object" || Array.isArray(payload.state)) {
    throw validation.httpError(400, "Browser state write must include a state object.");
  }
  validateStatePayload(payload.state);
  return {
    ...currentState,
    packs: payload.state.packs,
    filter: payload.state.filter,
    selectedId: payload.state.selectedId,
    status: currentState.status || "",
    actionReceipt: null,
    query: ""
  };
}

function validateStatePayload(payload, options = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw validation.httpError(400, "Demo state must be a JSON object.");
  }

  validateStateMetadata(payload);
  validateStateTextFields(payload);
  const packIds = validateStatePacks(payload.packs, options);
  validateSelectedPackId(payload.selectedId, packIds, options);
  validateActionReceipt(payload);
}

function validateStateMetadata(payload) {
  const text = validation.normalizeText(payload.kind, 80);
  if (text !== "projects-browser-state-v1") {
    const version = validation.normalizeText(payload.version, 20);
    if (version) {
      throw validation.httpError(400, "Demo state schema is not supported.");
    }
  }
  validateStateMetadataValue(payload, "copyProfile", 40, constants.VALID_COPY_PROFILES, "Demo state copy profile is not supported.");
  validateStateMetadataValue(payload, "scenarioId", 80, constants.VALID_SCENARIOS, "Demo state scenario is not supported.");
  validateStateMetadataValue(payload, "filter", 40, constants.VALID_STATE_FILTERS, "Demo state filter is not supported.");
}

function validateStateMetadataValue(payload, key, maxLength, validValues, message) {
  if (!Object.prototype.hasOwnProperty.call(payload, key)) {
    return;
  }
  if (typeof payload[key] !== "string") {
    throw validation.httpError(400, `Demo state ${key} must be text.`);
  }
  const value = validation.normalizeText(payload[key], maxLength);
  if (!value || !validValues.has(value)) {
    throw validation.httpError(400, message);
  }
}

function validateStateTextFields(payload) {
  validateStateTextField(payload, "status", 1000);
  validateStateTextField(payload, "query", 200);
  validateStateTextField(payload, "savedAt", 80);
}

function validateStateTextField(payload, key, maxLength) {
  if (!Object.prototype.hasOwnProperty.call(payload, key)) {
    return;
  }
  if (typeof payload[key] !== "string") {
    throw validation.httpError(400, `Demo state ${key} must be text.`);
  }
  const value = validation.normalizeText(payload[key], maxLength + 1);
  if (value.length > maxLength) {
    throw validation.httpError(400, `Demo state ${key} cannot be more than ${maxLength} characters.`);
  }
}

function validateStatePacks(packs, options) {
  if (!Array.isArray(packs)) {
    throw validation.httpError(400, "Demo state packs must be an array.");
  }
  if (!options.allowEmptyPacks && packs.length === 0) {
    throw validation.httpError(400, "Demo state must include at least one work item.");
  }
  if (packs.length > constants.MAX_STATE_PACKS) {
    throw validation.httpError(400, `Demo state cannot contain more than ${constants.MAX_STATE_PACKS} work items.`);
  }

  const ids = [];
  for (let i = 0; i < packs.length; i++) {
    const pack = packs[i];
    if (!pack || typeof pack !== "object" || Array.isArray(pack)) {
      throw validation.httpError(400, "Each demo pack must be a JSON object.");
    }
    const { id, status } = validatePackTextFields(pack);
    if (!constants.VALID_PACK_STATUSES.has(status)) {
      throw validation.httpError(400, "Demo state work items need a valid status.");
    }
    if (ids.includes(id)) {
      throw validation.httpError(400, "Demo state packs cannot share the same ID.");
    }
    validatePackStringArrays(pack);
    ids.push(id);
  }

  validateBlockedByReferences(packs, ids);
  return ids;
}

function validateBlockedByReferences(packs, ids) {
  for (const pack of packs) {
    const blockedBy = validation.normalizeText(pack.blockedBy, 120);
    if (!blockedBy) {
      continue;
    }
    if (!ids.includes(blockedBy)) {
      throw validation.httpError(400, "Demo state work item blockedBy must reference another work item.");
    }
    const packId = validation.normalizeText(pack.id, 120);
    if (blockedBy === packId) {
      throw validation.httpError(400, "Demo state work items cannot be blocked by themselves.");
    }
    if (workflow.createsBlockedByCycle(packs, packId, blockedBy)) {
      throw validation.httpError(400, "Demo state work items cannot block each other in a loop.");
    }
  }
}

function validatePackTextFields(pack) {
  const id = validatePackTextField(pack, "id", 120, true);
  const title = validatePackTextField(pack, "title", 200, true);
  const status = validatePackTextField(pack, "status", 40, true);
  validatePackTextField(pack, "blocker", 200);
  validatePackTextField(pack, "blockedBy", 120);
  validatePackTextField(pack, "next", 200);
  validatePackTextField(pack, "due", 40);
  validatePackTextField(pack, "owner", 120);
  validatePackTextField(pack, "purpose", 1000);
  validatePackTextField(pack, "doneWhen", 1000);
  validatePackTextField(pack, "signature", 80);
  return { id, title, status };
}

function validatePackTextField(pack, key, maxLength, required = false) {
  if (!Object.prototype.hasOwnProperty.call(pack, key)) {
    if (required) {
      throw validation.httpError(400, `Demo state work items need ${key} text.`);
    }
    return "";
  }
  if (typeof pack[key] !== "string") {
    throw validation.httpError(400, `Demo state work item ${key} must be text.`);
  }
  const value = validation.normalizeText(pack[key], maxLength + 1);
  if (required && !value) {
    throw validation.httpError(400, `Demo state work items need ${key} text.`);
  }
  if (value.length > maxLength) {
    throw validation.httpError(400, `Demo state work item ${key} cannot be more than ${maxLength} characters.`);
  }
  return value;
}

function validatePackStringArrays(pack) {
  validatePackStringArray(pack, "sources", 50, 200);
  validatePackStringArray(pack, "memory", 100, 2000);
  validatePackStringArray(pack, "activity", 100, 400);
}

function validatePackStringArray(pack, key, maxItems, maxLength) {
  if (!Object.prototype.hasOwnProperty.call(pack, key)) {
    return;
  }
  if (!Array.isArray(pack[key])) {
    throw validation.httpError(400, `Demo state work item ${key} must be a text array.`);
  }
  if (pack[key].length > maxItems) {
    throw validation.httpError(400, `Demo state work item ${key} cannot contain more than ${maxItems} entries.`);
  }
  for (const entry of pack[key]) {
    if (typeof entry !== "string") {
      throw validation.httpError(400, `Demo state work item ${key} entries must be text.`);
    }
    const normalized = validation.normalizeText(entry, maxLength + 1);
    if (!normalized || normalized.length > maxLength) {
      throw validation.httpError(400, `Demo state work item ${key} entries must be nonblank text up to ${maxLength} characters.`);
    }
  }
}

function validateSelectedPackId(selectedId, packIds, options) {
  if (!selectedId) {
    if (options.allowEmptyPacks) {
      return;
    }
    throw validation.httpError(400, "Demo state selected work is required.");
  }
  if (!packIds.includes(selectedId)) {
    throw validation.httpError(400, "Demo state selected work is not in the packs list.");
  }
}

function validateActionReceipt(payload) {
  if (!Object.prototype.hasOwnProperty.call(payload, "actionReceipt") || payload.actionReceipt === null) {
    return;
  }
  const receipt = payload.actionReceipt;
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    throw validation.httpError(400, "Demo state action receipt must be an object.");
  }
  validation.validatePlainValueShape(receipt);
}

// --- Copy / sync ---

function copyStateToSyncAction(currentState, payload) {
  const source = validation.workflowPayloadObject(payload);
  const targetClientId = validation.workflowTextField(source, "targetClientId", 70, { required: true });
  if (!validation.normalizeText(targetClientId, 70).startsWith("sync-")) {
    throw validation.httpError(400, "Demo sync target is not supported.");
  }

  const state = validation.sanitizeState({
    ...currentState,
    status: "Where: Sync code. Blocker: None. Next action: use code on another device.",
    actionReceipt: null,
    query: ""
  });
  return { copied: true, targetClientId, state };
}

// --- Filters ---

function saveStateFilterAction(state, payload) {
  const source = validation.workflowPayloadObject(payload);
  const filter = validation.workflowTextField(source, "filter", 40, { required: true });
  if (!constants.VALID_STATE_FILTERS.has(filter)) {
    throw validation.httpError(400, "Demo state filter is not supported.");
  }

  state.filter = filter;
  state.status = filterStatusMessageForState(state, filter);
  state.actionReceipt = null;
  return { filter, state };
}

function saveStateSelectedAction(state, payload) {
  const source = validation.workflowPayloadObject(payload);
  const selectedId = validation.workflowTextField(source, "selectedId", 120, { required: true });
  if (!state.packs.some((pack) => pack.id === selectedId)) {
    throw validation.httpError(400, "Demo selected work is not available.");
  }

  state.selectedId = selectedId;
  state.actionReceipt = null;
  return { selectedId, state };
}

// --- Profiles ---

function saveStateProfileAction(state, payload) {
  const source = validation.workflowPayloadObject(payload);
  const profile = validation.workflowTextField(source, "profile", 40, { required: true });
  const sourceLabel = validation.workflowTextField(source, "source", 40) || "Start";
  if (!constants.VALID_COPY_PROFILES.has(profile)) {
    throw validation.httpError(400, "Demo state copy profile is not supported.");
  }

  state.copyProfile = profile;
  state.status = profileStatusMessage(profile, sourceLabel);
  state.actionReceipt = null;
  return { profile, state };
}

function profileStatusMessage(profile, sourceLabel) {
  const label = capitalizeText(profile);
  const work = stateWorkLabel(profile);
  return `Where: ${sourceLabel}. Blocker: None. Next action: use ${label} copy labels for ${work}.`;
}

function stateWorkLabel(profile) {
  const labels = {
    climate: "site check",
    developer: "task",
    dj: "gig",
    finance: "close item",
    general: "work"
  };
  return labels[profile] || labels.general;
}

function capitalizeText(value) {
  const text = validation.normalizeText(value, 40);
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : "";
}

// --- Scenarios ---

async function saveStateScenarioAction(currentState, payload) {
  const source = validation.workflowPayloadObject(payload);
  const scenarioId = validation.workflowTextField(source, "scenarioId", 80, { required: true });
  const preserveProfile = workflowBooleanField(source, "preserveProfile");
  if (!constants.VALID_SCENARIOS.has(scenarioId)) {
    throw validation.httpError(400, "Demo state scenario is not supported.");
  }

  const scenario = stateScenarioDefinition(scenarioId);
  const basePacks = await readSeedPacks();
  const packs = scenarioStatePacks(scenarioId, basePacks).map(validation.sanitizePack);
  const copyProfile = preserveProfile
    ? currentState.copyProfile
    : scenario.profile || currentState.copyProfile || "general";
  const state = validation.sanitizeState({
    ...currentState,
    packs,
    copyProfile,
    scenarioId,
    selectedId: packs[0]?.id || "",
    status: `Where: Start. Blocker: None. Next action: review ${scenario.label} scenario.`,
    actionReceipt: null,
    filter: scenario.filter || "all",
    query: ""
  });

  return { scenarioId, state };
}

function stateScenarioDefinition(scenarioId) {
  const definitions = {
    default: { label: "Default", profile: "general", filter: "all" },
    review: { label: "Review-first", profile: "developer", filter: "review" },
    healthy: { label: "Healthy queue", profile: "general", filter: "active" },
    onboarding: { label: "Onboarding", profile: "climate", filter: "all" },
    "due-view": { label: "Due today", profile: "general", filter: "active" },
    empty: { label: "Empty state", profile: "general", filter: "all" }
  };
  return definitions[scenarioId] || definitions.default;
}

function scenarioStatePacks(scenarioId, basePacks) {
  const packs = Array.isArray(basePacks) ? structuredClone(basePacks) : [];
  if (scenarioId === "review") {
    return packs.map(reviewScenarioPack);
  }
  if (scenarioId === "healthy") {
    return packs.map(healthyScenarioPack);
  }
  if (scenarioId === "onboarding") {
    return packs
      .slice()
      .sort((left, right) => validation.normalizeText(left.title, 200).localeCompare(validation.normalizeText(right.title, 200)))
      .slice(0, 5)
      .map(onboardingScenarioPack);
  }
  if (scenarioId === "due-view") {
    return packs.map(dueTodayScenarioPack);
  }
  if (scenarioId === "empty") {
    return [];
  }
  return packs;
}

function reviewScenarioPack(pack) {
  if (pack.status === "done") {
    return pack;
  }
  if (workflow.isMissingNextAction(pack)) {
    return {
      ...pack,
      blocker: "missing next action",
      next: "",
      status: "draft"
    };
  }
  return {
    ...pack,
    blocker: isUnblockedBlockerValue(pack.blocker) ? "Needs review context" : pack.blocker,
    next: "Review",
    status: "blocked"
  };
}

function healthyScenarioPack(pack) {
  if (pack.status === "done") {
    return pack;
  }
  return {
    ...pack,
    blocker: constants.DEMO_BLOCKER_NONE,
    blockedBy: "",
    next: validation.isPlaceholderNext(pack.next) ? "Open" : pack.next,
    status: pack.status === "draft" ? "active" : pack.status
  };
}

function onboardingScenarioPack(pack) {
  return {
    ...pack,
    owner: pack.owner === "No owner" ? "Owner pending" : pack.owner
  };
}

function dueTodayScenarioPack(pack) {
  return pack.status === "done"
    ? pack
    : { ...pack, due: todayIsoDate() };
}

function todayIsoDate(date = new Date()) {
  const localTime = date.getTime() - date.getTimezoneOffset() * 60000;
  return new Date(localTime).toISOString().slice(0, 10);
}

function isUnblockedBlockerValue(value) {
  return validation.normalizeStoredBlocker(value) === constants.DEMO_BLOCKER_NONE;
}

function filterStatusMessageForState(state, filter) {
  const visibleCount = state.packs.filter((pack) => packMatchesFilter(pack, filter)).length;
  return `${stateFilterLabel(filter)} filter applied: ${visibleCount} ${stateWorkNoun(state, visibleCount)} visible.`;
}

function packMatchesFilter(pack, filter) {
  return filter === "all"
    || (filter === "review" && isReviewPack(pack))
    || pack.status === filter;
}

function isReviewPack(pack) {
  return workflow.hasBlocker(pack) || workflow.isMissingNextAction(pack) || workflow.commandActionForLabel(pack?.next).action === "review";
}

function stateFilterLabel(filter) {
  const labels = {
    active: "Active",
    all: "All",
    blocked: "Blocked",
    done: "Done",
    draft: "Draft",
    review: "Needs review"
  };
  return labels[filter] || "All";
}

function stateWorkNoun(state, count) {
  const work = state.copyProfile === "climate" ? "action" : "work item";
  return count === 1 ? work : `${work}s`;
}

function workflowBooleanField(source, key) {
  if (!Object.prototype.hasOwnProperty.call(source, key)) {
    return false;
  }
  if (typeof source[key] !== "boolean") {
    throw validation.httpError(400, `Workflow ${key} must be true or false.`);
  }
  return source[key];
}

module.exports = {
  readSeedPacks,
  defaultState,
  resetStateAction,
  createPackFromPayload,
  browserStatePayload,
  copyStateToSyncAction,
  saveStateFilterAction,
  saveStateSelectedAction,
  saveStateProfileAction,
  saveStateScenarioAction,
  validateStatePayload
};
