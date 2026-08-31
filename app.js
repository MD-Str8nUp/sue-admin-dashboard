const STORAGE_KEY = "sueAdminDashboard:v1";

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
      text: "Review which admin reminders should be weekly.",
      createdAt: new Date().toISOString()
    }
  ],
  busyBlocks: [
    { id: "demo-busy-1", start: "09:00", end: "10:30", label: "Focus admin" },
    { id: "demo-busy-2", start: "13:00", end: "14:00", label: "Appointment block" }
  ],
  tasks: [
    { id: "demo-task-1", title: "Confirm reminder categories", due: today(), status: "Open" },
    { id: "demo-task-2", title: "Prepare generic weekly checklist", due: "", status: "Waiting" }
  ],
  deadlines: [
    { id: "demo-deadline-1", title: "Monthly admin review", date: today(), leadDays: 5 }
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

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return mergeState(saved);
  } catch {
    return structuredClone(initialState);
  }
}

function mergeState(saved) {
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

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
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

function renderItemList({ key, targetId, emptyText, title, meta, actions }) {
  const list = document.getElementById(targetId);
  const template = document.getElementById("item-template");
  list.innerHTML = "";

  if (!state[key].length) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = emptyText;
    list.append(empty);
    return;
  }

  state[key].forEach((item) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.classList.toggle("is-done", item.status === "Done");
    node.querySelector(".item__title").textContent = title(item);
    node.querySelector(".item__meta").textContent = meta(item);

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

function removeItem(key, id) {
  state[key] = state[key].filter((item) => item.id !== id);
  saveState();
  renderAll();
}

function renderAll() {
  document.getElementById("today-label").textContent = new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(new Date());

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
    meta: (item) => `${item.start} to ${item.end}`,
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

  renderItemList({
    key: "tasks",
    targetId: "task-list",
    emptyText: "No action queue tasks yet.",
    title: (item) => item.title,
    meta: (item) => `${item.status} | Due: ${formatDate(item.due)}`,
    actions: (item) => [
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
          item.title = title;
          item.due = due;
          saveState();
          renderAll();
        }
      },
      { label: "Delete", danger: true, onClick: () => removeItem("tasks", item.id) }
    ]
  });

  renderItemList({
    key: "deadlines",
    targetId: "deadline-list",
    emptyText: "No upcoming deadlines yet.",
    title: (item) => item.title,
    meta: (item) => `${formatDate(item.date)} | remind ${item.leadDays} day${Number(item.leadDays) === 1 ? "" : "s"} before`,
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
    const payload = informationPayload();
    downloadFile(`information-for-xena-${today()}.json`, "application/json", JSON.stringify(payload, null, 2));
    renderAll();
  });

  document.getElementById("export-text").addEventListener("click", () => {
    const payload = informationPayload();
    downloadFile(`information-for-xena-${today()}.txt`, "text/plain", payloadAsText(payload));
    renderAll();
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

setupForms();
renderAll();
