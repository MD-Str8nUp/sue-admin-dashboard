const STORAGE_KEY = "sueAdminDashboard:v1";
const CONFIG_STORAGE_KEY = "sueAdminDashboard:config:v1";
const EXPORT_VERSION = 1;
const SHEET_API_URL = "https://script.google.com/macros/s/AKfycbzbfT3gTYqPdkLmxGF6BZGLiGFplwzk9dIFGOJVUExASHPU83Mxxi1-ORAJNNBUfGnf/exec";
const SHEET_API_TIMEOUT_MS = 8000;
const REQUIRED_STATE_KEYS = ["captures", "busyBlocks", "tasks", "deadlines", "xenaInfo"];
const TASK_STATUSES = ["Open", "Waiting", "Done"];

const initialState = {
  captures: [],
  busyBlocks: [],
  tasks: [],
  deadlines: [],
  xenaInfo: {
    schedule: "",
    inboxLabels: "",
    recurringDeadlines: "",
    approvals: "",
    dashboardPreferences: "",
    updatedAt: ""
  }
};

const demoState = {
  captures: [
    {
      id: "demo-capture-1",
      text: "Parking",
      createdAt: new Date().toISOString()
    },
    {
      id: "demo-capture-2",
      text: "Personal appointment",
      createdAt: new Date().toISOString()
    },
    {
      id: "demo-capture-3",
      text: "Admin follow-up",
      createdAt: new Date().toISOString()
    }
  ],
  busyBlocks: [
    { id: "demo-busy-1", start: "09:00", end: "12:00", practice: "Awarely", purpose: "Complete session notes", nextStep: "Prepare any follow-up draft before the block ends." },
    { id: "demo-busy-2", start: "14:00", end: "17:00", practice: "Feel Good", purpose: "Session administration", nextStep: "Check notes and complete the next required action." }
  ],
  tasks: [
    { id: "demo-task-1", title: "Complete notes", due: today(), status: "Open" },
    { id: "demo-task-2", title: "Send invoice", due: today(), status: "Open" },
    { id: "demo-task-3", title: "Supervision", due: "", status: "Open" },
    { id: "demo-task-4", title: "Workers Comp check", due: "", status: "Open" },
    { id: "demo-task-5", title: "Follow up letter", due: "", status: "Open" }
  ],
  deadlines: [
    { id: "demo-deadline-1", title: "CPD", date: today(), leadDays: 7 },
    { id: "demo-deadline-2", title: "Renewal", date: today(), leadDays: 14 },
    { id: "demo-deadline-3", title: "Invoice due", date: today(), leadDays: 5 }
  ],
  xenaInfo: {
    schedule: "Best check-in windows: mornings for planning, afternoons for admin review.",
    inboxLabels: "Urgent admin: same-day review\nWaiting: check twice weekly\nReference: no action",
    recurringDeadlines: "Monthly admin review - remind 5 days before\nQuarterly dashboard tidy-up - remind 10 days before",
    approvals: "Drafting is okay. Sending or connecting systems requires approval.",
    dashboardPreferences: "Keep the dashboard simple, mobile-first and privacy-focused.",
    updatedAt: new Date().toISOString()
  }
};

let state = loadState();
let backendConfig = loadBackendConfig();
let backendMaterials = [];
let backendMaterialsSource = "dummy";

function normaliseEndpoint(value) {
  const endpoint = String(value || "").trim();
  if (!endpoint) return "";
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || !/\.google\.com$/i.test(url.hostname)) return "";
    if (!/\/macros\/s\/.+\/exec$/i.test(url.pathname)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function loadBackendConfig() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CONFIG_STORAGE_KEY) || "{}");
    return { endpoint: normaliseEndpoint(parsed.endpoint || "") };
  } catch {
    return { endpoint: "" };
  }
}

function saveBackendConfig() {
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(backendConfig));
}

function backendConfigured() {
  return Boolean(backendConfig.endpoint);
}

function backendUrl(params) {
  const url = new URL(backendConfig.endpoint);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return structuredClone(demoState);
    }
    const saved = JSON.parse(raw);
    return mergeState(saved);
  } catch {
    return structuredClone(demoState);
  }
}

function mergeState(saved) {
  if (!saved || typeof saved !== "object") {
    return structuredClone(initialState);
  }

  return {
    ...structuredClone(initialState),
    ...saved,
    xenaInfo: {
      ...initialState.xenaInfo,
      ...(saved && saved.xenaInfo ? saved.xenaInfo : {})
    }
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function stateForStorage(nextState) {
  const merged = mergeState(nextState);
  return {
    captures: Array.isArray(merged.captures) ? merged.captures : [],
    busyBlocks: Array.isArray(merged.busyBlocks) ? merged.busyBlocks : [],
    tasks: Array.isArray(merged.tasks) ? merged.tasks : [],
    deadlines: Array.isArray(merged.deadlines) ? merged.deadlines : [],
    xenaInfo: {
      ...initialState.xenaInfo,
      ...(merged.xenaInfo && typeof merged.xenaInfo === "object" ? merged.xenaInfo : {})
    }
  };
}

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function today() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  if (!value) return "No date set";
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function normaliseTaskStatus(status) {
  return TASK_STATUSES.includes(status) ? status : "Open";
}

function taskStatusPill(item) {
  const label = normaliseTaskStatus(item.status);
  return {
    label,
    variant: label.toLowerCase()
  };
}

function renderItemList({ key, targetId, emptyText, title, meta, actions, items, pill }) {
  const list = document.getElementById(targetId);
  const template = document.getElementById("item-template");
  const sourceItems = items || state[key];
  list.innerHTML = "";

  if (!sourceItems.length) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = emptyText;
    list.append(empty);
    return;
  }

  sourceItems.forEach((item) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.classList.add(`item--${key}`);
    node.classList.toggle("is-done", item.status === "Done");
    node.querySelector(".item__title").textContent = title(item);
    node.querySelector(".item__meta").textContent = meta(item);

    if (pill) {
      const info = pill(item);
      if (info && info.label) {
        const badge = document.createElement("span");
        badge.className = `status-pill status-pill--${info.variant}`;
        badge.textContent = info.label;
        node.querySelector(".item__content").append(badge);
      }
    }

    const actionWrap = node.querySelector(".item__actions");
    actions(item).forEach((action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `mini-button${action.danger ? " mini-button--danger" : ""}`;
      button.textContent = action.label;
      button.addEventListener("click", action.onClick);
      actionWrap.append(button);
    });

    list.append(node);
  });
}

function promptText(label, currentValue) {
  const next = window.prompt(label, currentValue);
  if (next === null) return null;
  return next.trim();
}

function promptDate(label, currentValue) {
  const next = window.prompt(label, currentValue || "YYYY-MM-DD");
  if (next === null) return null;
  return next.trim();
}

function promptTaskStatus(currentValue) {
  const next = window.prompt("Edit status: Open, Waiting or Done", normaliseTaskStatus(currentValue));
  if (next === null) return null;

  const status = TASK_STATUSES.find((option) => option.toLowerCase() === next.trim().toLowerCase());
  if (!status) {
    window.alert("Please use Open, Waiting or Done.");
    return null;
  }

  return status;
}

function removeItem(key, id) {
  state[key] = state[key].filter((item) => item.id !== id);
  saveState();
  renderAll();
}

function removeTask(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;

  if (!window.confirm(`Delete this task?\n\n${task.title}`)) return;
  removeItem("tasks", id);
}

function busyBlockDetails(item) {
  if (item.practice || item.purpose) {
    return {
      practice: item.practice || "General admin",
      purpose: item.purpose || item.label || "Work block",
      nextStep: item.nextStep || item.followUp || item.checklist || ""
    };
  }
  const legacy = String(item.label || "Work block");
  const parts = legacy.split("—");
  return {
    practice: parts[0].trim() || "General admin",
    purpose: parts.slice(1).join("—").trim() || legacy,
    nextStep: ""
  };
}

function focusClinicalTool(practice, tool) {
  document.getElementById("clinical-practice").value = practice === "Feel Good" ? "Feelgood" : "Awarely";
  const panelId = tool === "email" ? "email-draft-panel" : "clinical-note-panel";
  const panel = document.getElementById(panelId);
  panel.open = true;
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
  if (tool === "email") document.getElementById("email-purpose").focus();
  else document.getElementById("clinical-raw-notes").focus();
}

function busyBlockTime(item) {
  if (item.start && item.end) return `${item.start}–${item.end}`;
  if (item.start) return item.start;
  if (item.end) return `Until ${item.end}`;
  return "Today";
}

function markBusyBlockDone(item) {
  item.completed = !item.completed;
  saveState();
  renderAll();
}

async function createBusyBlockFollowUp(item, info) {
  const title = (info.nextStep || `Follow up: ${info.purpose}`).trim();
  const task = `${info.practice}: ${title}`;
  try {
    await sheetWrite("addTask", { task, type: "Admin", priority: "Normal", status: "Open", dueDate: today() });
    setApiStatus("Follow-up added to Google Sheet.", "success");
  } catch (err) {
    state.tasks.push({ id: createId(), title: task, due: today(), status: "Open" });
    saveState();
    renderAll();
    setApiStatus("Sheet unavailable — follow-up added in this browser only.", "error");
  }
}

function taskActions(item) {
  return [
    {
      label: item.status === "Done" ? "Reopen" : "Done",
      onClick: async () => {
        const nextStatus = item.status === "Done" ? "Open" : "Done";
        const match = /^sheet-task-(\d+)$/.exec(String(item.id || ""));
        if (match) {
          try {
            await sheetWrite("updateTaskStatus", { rowNumber: Number(match[1]), status: nextStatus });
            setApiStatus("Saved to Google Sheet.", "success");
            return;
          } catch (err) {
            setApiStatus("Sheet unavailable — updated in this browser only.", "error");
          }
        }
        item.status = nextStatus;
        saveState();
        renderAll();
      }
    },
    {
      label: "Edit",
      onClick: () => {
        const title = promptText("Edit task", item.title);
        if (!title) return;
        const due = promptDate("Edit due date", item.due);
        if (due === null) return;
        const status = promptTaskStatus(item.status);
        if (status === null) return;
        item.title = title;
        item.due = due;
        item.status = status;
        saveState();
        renderAll();
      }
    },
    { label: "Delete", danger: true, onClick: () => removeTask(item.id) }
  ];
}

function renderSummary() {
  const todayStr = today();
  const in7 = new Date();
  in7.setHours(0, 0, 0, 0);
  in7.setDate(in7.getDate() + 7);
  const in7Str = in7.toISOString().slice(0, 10);

  const openTasks = state.tasks.filter((t) => t.status !== "Done").length;
  const overdue = state.deadlines.filter((d) => d.date && d.date < todayStr).length;
  const upcoming = state.deadlines.filter(
    (d) => d.date && d.date >= todayStr && d.date <= in7Str
  ).length;

  document.getElementById("summary-open-tasks").textContent = String(openTasks);
  document.getElementById("summary-overdue").textContent = String(overdue);
  document.getElementById("summary-upcoming").textContent = String(upcoming);
}

function setImportStatus(message, type = "info") {
  const status = document.getElementById("import-status");
  status.textContent = message;
  status.className = `import-status import-status--${type}`;
}

function renderAll() {
  const readableToday = new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(new Date());
  document.getElementById("today-label").textContent = readableToday;
  const calendarDate = document.getElementById("calendar-placeholder-date");
  if (calendarDate) calendarDate.textContent = readableToday;

  renderSummary();

  renderItemList({
    key: "captures",
    targetId: "capture-list",
    emptyText: "No captures yet. Use this for temporary general admin notes.",
    title: (item) => item.text,
    meta: (item) => `Captured ${formatDateTime(item.createdAt)}`,
    actions: (item) => [
      {
        label: "Edit",
        onClick: () => {
          const text = promptText("Edit capture", item.text);
          if (!text) return;
          item.text = text;
          saveState();
          renderAll();
        }
      },
      { label: "Delete", danger: true, onClick: () => removeItem("captures", item.id) }
    ]
  });

  renderTodayBlocks();

  const todayTasks = state.tasks.filter((item) => item.due === today() && item.status !== "Done");
  const weekTasks = state.tasks.filter((item) => item.due !== today() || item.status === "Done");

  renderItemList({
    key: "tasks",
    targetId: "today-task-list",
    emptyText: "No extra tasks for today.",
    items: todayTasks,
    title: (item) => item.title,
    meta: (item) => (item.due ? formatDate(item.due) : "No date set"),
    pill: taskStatusPill,
    actions: taskActions
  });

  renderItemList({
    key: "tasks",
    targetId: "task-list",
    emptyText: "No weekly tasks yet.",
    items: weekTasks,
    title: (item) => item.title,
    meta: (item) => (item.due ? formatDate(item.due) : "No date set"),
    pill: taskStatusPill,
    actions: taskActions
  });

  renderItemList({
    key: "deadlines",
    targetId: "deadline-list",
    emptyText: "No upcoming deadlines yet.",
    title: (item) => item.title,
    meta: (item) => item.date ? formatDate(item.date) : "Date",
    actions: (item) => [
      {
        label: "Edit",
        onClick: () => {
          const title = promptText("Edit deadline", item.title);
          if (!title) return;
          const date = promptDate("Edit date", item.date);
          if (!date) return;
          const leadDays = promptText("Reminder lead time in days", String(item.leadDays));
          if (leadDays === null || leadDays === "") return;
          item.title = title;
          item.date = date;
          item.leadDays = Math.max(0, Number.parseInt(leadDays, 10) || 0);
          sortDeadlines();
          saveState();
          renderAll();
        }
      },
      { label: "Delete", danger: true, onClick: () => removeItem("deadlines", item.id) }
    ]
  });

  fillXenaForm();
}

function renderTodayBlocks() {
  const list = document.getElementById("busy-list");
  list.innerHTML = "";
  if (!state.busyBlocks.length) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No planned work blocks for today.";
    list.append(empty);
    return;
  }
  state.busyBlocks.forEach((item) => {
    const info = busyBlockDetails(item);
    const node = document.createElement("li");
    node.className = `today-block${item.completed ? " is-done" : ""}`;
    const time = document.createElement("div"); time.className = "today-block__time"; time.textContent = busyBlockTime(item);
    const main = document.createElement("div"); main.className = "today-block__main";
    const practice = document.createElement("span"); practice.className = "today-block__practice"; practice.textContent = info.practice;
    const purpose = document.createElement("strong"); purpose.textContent = info.purpose;
    main.append(practice, purpose);
    if (info.nextStep) {
      const next = document.createElement("span");
      next.className = "today-block__next";
      next.textContent = `Checklist / follow-up: ${info.nextStep}`;
      main.append(next);
    }
    node.append(time, main);
    const actions = document.createElement("div");
    actions.className = "today-block__actions";
    const note = document.createElement("button"); note.type = "button"; note.className = "mini-button"; note.textContent = "Start notes"; note.addEventListener("click", () => focusClinicalTool(info.practice, "notes"));
    const followUp = document.createElement("button"); followUp.type = "button"; followUp.className = "mini-button"; followUp.textContent = "Create follow-up"; followUp.addEventListener("click", () => createBusyBlockFollowUp(item, info));
    const done = document.createElement("button"); done.type = "button"; done.className = "mini-button"; done.textContent = item.completed ? "Reopen" : "Mark complete"; done.addEventListener("click", () => markBusyBlockDone(item));
    actions.append(note, followUp, done);
    const manage = document.createElement("details"); manage.className = "today-block__manage";
    manage.innerHTML = "<summary>More</summary>";
    const edit = document.createElement("button"); edit.type = "button"; edit.className = "mini-button"; edit.textContent = "Edit"; edit.addEventListener("click", () => {
      const purpose = promptText("Edit purpose / next action", info.purpose); if (!purpose) return;
      const nextStep = promptText("Edit optional next step", info.nextStep); if (nextStep === null) return;
      item.practice = info.practice; item.purpose = purpose; item.nextStep = nextStep; saveState(); renderAll();
    });
    const remove = document.createElement("button"); remove.type = "button"; remove.className = "mini-button mini-button--danger"; remove.textContent = "Delete"; remove.addEventListener("click", () => removeItem("busyBlocks", item.id));
    manage.append(edit, remove); actions.append(manage);
    node.append(actions); list.append(node);
  });
}

function sortBusyBlocks() {
  state.busyBlocks.sort((a, b) => String(a.start || "").localeCompare(String(b.start || "")));
}

function sortDeadlines() {
  state.deadlines.sort((a, b) => a.date.localeCompare(b.date));
}

function fillXenaForm() {
  document.getElementById("xena-schedule").value = state.xenaInfo.schedule;
  document.getElementById("xena-inbox-labels").value = state.xenaInfo.inboxLabels;
  document.getElementById("xena-recurring-deadlines").value = state.xenaInfo.recurringDeadlines;
  document.getElementById("xena-approvals").value = state.xenaInfo.approvals;
  document.getElementById("xena-dashboard-preferences").value = state.xenaInfo.dashboardPreferences;

  const saveStateLabel = document.getElementById("xena-save-state");
  saveStateLabel.textContent = state.xenaInfo.updatedAt
    ? `Saved ${formatDateTime(state.xenaInfo.updatedAt)}`
    : "Not saved this session";
}

function readXenaForm() {
  state.xenaInfo = {
    schedule: document.getElementById("xena-schedule").value.trim(),
    inboxLabels: document.getElementById("xena-inbox-labels").value.trim(),
    recurringDeadlines: document.getElementById("xena-recurring-deadlines").value.trim(),
    approvals: document.getElementById("xena-approvals").value.trim(),
    dashboardPreferences: document.getElementById("xena-dashboard-preferences").value.trim(),
    updatedAt: new Date().toISOString()
  };
}

function informationPayload() {
  readXenaForm();
  saveState();
  return {
    title: "Information for Xena",
    exportedAt: new Date().toISOString(),
    privacyNote:
      "Phase 1 static dashboard. Calendar/email integrations are not connected and require practice approval. No client data, credentials or real email addresses should be included.",
    information: state.xenaInfo
  };
}

function dashboardExportPayload() {
  readXenaForm();
  state = stateForStorage(state);
  saveState();

  return {
    exportVersion: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    privacyNote:
      "Phase 1 static dashboard backup. Calendar/email integrations are not connected. This export should not contain client data, credentials, real email addresses or practice integration data.",
    state
  };
}

function validateImportedDashboard(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { valid: false, message: "Import failed: the JSON file is not a dashboard export object." };
  }

  if (!Object.hasOwn(payload, "state") || !payload.state || typeof payload.state !== "object") {
    return { valid: false, message: "Import failed: the export is missing its top-level state object." };
  }

  const importedState = payload.state;
  const missingKeys = REQUIRED_STATE_KEYS.filter((key) => !Object.hasOwn(importedState, key));
  if (missingKeys.length) {
    return {
      valid: false,
      message: `Import failed: the state object is missing ${missingKeys.join(", ")}.`
    };
  }

  const arrayKeys = ["captures", "busyBlocks", "tasks", "deadlines"];
  const invalidArrayKey = arrayKeys.find((key) => !Array.isArray(importedState[key]));
  if (invalidArrayKey) {
    return { valid: false, message: `Import failed: state.${invalidArrayKey} must be a list.` };
  }

  if (!importedState.xenaInfo || typeof importedState.xenaInfo !== "object" || Array.isArray(importedState.xenaInfo)) {
    return { valid: false, message: "Import failed: state.xenaInfo must be an object." };
  }

  return { valid: true, importedState: stateForStorage(importedState) };
}

function importDashboardFile(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const validation = validateImportedDashboard(JSON.parse(String(reader.result)));
      if (!validation.valid) {
        setImportStatus(validation.message, "error");
        return;
      }

      const confirmed = window.confirm(
        "Replace all dashboard data stored in this browser with the selected JSON backup? This cannot be undone unless you have another export."
      );
      if (!confirmed) {
        setImportStatus("Import cancelled. Existing local dashboard data was not changed.", "info");
        return;
      }

      state = validation.importedState;
      saveState();
      renderAll();
      setImportStatus("Import complete. Dashboard data has been restored in this browser.", "success");
    } catch {
      setImportStatus("Import failed: the selected file is not valid JSON.", "error");
    }
  });

  reader.addEventListener("error", () => {
    setImportStatus("Import failed: the selected file could not be read.", "error");
  });

  reader.readAsText(file);
}

function downloadFile(filename, type, contents) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function payloadAsText(payload) {
  return [
    "Information for Xena",
    `Exported: ${payload.exportedAt}`,
    "",
    payload.privacyNote,
    "",
    "Preferred schedule",
    payload.information.schedule || "Not provided",
    "",
    "Inbox labels and purposes",
    payload.information.inboxLabels || "Not provided",
    "",
    "Recurring deadlines and reminder lead times",
    payload.information.recurringDeadlines || "Not provided",
    "",
    "Approvals status",
    payload.information.approvals || "Not provided",
    "",
    "Dashboard preferences",
    payload.information.dashboardPreferences || "Not provided"
  ].join("\n");
}

function cleanClinicalLines(value) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function bulletClinicalLines(value) {
  const lines = cleanClinicalLines(value);
  if (!lines.length) return ["- "];
  return lines.map((line) => `- ${line.replace(/^[-*]\s*/, "")}`);
}

function clinicalDetailLines() {
  const details = [
    ["Practice", document.getElementById("clinical-practice").value],
    ["Session type", document.getElementById("clinical-session-type").value.trim()],
    ["Modality", document.getElementById("clinical-modality").value.trim()],
    ["Duration", document.getElementById("clinical-duration").value.trim()]
  ];

  return details
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`);
}

function clinicalTemplate(layout, rawNotes) {
  const bullets = bulletClinicalLines(rawNotes);

  if (layout === "contact") {
    return [
      "Contact summary",
      ...bullets,
      "",
      "Clinical observations",
      "- ",
      "",
      "Outcome",
      "- "
    ];
  }

  if (layout === "follow-up") {
    return [
      "Presenting themes",
      ...bullets,
      "",
      "Actions completed",
      "- ",
      "",
      "Follow-up plan",
      "- "
    ];
  }

  return [
    "Subjective / reported themes",
    ...bullets,
    "",
    "Objective / session observations",
    "- ",
    "",
    "Clinical formulation / summary",
    "- ",
    "",
    "Plan",
    "- "
  ];
}

function generateClinicalNote() {
  const layout = document.getElementById("clinical-layout").value;
  const rawNotes = document.getElementById("clinical-raw-notes").value;
  const details = clinicalDetailLines();
  const sections = clinicalTemplate(layout, rawNotes);

  return [
    "Clinical note draft",
    "Temporary preparation only - de-identified content required",
    "",
    ...details,
    ...(details.length ? [""] : []),
    ...sections
  ].join("\n");
}

function updateClinicalPreview() {
  document.getElementById("clinical-preview").value = generateClinicalNote();
  const status = document.getElementById("clinical-note-status");
  status.textContent = "Preview updated in this page only.";
  status.className = "import-status import-status--info";
}

async function copyClinicalPreview() {
  const preview = document.getElementById("clinical-preview");
  const status = document.getElementById("clinical-note-status");

  try {
    await navigator.clipboard.writeText(preview.value);
    status.textContent = "Formatted note copied to clipboard.";
    status.className = "import-status import-status--success";
  } catch {
    preview.focus();
    preview.select();
    status.textContent = "Copy unavailable. The note is selected so you can copy it manually.";
    status.className = "import-status import-status--error";
  }
}

function clearClinicalNote() {
  document.getElementById("clinical-note-form").reset();
  document.getElementById("clinical-preview").value = "";
  const status = document.getElementById("clinical-note-status");
  status.textContent = "Clinical note fields cleared from this page.";
  status.className = "import-status import-status--info";
}

function setupClinicalNoteFormatter() {
  document.getElementById("clinical-note-form").addEventListener("submit", (event) => {
    event.preventDefault();
  });

  const fieldIds = [
    "clinical-practice",
    "clinical-layout",
    "clinical-session-type",
    "clinical-modality",
    "clinical-duration",
    "clinical-raw-notes"
  ];

  fieldIds.forEach((id) => {
    const field = document.getElementById(id);
    field.addEventListener("input", updateClinicalPreview);
    field.addEventListener("change", updateClinicalPreview);
  });

  document.getElementById("copy-clinical-note").addEventListener("click", copyClinicalPreview);
  document.getElementById("clear-clinical-note").addEventListener("click", clearClinicalNote);
  updateClinicalPreview();
}

let testMaterials = [
  { name: "Reflection Worksheet — TEST ONLY", reference: "", selected: true, dummy: true },
  { name: "Grounding Information Sheet — TEST ONLY", reference: "", selected: false, dummy: true },
  { name: "Community Referral Resource — TEST ONLY", reference: "", selected: false, dummy: true }
];

function isHttpUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function materialSourceIsApproved() {
  return backendMaterialsSource === "approved";
}

function renderMaterialsChecklist() {
  const box = document.getElementById("materials-checklist");
  const label = document.getElementById("materials-source-label");
  const addRow = document.getElementById("dummy-material-add-row");
  if (!box || !label || !addRow) return;

  label.textContent = materialSourceIsApproved()
    ? "Approved materials from Google Sheet"
    : "Temporary dummy materials";
  addRow.hidden = materialSourceIsApproved();
  box.innerHTML = "";

  testMaterials.forEach((item, index) => {
    const row = document.createElement("label");
    row.className = "material-item";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(item.selected);
    checkbox.addEventListener("change", () => { testMaterials[index].selected = checkbox.checked; });
    const text = document.createElement("span");
    text.className = "material-text";
    const name = document.createElement("span");
    name.className = "material-name";
    name.textContent = item.name;
    text.append(name);
    if (item.reference) {
      const reference = document.createElement("span");
      reference.className = "material-reference";
      if (isHttpUrl(item.reference)) {
        const link = document.createElement("a");
        link.href = item.reference;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "View attachment";
        reference.append(link);
      } else {
        reference.textContent = `Reference: ${item.reference}`;
      }
      text.append(reference);
    }
    row.append(checkbox, text);
    box.append(row);
  });
}

function emailDraftText() {
  const purpose = document.getElementById("email-purpose").value;
  const recipient = document.getElementById("email-test-recipient").value.trim() || "[test recipient]";
  const materials = testMaterials.filter((item) => item.selected);
  const materialLines = materials.length
    ? materials.map((item) => `- ${item.name}${item.reference ? `\n  View attachment: ${item.reference}` : ""}`).join("\n")
    : "- [No materials selected.]";
  return {
    subject: `Test ${purpose.toLowerCase()} draft`,
    body: [
      `Hi ${recipient},`, "", "This is a temporary editable test draft.", "",
      "Selected materials", materialLines, "", "Next steps", "- [Edit test follow-up text here.]", "",
      "Kind regards,", "Sue"
    ].join("\n")
  };
}

function setEmailStatus(message, type = "info") {
  const status = document.getElementById("email-draft-status");
  status.textContent = message;
  status.className = `import-status import-status--${type}`;
}

function setupEmailDraft() {
  const output = document.getElementById("email-draft-output");
  document.getElementById("generate-email-draft").addEventListener("click", () => {
    output.value = emailDraftText().body;
    setEmailStatus("Editable test draft generated. Nothing has been sent.", "success");
  });
  document.getElementById("add-material").addEventListener("click", () => {
    if (materialSourceIsApproved()) return;
    const input = document.getElementById("new-material-input");
    const name = input.value.trim();
    if (!name) return;
    testMaterials.push({ name: name.slice(0, 120), reference: "", selected: true, dummy: true });
    input.value = "";
    renderMaterialsChecklist();
  });
  document.getElementById("copy-email-draft").addEventListener("click", async () => {
    if (!output.value) output.value = emailDraftText().body;
    try {
      await navigator.clipboard.writeText(output.value);
      setEmailStatus("Draft copied. Review it before using it.", "success");
    } catch {
      output.focus(); output.select();
      setEmailStatus("Draft selected for manual copy.", "info");
    }
  });
  document.getElementById("open-gmail-draft").addEventListener("click", () => {
    const draft = emailDraftText();
    const body = output.value || draft.body;
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(body)}`, "_blank", "noopener");
    setEmailStatus("Opened a draft window for manual review only.", "success");
  });
  document.getElementById("clear-email-draft").addEventListener("click", () => {
    output.value = "";
    setEmailStatus("Test draft cleared from this page.", "info");
  });
  renderMaterialsChecklist();
}

function setupForms() {
  const captureText = document.getElementById("capture-text");
  const captureDue = document.getElementById("capture-due");
  const captureReminderDays = document.getElementById("capture-reminder-days");
  const capturePreview = document.getElementById("capture-preview");

  function captureTitle(text) {
    return text
      .replace(/\bby\s+(?:next\s+\w+,?\s*)?\d{1,2}\s+[a-z]+\s+\d{4}\b/ig, "")
      .replace(/\bremind\s+me\s+\d+\s+days?\s+(?:before|beforehand)\b/ig, "")
      .replace(/\s{2,}/g, " ").replace(/[.;,\s]+$/g, "").trim() || text;
  }

  function dateFromCaptureText(text) {
    const months = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11 };
    const match = text.match(/\b(?:by\s+)?(?:next\s+\w+,?\s*)?(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(20\d{2})\b/i);
    if (!match) return "";
    const date = new Date(Number(match[3]), months[match[2].toLowerCase()], Number(match[1]));
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
  }

  function reminderDaysFromCaptureText(text) {
    const match = text.match(/\bremind\s+me\s+(\d+|one|two|three|seven|fourteen)\s+days?\s+(?:before|beforehand)\b/i);
    if (!match) return "";
    const words = { one: 1, two: 2, three: 3, seven: 7, fourteen: 14 };
    const count = words[String(match[1]).toLowerCase()] || Number(match[1]);
    return String(Math.min(365, Math.max(0, count)));
  }

  function refreshCapturePreview(parseText = false) {
    if (parseText && !captureDue.value) {
      const parsedDate = dateFromCaptureText(captureText.value);
      if (parsedDate) captureDue.value = parsedDate;
    }
    if (parseText) {
      const parsedLead = reminderDaysFromCaptureText(captureText.value);
      if (parsedLead) captureReminderDays.value = parsedLead;
    }
    const task = captureTitle(captureText.value.trim());
    const due = captureDue.value;
    const lead = Number(captureReminderDays.value || 0);
    if (!task) { capturePreview.textContent = "Add a task, then choose its due date and reminder."; return; }
    if (!due) { capturePreview.textContent = `Will add: ${task}. Add a due date if you want a reminder.`; return; }
    const reminder = new Date(`${due}T00:00:00`);
    reminder.setDate(reminder.getDate() - lead);
    capturePreview.textContent = lead ? `Will add “${task}” due ${formatDate(due)}, plus a reminder on ${formatDate(reminder.toISOString().slice(0, 10))}.` : `Will add “${task}” due ${formatDate(due)}.`;
  }

  captureText.addEventListener("input", () => refreshCapturePreview(true));
  captureDue.addEventListener("change", () => refreshCapturePreview(false));
  captureReminderDays.addEventListener("change", () => refreshCapturePreview(false));

  document.getElementById("capture-speak").addEventListener("click", () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { capturePreview.textContent = "Speech input is not available in this browser. Type the task instead."; return; }
    const recognition = new Recognition();
    recognition.lang = "en-AU"; recognition.interimResults = false; recognition.maxAlternatives = 1;
    recognition.onresult = (event) => { captureText.value = event.results[0][0].transcript; refreshCapturePreview(true); };
    recognition.onerror = () => { capturePreview.textContent = "Microphone access was not available. Type the task instead."; };
    recognition.start();
    capturePreview.textContent = "Listening… speak the task, due date and reminder lead time.";
  });

  document.getElementById("capture-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const sourceText = captureText.value.trim();
    if (!sourceText) return;
    const task = captureTitle(sourceText);
    const dueDate = captureDue.value;
    const leadDays = Number(captureReminderDays.value || 0);
    const reminderDate = dueDate && leadDays ? new Date(`${dueDate}T00:00:00`) : null;
    if (reminderDate) reminderDate.setDate(reminderDate.getDate() - leadDays);
    try {
      await sheetWrite("addTask", { task, type: "Admin", priority: "Normal", status: "Open", dueDate });
      if (reminderDate) await sheetWrite("addTask", { task: `Reminder: ${task}`, type: "Reminder", priority: "Normal", status: "Open", dueDate: reminderDate.toISOString().slice(0, 10) });
      setApiStatus(reminderDate ? "Task and reminder saved to Google Sheet." : "Task saved to Google Sheet.", "success");
    } catch (err) {
      state.tasks.push({ id: createId(), title: task, due: dueDate, status: "Open" });
      if (reminderDate) state.tasks.push({ id: createId(), title: `Reminder: ${task}`, due: reminderDate.toISOString().slice(0, 10), status: "Open" });
      setApiStatus("Sheet unavailable — task and reminder saved in this browser only.", "error");
    }
    event.target.reset();
    captureReminderDays.value = "2";
    refreshCapturePreview(false);
    saveState();
    renderAll();
  });

  document.getElementById("busy-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const block = {
      id: createId(),
      start: document.getElementById("busy-start").value,
      end: document.getElementById("busy-end").value,
      practice: document.getElementById("busy-practice").value,
      purpose: document.getElementById("busy-purpose").value.trim(),
      nextStep: document.getElementById("busy-next-step").value.trim()
    };
    state.busyBlocks.push(block);
    sortBusyBlocks();
    event.target.reset();
    saveState();
    renderAll();
  });

  document.getElementById("task-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const task = document.getElementById("task-title").value.trim();
    if (!task) return;
    const due = document.getElementById("task-due").value;
    const status = document.getElementById("task-status").value;
    try {
      await sheetWrite("addTask", { task, type: "Admin", priority: "Normal", status, dueDate: due });
      setApiStatus("Saved to Google Sheet.", "success");
    } catch (err) {
      state.tasks.push({ id: createId(), title: task, due, status });
      setApiStatus("Sheet unavailable — saved in this browser only.", "error");
    }
    event.target.reset();
    saveState();
    renderAll();
  });

  document.getElementById("deadline-form").addEventListener("submit", (event) => {
    event.preventDefault();
    state.deadlines.push({
      id: createId(),
      title: document.getElementById("deadline-title").value.trim(),
      date: document.getElementById("deadline-date").value,
      leadDays: Number.parseInt(document.getElementById("deadline-lead").value, 10)
    });
    sortDeadlines();
    event.target.reset();
    document.getElementById("deadline-lead").value = "7";
    saveState();
    renderAll();
  });

  document.getElementById("xena-form").addEventListener("submit", (event) => {
    event.preventDefault();
    readXenaForm();
    saveState();
    renderAll();
  });

  document.getElementById("export-json").addEventListener("click", () => {
    const payload = dashboardExportPayload();
    downloadFile(`sue-admin-dashboard-backup-${today()}.json`, "application/json", JSON.stringify(payload, null, 2));
    setImportStatus("JSON backup exported. Keep it somewhere safe before clearing browser data or changing devices.", "success");
    renderAll();
  });

  document.getElementById("export-text").addEventListener("click", () => {
    const payload = informationPayload();
    downloadFile(`information-for-xena-${today()}.txt`, "text/plain", payloadAsText(payload));
    renderAll();
  });

  document.getElementById("import-json").addEventListener("click", () => {
    document.getElementById("import-json-file").click();
  });

  document.getElementById("import-json-file").addEventListener("change", (event) => {
    importDashboardFile(event.target.files[0]);
    event.target.value = "";
  });

  document.getElementById("load-demo").addEventListener("click", () => {
    state = structuredClone(demoState);
    saveState();
    renderAll();
  });

  document.getElementById("reset-empty").addEventListener("click", () => {
    if (!window.confirm("Clear all dashboard data stored in this browser?")) return;
    state = structuredClone(initialState);
    saveState();
    renderAll();
  });
}

const HEALTH_STORAGE_KEY = "sueAdminDashboard:health:v1";
const HEALTH_DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HEALTH_TARGETS = { strength: 2, yoga: 2, activityMinutes: 35, activityDaysPerWeek: 7 };

function healthMondayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return d;
}

function healthIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function healthEmptyWeek(weekStart) {
  return { weekStart, days: {}, strength: 0, yoga: 0 };
}

function healthLoad() {
  const todayMonday = healthIsoDate(healthMondayOf(new Date()));
  try {
    const raw = localStorage.getItem(HEALTH_STORAGE_KEY);
    if (!raw) return healthEmptyWeek(todayMonday);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || parsed.weekStart !== todayMonday) {
      return healthEmptyWeek(todayMonday);
    }
    return {
      weekStart: todayMonday,
      days: parsed.days && typeof parsed.days === "object" ? parsed.days : {},
      strength: Math.max(0, Number.parseInt(parsed.strength, 10) || 0),
      yoga: Math.max(0, Number.parseInt(parsed.yoga, 10) || 0)
    };
  } catch {
    return healthEmptyWeek(todayMonday);
  }
}

let healthState = healthLoad();

function healthSave() {
  localStorage.setItem(HEALTH_STORAGE_KEY, JSON.stringify(healthState));
}

function healthWeekDates() {
  const start = new Date(`${healthState.weekStart}T00:00:00`);
  return HEALTH_DAY_NAMES.map((_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return healthIsoDate(d);
  });
}

function healthFormatWeekLabel() {
  const dates = healthWeekDates();
  const start = new Date(`${dates[0]}T00:00:00`);
  const end = new Date(`${dates[6]}T00:00:00`);
  const fmt = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" });
  return `Week of ${fmt.format(start)} – ${fmt.format(end)}`;
}

function healthSetStatus(message, type = "info") {
  const el = document.getElementById("health-status");
  el.textContent = message;
  el.className = `import-status import-status--${type}`;
}

function healthRenderPips(container, count, target) {
  container.innerHTML = "";
  const total = Math.max(target, count);
  for (let i = 0; i < total; i += 1) {
    const pip = document.createElement("span");
    pip.className = "personal-health__pip";
    if (i < count) pip.classList.add("is-filled");
    if (i >= target && i < count) pip.classList.add("is-bonus");
    container.append(pip);
  }
}

function healthRender() {
  document.getElementById("health-week-label").textContent = healthFormatWeekLabel();

  const daysList = document.getElementById("health-days");
  daysList.innerHTML = "";
  const dates = healthWeekDates();
  const todayIso = healthIsoDate(new Date());
  let doneCount = 0;

  dates.forEach((iso, i) => {
    const done = Boolean(healthState.days[iso]);
    if (done) doneCount += 1;
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "personal-health__day";
    if (iso === todayIso) btn.classList.add("is-today");
    if (done) btn.classList.add("is-done");
    btn.setAttribute("aria-pressed", done ? "true" : "false");
    const dayNum = new Date(`${iso}T00:00:00`).getDate();
    btn.setAttribute(
      "aria-label",
      `${HEALTH_DAY_NAMES[i]} ${dayNum} — ${done ? "mark undone" : "mark 35 minute activity done"}`
    );
    btn.innerHTML = `<span class="personal-health__day-name">${HEALTH_DAY_NAMES[i]}</span>` +
      `<span>${dayNum}</span>` +
      `<span class="personal-health__day-mark" aria-hidden="true">${done ? "✓" : "○"}</span>`;
    btn.addEventListener("click", async () => {
      if (healthState.days[iso]) {
        delete healthState.days[iso];
      } else {
        healthState.days[iso] = true;
      }
      healthSave();
      healthRender();
      try {
        await sheetWrite("setPersonalMinutes", { dateKey: iso, minutes: healthState.days[iso] ? 35 : 0 });
        healthSetStatus("Saved to Google Sheet.", "success");
      } catch (err) {
        healthSetStatus("Sheet unavailable — saved in this browser only.", "error");
      }
    });
    li.append(btn);
    daysList.append(li);
  });

  document.getElementById("health-activity-summary").textContent =
    `${doneCount} of ${HEALTH_TARGETS.activityDaysPerWeek} days`;

  document.getElementById("health-strength-summary").textContent =
    `${healthState.strength} of ${HEALTH_TARGETS.strength}`;
  healthRenderPips(document.getElementById("health-strength-pips"), healthState.strength, HEALTH_TARGETS.strength);

  document.getElementById("health-yoga-summary").textContent =
    `${healthState.yoga} of ${HEALTH_TARGETS.yoga}`;
  healthRenderPips(document.getElementById("health-yoga-pips"), healthState.yoga, HEALTH_TARGETS.yoga);
}

async function healthAdjust(field, delta) {
  const next = Math.max(0, Math.min(14, healthState[field] + delta));
  if (next === healthState[field]) return;
  healthState[field] = next;
  healthSave();
  healthRender();
  const action = delta > 0 ? "addPersonalSession" : "undoPersonalSession";
  try {
    await sheetWrite(action, { kind: field });
    healthSetStatus("Saved to Google Sheet.", "success");
  } catch (err) {
    healthSetStatus("Sheet unavailable — saved in this browser only.", "error");
  }
}

function setupPersonalHealth() {
  document.getElementById("health-strength-add").addEventListener("click", () => healthAdjust("strength", 1));
  document.getElementById("health-strength-undo").addEventListener("click", () => healthAdjust("strength", -1));
  document.getElementById("health-yoga-add").addEventListener("click", () => healthAdjust("yoga", 1));
  document.getElementById("health-yoga-undo").addEventListener("click", () => healthAdjust("yoga", -1));
  document.getElementById("health-reset-week").addEventListener("click", () => {
    if (!window.confirm("Reset all personal health habits for this week? This cannot be undone.")) return;
    healthState = healthEmptyWeek(healthIsoDate(healthMondayOf(new Date())));
    healthSave();
    healthRender();
    healthSetStatus("Personal health week reset in this browser.", "success");
  });
  healthRender();
}

function setupDashboardTabs() {
  const tabs = [
    { tab: document.getElementById("work-tab"), panel: document.getElementById("work-panel") },
    { tab: document.getElementById("health-tab"), panel: document.getElementById("health-panel") }
  ];

  function selectTab(selected) {
    tabs.forEach(({ tab, panel }) => {
      const active = tab === selected.tab;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      tab.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
  }

  tabs.forEach((item) => {
    item.tab.addEventListener("click", () => selectTab(item));
    item.tab.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const index = tabs.indexOf(item);
      const next = tabs[(index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      next.tab.focus();
      selectTab(next);
    });
  });

  selectTab(tabs[0]);
}

setupClinicalNoteFormatter();
setupEmailDraft();
setupForms();
setupPersonalHealth();
setupDashboardTabs();
renderAll();
hydrateFromSheetApi();

function jsonpGet(action, payload = null, timeoutMs = SHEET_API_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const cbName = `__sueSheetCb_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
    const script = document.createElement("script");
    let timer;

    function cleanup() {
      clearTimeout(timer);
      delete window[cbName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[cbName] = (payload) => {
      cleanup();
      if (payload && payload.ok) {
        resolve(payload.data);
      } else {
        reject(new Error(payload && payload.error ? payload.error : "sheet api error"));
      }
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("sheet api unreachable"));
    };

    timer = setTimeout(() => {
      cleanup();
      reject(new Error("sheet api timeout"));
    }, timeoutMs);

    const params = new URLSearchParams({ action, callback: cbName });
    if (payload !== null) params.set("payload", JSON.stringify(payload));
    const sep = SHEET_API_URL.includes("?") ? "&" : "?";
    script.src = `${SHEET_API_URL}${sep}${params.toString()}`;
    document.head.append(script);
  });
}

async function sheetWrite(action, payload) {
  const result = await jsonpGet(action, payload);
  await hydrateFromSheetApi();
  return result;
}

function normaliseSheetStatus(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "done" || s === "complete" || s === "completed") return "Done";
  if (s === "waiting" || s === "blocked" || s === "in progress") return "Waiting";
  return "Open";
}

function mapSheetTasks(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => r && r.task)
    .map((r) => ({
      id: `sheet-task-${r.rowNumber}`,
      title: String(r.task || "").trim(),
      due: r.dueDate || "",
      status: normaliseSheetStatus(r.status)
    }));
}

function pickField(item, keys) {
  for (const k of keys) {
    if (item && Object.hasOwn(item, k) && item[k]) return String(item[k]).trim();
  }
  return "";
}

function mapSheetDeadlines(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => {
      const title = pickField(r, ["Title", "title", "Deadline", "Name", "Label", "Task"]);
      const date = pickField(r, ["Date", "date", "Due", "Due date", "dueDate"]);
      const leadRaw = pickField(r, ["Lead", "lead", "Lead time", "leadDays", "Lead days"]);
      const leadDays = Number.parseInt(leadRaw, 10);
      if (!title && !date) return null;
      return {
        id: `sheet-deadline-${r.rowNumber || createId()}`,
        title: title || "(untitled deadline)",
        date: date || "",
        leadDays: Number.isFinite(leadDays) ? Math.max(0, leadDays) : 7
      };
    })
    .filter(Boolean);
}

function setApiStatus(message, type = "info") {
  const el = document.getElementById("sheet-api-status");
  if (!el) return;
  el.textContent = message;
  el.className = `sheet-api-status sheet-api-status--${type}`;
}

function ensureApiStatusElement() {
  if (document.getElementById("sheet-api-status")) return;
  const host = document.querySelector(".topbar__brand") || document.querySelector(".topbar__inner");
  if (!host) return;
  const el = document.createElement("p");
  el.id = "sheet-api-status";
  el.className = "sheet-api-status sheet-api-status--info";
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.textContent = "Loading from sheet…";
  host.append(el);
}

function applyDashboardData(data) {
  if (!data) return;
  const tasks = mapSheetTasks(data.tasks);
  const deadlines = mapSheetDeadlines(data.deadlines);
  state.tasks = tasks;
  state.deadlines = deadlines;
  saveState();
  renderAll();
}

function applyPersonalData(data) {
  if (!data || typeof data !== "object") return;
  const weekStart = healthState.weekStart;
  const weekDates = healthWeekDates();
  const weekSet = new Set(weekDates);

  const days = {};
  if (data.days && typeof data.days === "object") {
    for (const [iso, minutes] of Object.entries(data.days)) {
      if (weekSet.has(iso) && Number(minutes) > 0) days[iso] = true;
    }
  }

  const strengthCount = countTimestampsInWeek(data.strength, weekDates[0]);
  const yogaCount = countTimestampsInWeek(data.yoga, weekDates[0]);

  healthState = {
    weekStart,
    days,
    strength: strengthCount,
    yoga: yogaCount
  };
  healthSave();
  healthRender();
}

function countTimestampsInWeek(list, weekStartIso) {
  if (!Array.isArray(list) || !weekStartIso) return 0;
  const start = new Date(`${weekStartIso}T00:00:00`);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  let n = 0;
  for (const ts of list) {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) continue;
    if (d >= start && d < end) n += 1;
  }
  return n;
}

async function hydrateFromSheetApi() {
  ensureApiStatusElement();
  setApiStatus("Connecting to sheet…", "info");

  const results = await Promise.allSettled([
    jsonpGet("dashboardData"),
    jsonpGet("personalData"),
    jsonpGet("approvedMaterials")
  ]);

  const [dashboard, personal, materials] = results;
  const failures = [];

  if (dashboard.status === "fulfilled") {
    try {
      applyDashboardData(dashboard.value);
    } catch (err) {
      failures.push(`tasks (${err.message})`);
    }
  } else {
    failures.push(`tasks (${dashboard.reason && dashboard.reason.message})`);
  }

  if (personal.status === "fulfilled") {
    try {
      applyPersonalData(personal.value);
    } catch (err) {
      failures.push(`wellbeing (${err.message})`);
    }
  } else {
    failures.push(`wellbeing (${personal.reason && personal.reason.message})`);
  }

  if (materials.status === "fulfilled") {
    const rows = Array.isArray(materials.value && materials.value.rows) ? materials.value.rows : [];
    const approved = rows.filter((row) => row && row.approved && row.name);
    if (approved.length) {
      testMaterials = approved.map((row, index) => ({
        name: String(row.name),
        reference: String(row.reference || ""),
        selected: index === 0,
        dummy: false
      }));
      backendMaterials = approved;
      backendMaterialsSource = "approved";
    } else {
      backendMaterials = [];
      backendMaterialsSource = "dummy";
    }
    renderMaterialsChecklist();
  } else {
    failures.push(`materials (${materials.reason && materials.reason.message})`);
  }

  if (!failures.length) {
    setApiStatus("Loaded from sheet.", "success");
  } else if (failures.length === 3) {
    setApiStatus("Offline: showing local data only.", "error");
  } else {
    setApiStatus(`Partial load. Local fallback for: ${failures.join(", ")}.`, "error");
  }
}
