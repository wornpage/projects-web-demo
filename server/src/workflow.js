"use strict";

// ---------------------------------------------------------------------------
// Module: workflow
// Pack actions, commands, next action management, memory, paths
// ---------------------------------------------------------------------------

const constants = require("./constants.js");
const validation = require("./validation.js");

// --- Finding packs ---

function findPackOrThrow(state, packId) {
  const pack = state.packs.find((item) => item.id === packId);
  if (!pack) {
    throw validation.httpError(404, `Pack not found: ${packId}`);
  }
  return pack;
}

// --- Pack text helpers ---

function workTitle(pack) {
  return validation.normalizeText(pack?.title, 200) || "Untitled";
}

function blockerTextForPack(pack) {
  return validation.normalizeStoredBlocker(pack?.blocker);
}

function hasBlocker(pack) {
  return validation.normalizeStoredBlocker(pack?.blocker) !== constants.DEMO_BLOCKER_NONE;
}

function isMissingNextAction(pack) {
  return validation.isPlaceholderNext(pack?.next);
}

function proofTargetForPack(pack) {
  const target = validation.normalizeText(pack?.doneWhen, 1000);
  return target || constants.DEMO_PROOF_TARGET_MISSING;
}

function sentenceValue(value) {
  return value || "none listed";
}

function visibleText(text, limit) {
  if (!text) {
    return "";
  }
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, Math.max(1, limit - 3)).trimEnd()}...`;
}

// --- Command resolution ---

function resolvePrimaryCommandForPack(pack) {
  if (isMissingNextAction(pack)) {
    return { label: "Set next action", action: "set-next", targetPackId: pack.id };
  }

  const action = commandActionForLabel(pack.next || "Open");
  if (hasBlocker(pack)) {
    if (action.action === "unblock") {
      return { label: "Set Blocker: None", action: "unblock", targetPackId: pack.id };
    }
    return { label: "Review blocker", action: "review", targetPackId: pack.id };
  }

  return { ...action, targetPackId: pack.id };
}

function commandActionForLabel(label) {
  const value = validation.normalizeText(label || "Open", 120) || "Open";
  const labelLc = value.toLowerCase();

  if (labelLc === "open") {
    return { label: "Open", action: "start" };
  }
  if (labelLc === "start") {
    return { label: "Start", action: "start" };
  }
  if (labelLc === "block") {
    return { label: "Block", action: "block" };
  }
  if (labelLc === "done") {
    return { label: "Done", action: "done" };
  }
  if (labelLc === "review" || labelLc === "needs review") {
    return { label: "Review", action: "review" };
  }
  if (labelLc === "set blocker: none" || labelLc === "unblock") {
    return { label: "Set Blocker: None", action: "unblock" };
  }

  return { label: value, action: "start" };
}

function nextActionDisplayLabel(value) {
  return commandActionForLabel(value || "Open").label;
}

function packCommandPreview(pack) {
  const next = resolvePrimaryCommandForPack(pack);
  const workflow = workflowStateForPack(pack, next);
  const blocker = blockerTextForPack(pack);
  return {
    packId: pack.id,
    signature: packCommandSignature(pack),
    where: workTitle(pack),
    blocker,
    next: next.label,
    action: next.action,
    targetPackId: next.targetPackId,
    stateText: workflow.label,
    stateHelp: workflow.help || "",
    flowHint: selectedFlowHintForPack(pack, next, blocker),
    primaryReason: primaryCommandVisibleReason(pack, next),
    proof: proofTargetForPack(pack)
  };
}

function packCommandSignature(pack) {
  const status = validation.normalizeText(pack?.status, 40) || "unknown";
  const blocker = validation.normalizeStoredBlocker(pack?.blocker);
  const next = validation.normalizeText(pack?.next, 200);
  return `${status}|${blocker}|${next}`;
}

function workflowStateForPack(pack, command = null) {
  const resolved = command || resolvePrimaryCommandForPack(pack);
  if (pack.status === "done") {
    return { label: "Done", help: `Proof is saved for ${workTitle(pack)}.` };
  }
  if (isMissingNextAction(pack)) {
    return { label: "Needs next action", help: "Next action is missing." };
  }
  if (hasBlocker(pack)) {
    return { label: "Blocked", help: `Blocker: ${blockerTextForPack(pack)}.` };
  }
  if (resolved.action === "done") {
    return { label: "Proof ready", help: `Ready to finish with proof: ${proofTargetForPack(pack)}.` };
  }
  if (pack.status === "draft") {
    return { label: "Draft", help: "Work path is still being set." };
  }
  return { label: "Ready", help: `Next action: ${resolved.label}.` };
}

function selectedFlowHintForPack(pack, command = resolvePrimaryCommandForPack(pack), blocker = blockerTextForPack(pack)) {
  const title = workTitle(pack);
  if (isMissingNextAction(pack)) {
    return `Flow: set next action for ${title}.`;
  }

  if (hasBlocker(pack)) {
    const ownerFlow = ownerBlockerFlowHint(pack);
    if (ownerFlow) {
      return ownerFlow;
    }

    return command?.action === "unblock"
      ? `Flow: clear ${blocker || constants.DEMO_BLOCKER_NONE_LABEL} on ${title}.`
      : `Flow: review ${blocker || constants.DEMO_BLOCKER_NONE_LABEL} on ${title}.`;
  }

  return `Flow: run ${command?.label || "Open"} for ${title}.`;
}

function ownerBlockerFlowHint(pack) {
  const blocker = blockerTextForPack(pack).toLowerCase();
  if (!blocker.includes("owner")) {
    return "";
  }

  return isMissingOwnerValue(pack?.owner)
    ? "Flow: fill Owner, then set Blocker: None."
    : "Flow: set Blocker: None.";
}

function isMissingOwnerValue(value) {
  return !validation.normalizeText(value, 120) || validation.normalizeText(value, 120).toLowerCase() === "no owner" || validation.normalizeText(value, 120).toLowerCase() === "unowned";
}

function primaryCommandVisibleReason(pack, command = resolvePrimaryCommandForPack(pack)) {
  if (isMissingNextAction(pack)) {
    return "Why: setup comes first.";
  }

  if (hasBlocker(pack)) {
    return `Why: ${blockerTextForPack(pack)} blocks it.`;
  }

  if (command.action === "done") {
    return "Why: proof is ready.";
  }

  return `Why: no blocker; ${command.label} can run.`;
}

function forwardPathStatusForBlocker(status, blocker, next = "") {
  const normalizedStatus = validation.normalizeText(status, 40) || "active";
  if (normalizedStatus === "done") {
    return "done";
  }
  if (validation.isPlaceholderNext(next)) {
    return "draft";
  }
  if (validation.normalizeStoredBlocker(blocker) !== constants.DEMO_BLOCKER_NONE) {
    return "blocked";
  }
  return "active";
}

// --- Pack actions ---

function packActionSignature(pack) {
  const status = validation.normalizeText(pack?.status, 40) || "unknown";
  const blocker = validation.normalizeStoredBlocker(pack?.blocker);
  const next = validation.normalizeText(pack?.next, 200);
  return `${status}|${blocker}|${next}`;
}

function runPackAction(state, packId, rawAction) {
  const action = validation.workflowTextField({ action: rawAction }, "action", 40, { required: true }).toLowerCase();
  if (!constants.SERVER_PACK_ACTIONS.has(action)) {
    throw validation.httpError(400, `Unsupported pack action: ${action || "missing"}`);
  }

  const pack = findPackOrThrow(state, packId);
  const before = packActionSignature(pack);
  let changed = false;
  let unblockedCount = 0;

  if (action === "start") {
    pack.status = "active";
    pack.blocker = pack.blocker === "missing setup" ? constants.DEMO_BLOCKER_NONE : pack.blocker;
    pack.next = validation.isPlaceholderNext(pack.next) ? "Open" : pack.next;
    changed = packActionSignature(pack) !== before;
    if (changed) {
      addPackActivity(pack, "Started.");
    }
  } else if (action === "unblock") {
    pack.status = "active";
    pack.blocker = constants.DEMO_BLOCKER_NONE;
    pack.next = "Open";
    changed = packActionSignature(pack) !== before;
    if (changed) {
      addPackActivity(pack, "Blocker set to None.");
    }
  } else if (action === "block") {
    pack.status = "blocked";
    pack.blocker = "blocked in this demo";
    pack.next = "Set Blocker: None";
    changed = packActionSignature(pack) !== before;
    if (changed) {
      addPackActivity(pack, "Blocked.");
    }
  } else if (action === "done") {
    const wasDone = pack.status === "done";
    pack.status = "done";
    pack.blocker = constants.DEMO_BLOCKER_NONE;
    pack.blockedBy = "";
    pack.next = "Open";
    changed = packActionSignature(pack) !== before;
    if (changed) {
      addPackActivity(pack, proofSavedActivity(pack));
    }
    unblockedCount = wasDone ? 0 : unblockPacksBlockedBy(state, pack).length;
  } else if (action === "open") {
    changed = addPackActivity(pack, "Opened.");
  }

  state.selectedId = pack.id;
  const next = resolvePrimaryCommandForPack(pack);
  const summary = [packActionSummary(pack, action, actionLabelFromKey(action), changed), unblockedReceiptSentence(unblockedCount)]
    .filter(Boolean)
    .join(" ");
  const receipt = actionReceiptForPack(pack, summary, next);
  state.status = receipt.summary;
  state.actionReceipt = receipt;

  return {
    action,
    pack: validation.sanitizePack(pack),
    receipt,
    state: validation.sanitizeState(state)
  };
}

function actionLabelFromKey(action) {
  const labels = {
    start: "started",
    unblock: "unblocked",
    block: "blocked",
    done: "finished",
    open: "opened"
  };
  return labels[action] || action;
}

function packActionSummary(pack, action, actionLabel, changed) {
  if (!changed) {
    return `${workTitle(pack)}: unchanged (${actionLabel}).`;
  }
  return `${workTitle(pack)} ${actionLabel}.`;
}

function actionReceiptForPack(pack, summary, next) {
  return {
    summary: actionReceiptSummary(summary, pack, next),
    context: actionReceiptContext(pack, next),
    pack
  };
}

function actionReceiptSummary(summary, pack, next) {
  return visibleText(`${summary} ${actionReceiptContext(pack, next)}`, 180);
}

function actionReceiptContext(pack, next) {
  return `Where: ${sentenceValue(workTitle(pack))}. Blocker: ${sentenceValue(blockerTextForPack(pack))}. Next action: ${sentenceValue(next.label)}. Proof target: ${sentenceValue(proofTargetForPack(pack))}.`;
}

// --- Activity ---

function addPackActivity(pack, text) {
  pack.activity = pack.activity || [];
  const entry = `[${new Date().toISOString().replace("T", " ").slice(0, 19)}] ${text}`;
  pack.activity = [...pack.activity.slice(-99), entry];
  return true;
}

function proofSavedActivity(pack) {
  const target = proofTargetForPack(pack);
  return target !== constants.DEMO_PROOF_TARGET_MISSING
    ? `Proof saved: ${target}`
    : "Finished work.";
}

// --- Blocked-by dependencies ---

function blockedByBlockerText(targetPack) {
  return validation.normalizeText(`waiting on ${workTitle(targetPack)}`, 200);
}

function createsBlockedByCycle(packs, packId, targetId) {
  let currentId = targetId;
  for (let hops = 0; hops < packs.length && currentId; hops++) {
    if (currentId === packId) {
      return true;
    }
    currentId = packs.find((pack) => pack.id === currentId)?.blockedBy || "";
  }
  return false;
}

function changePackBlockedByField(state, pack, source, field, label) {
  const value = validation.workflowTextField(source, field, 120);
  if (!value) {
    pack.blockedBy = "";
    return;
  }
  if (value === pack.id) {
    throw validation.httpError(400, "Work cannot be blocked by itself.");
  }
  const target = state.packs.find((candidate) => candidate.id === value);
  if (!target) {
    throw validation.httpError(400, "Workflow blockedBy work item was not found.");
  }
  if (validation.normalizeText(target.status, 40) === "done") {
    throw validation.httpError(400, "Work cannot be blocked by finished work.");
  }
  if (createsBlockedByCycle(state.packs, pack.id, target.id)) {
    throw validation.httpError(400, "Work items cannot block each other in a loop.");
  }
  pack.blockedBy = target.id;
  pack.blocker = blockedByBlockerText(target);
}

function unblockPacksBlockedBy(state, finishedPack) {
  const unblocked = [];
  for (const pack of state.packs) {
    if (pack.id !== finishedPack.id && pack.blockedBy === finishedPack.id) {
      pack.blockedBy = "";
      pack.blocker = constants.DEMO_BLOCKER_NONE;
      pack.status = forwardPathStatusForBlocker(pack.status, constants.DEMO_BLOCKER_NONE, pack.next);
      addPackActivity(pack, `Unblocked: ${workTitle(finishedPack)} finished with proof.`);
      unblocked.push(pack);
    }
  }
  return unblocked;
}

function unblockedReceiptSentence(count) {
  if (!count) {
    return "";
  }
  return `Unblocked ${count} work item${count === 1 ? "" : "s"}.`;
}

// --- Path actions ---

function savePackPathAction(state, packId, payload) {
  const pack = findPackOrThrow(state, packId);
  const source = validation.workflowPayloadObject(payload);
  const before = pathChangeSignature(pack);
  const statusBefore = validation.normalizeText(pack.status, 40);

  for (const [field, label] of constants.FORWARD_PATH_CHANGE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      if (field === "status") {
        changePackStatusField(pack, source, field, label);
      } else if (field === "blocker") {
        changePackBlockerField(pack, source, field, label);
      } else if (field === "blockedBy") {
        changePackBlockedByField(state, pack, source, field, label);
      } else if (field === "next") {
        changePackNextField(pack, source, field, label);
      } else if (field === "due") {
        changePackDueField(pack, source, field, label);
      } else if (field === "doneWhen") {
        changePackDoneWhenField(pack, source, field, label);
      } else if (field === "owner") {
        changePackOwnerField(pack, source, field, label);
      } else if (field === "purpose") {
        changePackPurposeField(pack, source, field, label);
      } else {
        changePackTextField(pack, source, field, label);
      }
    }
  }

  const forwardStatus = forwardPathStatusForBlocker(pack.status, pack.blocker, pack.next);
  if (pack.status === "active" && forwardStatus !== "active") {
    pack.status = forwardStatus;
  } else if (pack.status !== "done" && forwardStatus === "done") {
    pack.status = forwardStatus;
  }

  let unblockedCount = 0;
  if (statusBefore !== "done" && pack.status === "done") {
    pack.blocker = constants.DEMO_BLOCKER_NONE;
    pack.blockedBy = "";
    unblockedCount = unblockPacksBlockedBy(state, pack).length;
  }

  const next = resolvePrimaryCommandForPack(pack);
  const summary = [pathChangeSummary(pack, before, next), unblockedReceiptSentence(unblockedCount)]
    .filter(Boolean)
    .join(" ");
  const receipt = actionReceiptForPack(pack, summary, next);
  state.status = receipt.summary;
  state.actionReceipt = receipt;
  pack.signature = packCommandSignature(pack);

  return {
    saved: true,
    pack: validation.sanitizePack(pack),
    receipt,
    state: validation.sanitizeState(state)
  };
}

function pathChangeSignature(pack) {
  return JSON.stringify({
    title: pack.title,
    status: pack.status,
    blocker: validation.normalizeStoredBlocker(pack.blocker),
    blockedBy: validation.normalizeText(pack.blockedBy, 120),
    owner: pack.owner,
    due: pack.due,
    next: pack.next,
    doneWhen: pack.doneWhen,
    purpose: pack.purpose
  });
}

function pathChangeSummary(pack, beforeSignature, next) {
  const title = workTitle(pack);
  const after = pathChangeSignature(pack);
  if (beforeSignature === after) {
    return `${title}: unchanged.`;
  }
  return `${title}: path updated.`;
}

function changePackStatusField(pack, source, field, label) {
  const value = validation.workflowTextField(source, field, 40, { required: true });
  if (!value || !constants.VALID_PACK_STATUSES.has(value)) {
    throw validation.httpError(400, "Work path status is not supported.");
  }
  pack.status = value;
}

function changePackBlockerField(pack, source, field, label) {
  const value = validation.workflowTextField(source, field, 200);
  if (value) {
    pack.blocker = value;
  }
}

function changePackNextField(pack, source, field, label) {
  const value = validation.workflowTextField(source, field, 200);
  if (value) {
    pack.next = value;
  }
}

function changePackDueField(pack, source, field, label) {
  const value = validation.workflowTextField(source, field, 40);
  if (value) {
    pack.due = value;
  }
}

function changePackDoneWhenField(pack, source, field, label) {
  const value = validation.workflowTextField(source, field, 1000);
  if (value) {
    pack.doneWhen = value;
  }
}

function changePackOwnerField(pack, source, field, label) {
  const value = validation.workflowTextField(source, field, 120);
  if (value) {
    pack.owner = value;
  }
}

function changePackPurposeField(pack, source, field, label) {
  const value = validation.workflowTextField(source, field, 1000);
  if (value) {
    pack.purpose = value;
  }
}

function changePackTextField(pack, source, field, label) {
  const value = validation.workflowTextField(source, field, 200);
  if (value) {
    pack[field] = value;
  }
}

// --- Next action ---

function setPackNextAction(state, packId, rawNext) {
  const pack = findPackOrThrow(state, packId);
  const next = validation.workflowTextField({ next: rawNext || "" }, "next", 200);

  if (next) {
    pack.next = next;
    if (hasBlocker(pack) && pack.blocker === "missing next action") {
      pack.blocker = constants.DEMO_BLOCKER_NONE;
    }
    if (pack.status === "draft" && !hasBlocker(pack)) {
      pack.status = "active";
    }
  }

  const command = resolvePrimaryCommandForPack(pack);
  const receipt = actionReceiptForPack(
    pack,
    `Next action set to "${next || "open"}".`,
    command
  );
  state.status = receipt.summary;
  state.actionReceipt = receipt;

  return {
    saved: true,
    pack: validation.sanitizePack(pack),
    receipt,
    state: validation.sanitizeState(state)
  };
}

// --- Memory ---

function addPackMemoryAction(state, packId, rawNote) {
  const value = validation.workflowTextField({ note: rawNote || "" }, "note", 2000, { required: true });
  const pack = findPackOrThrow(state, packId);
  pack.memory = pack.memory || [];
  const entry = `[${new Date().toISOString().replace("T", " ").slice(0, 19)}] ${value}`;
  pack.memory = [...pack.memory.slice(-99), entry];

  const command = resolvePrimaryCommandForPack(pack);
  const receipt = actionReceiptForPack(pack, `Memory added to ${workTitle(pack)}.`, command);
  state.status = receipt.summary;
  state.actionReceipt = receipt;

  return {
    saved: true,
    pack: validation.sanitizePack(pack),
    receipt,
    state: validation.sanitizeState(state)
  };
}

module.exports = {
  findPackOrThrow,
  workTitle,
  blockerTextForPack,
  hasBlocker,
  isMissingNextAction,
  proofTargetForPack,
  sentenceValue,
  visibleText,
  resolvePrimaryCommandForPack,
  commandActionForLabel,
  nextActionDisplayLabel,
  packCommandPreview,
  packCommandSignature,
  workflowStateForPack,
  selectedFlowHintForPack,
  ownerBlockerFlowHint,
  primaryCommandVisibleReason,
  forwardPathStatusForBlocker,
  packActionSignature,
  runPackAction,
  packActionSummary,
  actionReceiptForPack,
  actionReceiptSummary,
  actionReceiptContext,
  addPackActivity,
  proofSavedActivity,
  blockedByBlockerText,
  createsBlockedByCycle,
  changePackBlockedByField,
  unblockPacksBlockedBy,
  unblockedReceiptSentence,
  savePackPathAction,
  setPackNextAction,
  addPackMemoryAction
};
