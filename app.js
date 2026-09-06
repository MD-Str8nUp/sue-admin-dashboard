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
    { id: "demo-busy-1", start: "09:00", end: "12:00", label: "Awarely — busy" },
    { id: "demo-busy-2", start: "14:00", end: "17:00", label: "Feel Good — busy" }
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

function taskActions(item) {
  return [
    {
      label: item.status === "Done" ? "Reopen" : "Done",
      onClick: () => {
        item.status = item.status === "Done" ? "Open" : "Done";
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
  document.getElementById("today-label").textContent = new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(new Date());

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

  renderItemList({
    key: "busyBlocks",
    targetId: "busy-list",
    emptyText: "No busy blocks for today.",
    title: (item) => item.label,
    meta: (item) => `${item.start}–${item.end}`,
    actions: (item) => [
      {
        label: "Edit",
        onClick: () => {
          const label = promptText("Edit generic label", item.label);
          if (!label) return;
          item.label = label;
          saveState();
          renderAll();
        }
      },
      { label: "Delete", danger: true, onClick: () => removeItem("busyBlocks", item.id) }
    ]
  });

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

function sortBusyBlocks() {
  state.busyBlocks.sort((a, b) => a.start.localeCompare(b.start));
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
  document.getElementById("capture-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const text = document.getElementById("capture-text").value.trim();
    if (!text) return;
    state.captures.unshift({ id: createId(), text, createdAt: new Date().toISOString() });
    event.target.reset();
    saveState();
    renderAll();
  });

  document.getElementById("busy-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const block = {
      id: createId(),
      start: document.getElementById("busy-start").value,
      end: document.getElementById("busy-end").value,
      label: document.getElementById("busy-label").value.trim()
    };
    state.busyBlocks.push(block);
    sortBusyBlocks();
    event.target.reset();
    saveState();
    renderAll();
  });

  document.getElementById("task-form").addEventListener("submit", (event) => {
    event.preventDefault();
    state.tasks.push({
      id: createId(),
      title: document.getElementById("task-title").value.trim(),
      due: document.getElementById("task-due").value,
      status: document.getElementById("task-status").value
    });
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
    btn.addEventListener("click", () => {
      if (healthState.days[iso]) {
        delete healthState.days[iso];
      } else {
        healthState.days[iso] = true;
      }
      healthSave();
      healthRender();
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

function healthAdjust(field, delta) {
  const next = Math.max(0, Math.min(14, healthState[field] + delta));
  if (next === healthState[field]) return;
  healthState[field] = next;
  healthSave();
  healthRender();
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

function jsonpGet(action, timeoutMs = SHEET_API_TIMEOUT_MS) {
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

    const sep = SHEET_API_URL.includes("?") ? "&" : "?";
    script.src = `${SHEET_API_URL}${sep}action=${encodeURIComponent(action)}&callback=${cbName}`;
    document.head.append(script);
  });
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
