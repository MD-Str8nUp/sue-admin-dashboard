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
  completionHistory: [],
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

  const merged = {
    ...structuredClone(initialState),
    ...saved,
    xenaInfo: {
      ...initialState.xenaInfo,
      ...(saved && saved.xenaInfo ? saved.xenaInfo : {})
    }
  };
  merged.completionHistory = normaliseCompletionHistory(merged.completionHistory);
  merged.tasks = normaliseStoredTasks(merged.tasks, merged.completionHistory);
  return merged;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function stateForStorage(nextState) {
  const merged = mergeState(nextState);
  return {
    captures: Array.isArray(merged.captures) ? merged.captures : [],
    busyBlocks: Array.isArray(merged.busyBlocks) ? merged.busyBlocks : [],
    tasks: normaliseStoredTasks(merged.tasks, merged.completionHistory),
    deadlines: Array.isArray(merged.deadlines) ? merged.deadlines : [],
    completionHistory: normaliseCompletionHistory(merged.completionHistory),
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

function normaliseDateTime(value) {
  if (!value) return "";
  const text = String(value).trim();
  if (!text) return "";
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T00:00:00`) : new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function completionHistoryKey(entry) {
  const sourceRow = Number(entry && (entry.sourceRow || entry.rowNumber || 0));
  const status = normaliseTaskStatus(entry && entry.status);
  if (sourceRow) return `sheet:${sourceRow}:${status}`;
  return `local:${String(entry && (entry.taskKey || entry.id || entry.title || "")).trim()}:${status}`;
}

function normaliseCompletionHistory(entries) {
  if (!Array.isArray(entries)) return [];
  const byKey = new Map();

  entries.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const title = String(entry.title || entry.task || entry.taskTitle || "Completed task").trim();
    const completedAt = String(entry.completedAt || entry.completedTimestamp || entry.timestamp || "").trim();
    if (!title || !completedAt || Number.isNaN(new Date(completedAt).getTime())) return;
    const status = normaliseTaskStatus(entry.status || "Done");
    const clean = {
      id: String(entry.id || completionHistoryKey(entry) || createId()),
      taskKey: String(entry.taskKey || entry.id || entry.title || title),
      title,
      sourceRow: Number(entry.sourceRow || entry.rowNumber || 0) || null,
      status,
      completedAt: new Date(completedAt).toISOString()
    };
    const key = completionHistoryKey(clean);
    const existing = byKey.get(key);
    if (!existing || new Date(clean.completedAt) < new Date(existing.completedAt)) {
      byKey.set(key, clean);
    }
  });

  return Array.from(byKey.values())
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
}

function mergeCompletionHistory(existing, incoming) {
  return normaliseCompletionHistory([...(existing || []), ...(incoming || [])]);
}

function isSheetTask(item) {
  return /^sheet-task-\d+$/.test(String(item && item.id ? item.id : ""));
}

function taskKey(item) {
  return String((item && item.id) || (item && item.title) || "");
}

function normaliseStoredTasks(tasks, legacyHistory = []) {
  if (!Array.isArray(tasks)) return [];
  const historyByKey = new Map();

  normaliseCompletionHistory(legacyHistory).forEach((entry) => {
    if (entry.taskKey && entry.completedAt) historyByKey.set(String(entry.taskKey), entry.completedAt);
  });

  return tasks.map((item) => {
    const task = item && typeof item === "object" ? { ...item } : {};
    task.id = String(task.id || createId());
    task.title = String(task.title || task.task || "").trim();
    task.due = String(task.due || task.dueDate || "");
    task.status = normaliseTaskStatus(task.status);
    const completedAt = normaliseDateTime(task.completedAt) || historyByKey.get(taskKey(task)) || "";
    task.completedAt = task.status === "Done" ? completedAt : "";
    return task;
  });
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

function isReminderTask(item) {
  return /^Reminder:/i.test(String(item.title || ""));
}

function displayTaskTitle(item) {
  return String(item.title || "").replace(/^Reminder:\s*/i, "").trim() || item.title;
}

function taskMetaText(item) {
  const dateText = item.due ? formatDate(item.due) : "No date set";
  return isReminderTask(item) ? `Reminder due ${dateText}` : `Due ${dateText}`;
}

function taskCompletionText(item) {
  return item.completedAt ? `Completed ${formatDateTime(item.completedAt)}` : "Completed: Not recorded";
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
    const itemActions = actions(item);
    const isTask = key === "tasks";
    const isReminder = isTask && isReminderTask(item);
    node.classList.add(`item--${key}`);
    node.classList.toggle("is-done", item.status === "Done");
    node.classList.toggle("is-reminder", isReminder);

    if (isTask) {
      const toggleAction = itemActions[0];
      const check = document.createElement("button");
      check.type = "button";
      check.className = "task-check";
      check.setAttribute("aria-pressed", item.status === "Done" ? "true" : "false");
      check.setAttribute("aria-label", `${item.status === "Done" ? "Reopen" : "Mark done"}: ${displayTaskTitle(item)}`);
      check.addEventListener("click", toggleAction.onClick);
      node.prepend(check);
      node.querySelector(".item__title").textContent = displayTaskTitle(item);
    } else {
      node.querySelector(".item__title").textContent = title(item);
    }

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
    const visibleActions = key === "tasks" ? itemActions.slice(0, 1) : itemActions;
    visibleActions.forEach((action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `mini-button${action.danger ? " mini-button--danger" : ""}`;
      if (isTask) button.classList.add("task-primary-action");
      button.textContent = action.label;
      button.addEventListener("click", action.onClick);
      actionWrap.append(button);
    });

    if (key === "tasks" && itemActions.length > 1) {
      const more = document.createElement("details");
      more.className = "task-more";
      const summary = document.createElement("summary");
      summary.className = "task-more__summary";
      summary.setAttribute("aria-label", `More actions for ${displayTaskTitle(item)}`);
      summary.textContent = "More";
      more.append(summary);
      itemActions.slice(1).forEach((action) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `mini-button${action.danger ? " mini-button--danger" : ""}`;
        button.textContent = action.label;
        button.addEventListener("click", action.onClick);
        more.append(button);
      });
      actionWrap.append(more);
    }

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
    state.tasks.push(localTaskRecord(task, today(), "Open"));
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
        const match = isSheetTask(item) ? /^sheet-task-(\d+)$/.exec(String(item.id || "")) : null;
        if (match) {
          try {
            await sheetWrite("updateTaskStatus", { rowNumber: Number(match[1]), status: nextStatus });
            setApiStatus("Saved to Google Sheet.", "success");
            return;
          } catch (err) {
            setApiStatus("Sheet unavailable — updated in this browser only.", "error");
          }
        }
        applyLocalTaskStatus(item, nextStatus);
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
        applyLocalTaskStatus(item, status);
        saveState();
        renderAll();
      }
    },
    { label: "Delete", danger: true, onClick: () => removeTask(item.id) }
  ];
}

function applyLocalTaskStatus(item, status) {
  item.status = normaliseTaskStatus(status);
  if (item.status === "Done") {
    item.completedAt = normaliseDateTime(item.completedAt) || new Date().toISOString();
  } else if (!isSheetTask(item)) {
    item.completedAt = "";
  } else {
    item.completedAt = "";
  }
}

function localTaskRecord(title, due = "", status = "Open") {
  const task = {
    id: createId(),
    title,
    due,
    status: "Open",
    completedAt: ""
  };
  applyLocalTaskStatus(task, status);
  return task;
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

function weekStartDate() {
  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

function reminderDueCount() {
  const todayStr = today();
  const dueReminderTasks = state.tasks.filter((item) => (
    item.status !== "Done" &&
    isReminderTask(item) &&
    item.due &&
    item.due <= todayStr
  )).length;

  const dueDeadlineReminders = state.deadlines.filter((item) => {
    if (!item || !item.date || item.date < todayStr) return false;
    const reminderDate = reminderDateFor(item.date, Number.parseInt(item.leadDays, 10) || 0);
    return reminderDate && reminderDate <= todayStr;
  }).length;

  return dueReminderTasks + dueDeadlineReminders;
}

function completedTasksForProgress() {
  const tasks = state.tasks
    .filter((item) => normaliseTaskStatus(item.status) === "Done")
    .map((item) => ({
      id: taskKey(item),
      title: displayTaskTitle(item) || "Completed task",
      completedAt: normaliseDateTime(item.completedAt),
      source: isSheetTask(item) ? "sheet" : "local"
    }));

  return tasks.sort((a, b) => {
    if (a.completedAt && b.completedAt) return new Date(b.completedAt) - new Date(a.completedAt);
    if (a.completedAt) return -1;
    if (b.completedAt) return 1;
    return a.title.localeCompare(b.title);
  });
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

  renderTodayBlocks();

  const todayTasks = state.tasks.filter((item) => item.due === today() && item.status !== "Done");
  const weekTasks = state.tasks.filter((item) => item.due !== today() && item.status !== "Done");

  renderItemList({
    key: "tasks",
    targetId: "today-task-list",
    emptyText: "No extra tasks for today.",
    items: todayTasks,
    title: (item) => item.title,
    meta: taskMetaText,
    pill: taskStatusPill,
    actions: taskActions
  });

  renderItemList({
    key: "tasks",
    targetId: "task-list",
    emptyText: "No weekly tasks yet.",
    items: weekTasks,
    title: (item) => item.title,
    meta: taskMetaText,
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
  renderProgress();
}

function renderProgress() {
  const history = document.getElementById("progress-history");
  if (!history) return;
  const monday = weekStartDate();
  const completedTasks = completedTasksForProgress();
  const completedThisWeek = completedTasks.filter((entry) => entry.completedAt && new Date(entry.completedAt) >= monday).length;
  document.getElementById("progress-completed").textContent = String(completedThisWeek);
  document.getElementById("progress-open").textContent = String(state.tasks.filter((item) => item.status !== "Done").length);
  document.getElementById("progress-reminders").textContent = String(reminderDueCount());
  history.innerHTML = "";
  if (!completedTasks.length) {
    const empty = document.createElement("li"); empty.className = "empty"; empty.textContent = "Completed tasks will appear here with the date they were marked done."; history.append(empty); return;
  }
  completedTasks.slice(0, 30).forEach((entry) => {
    const row = document.createElement("li"); row.className = "progress-history__item";
    const title = document.createElement("strong"); title.textContent = entry.title;
    const date = document.createElement("span");
    date.textContent = entry.completedAt ? `Completed ${formatDateTime(entry.completedAt)}` : "Completed: Not recorded";
    row.append(title, date); history.append(row);
  });
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

function dateKeyFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function reminderDateFor(dueDate, leadDays) {
  if (!dueDate || !leadDays) return "";
  const reminder = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(reminder.getTime())) return "";
  reminder.setDate(reminder.getDate() - leadDays);
  return dateKeyFromDate(reminder);
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
  const letterBox = document.getElementById("letter-materials-checklist");
  const letterLabel = document.getElementById("letter-materials-label");
  if (!box || !label || !addRow) return;

  label.textContent = materialSourceIsApproved()
    ? "Approved materials from Google Sheet"
    : "Temporary dummy materials";
  if (letterLabel) {
    letterLabel.textContent = materialSourceIsApproved()
      ? "Supporting materials - approved from Google Sheet"
      : "Supporting materials - temporary dummy materials";
  }
  addRow.hidden = materialSourceIsApproved();
  box.innerHTML = "";
  if (letterBox) letterBox.innerHTML = "";

  function appendMaterialRow(target, item, index) {
    const row = document.createElement("label");
    row.className = "material-item";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(item.selected);
    checkbox.addEventListener("change", () => {
      testMaterials[index].selected = checkbox.checked;
      renderMaterialsChecklist();
    });
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
    target.append(row);
  }

  testMaterials.forEach((item, index) => {
    appendMaterialRow(box, item, index);
    if (letterBox) appendMaterialRow(letterBox, item, index);
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

const LETTER_TEMPLATE_COPY = {
  general: {
    title: "General correspondence",
    paragraphs: [
      "We write about the above matter.",
      "Please review the draft information below and replace these placeholder paragraphs with approved, matter-specific wording before use.",
      "The enclosed materials are listed for review only and have not been attached by this dashboard."
    ]
  },
  followup: {
    title: "Follow-up letter",
    paragraphs: [
      "We write further to the recent contact about the above matter.",
      "The current next steps are set out below as placeholders for approved wording.",
      "Please review any supporting materials listed in this draft package before finalising the letter."
    ]
  },
  request: {
    title: "Information request",
    paragraphs: [
      "We request the information or documents relevant to the above matter.",
      "Replace this placeholder text with the approved request wording and the specific items required.",
      "The supporting materials list below is for manual review only."
    ]
  },
  acknowledgement: {
    title: "Acknowledgement",
    paragraphs: [
      "We acknowledge receipt of the material relating to the above matter.",
      "This placeholder letter should be reviewed against an approved template before use.",
      "No outgoing communication is generated by this dashboard."
    ]
  }
};

function selectedMaterialLines() {
  const selected = testMaterials.filter((item) => item.selected);
  if (!selected.length) return ["- [No supporting materials selected.]"];
  return selected.map((item) => {
    const suffix = item.reference ? ` - ${item.reference}` : "";
    return `- ${item.name}${suffix}`;
  });
}

function letterFieldValue(id, fallback) {
  const value = document.getElementById(id).value.trim();
  return value || fallback;
}

function letterPackageText() {
  const templateKey = document.getElementById("letter-template").value;
  const template = LETTER_TEMPLATE_COPY[templateKey] || LETTER_TEMPLATE_COPY.general;
  const recipient = letterFieldValue("letter-recipient", "[Recipient/client name]");
  const matter = letterFieldValue("letter-matter", "[Matter/reference]");
  const purpose = letterFieldValue("letter-purpose", "[Letter purpose]");

  return [
    "TEST/DRAFT - LETTER + PDF PACKER",
    "Not approved for sending. Manual review required.",
    "",
    `Template: Placeholder - ${template.title}`,
    `Recipient/client: ${recipient}`,
    `Matter/reference: ${matter}`,
    `Purpose: ${purpose}`,
    "",
    "Letter draft",
    "",
    `Dear ${recipient},`,
    "",
    ...template.paragraphs,
    "",
    "Matter-specific content to approve",
    "- [Insert approved client/matter-specific wording here.]",
    "- [Confirm facts, dates, attachments and sign-off before use.]",
    "",
    "Supporting materials selected for manual review",
    ...selectedMaterialLines(),
    "",
    "Approvals/assets still needed",
    "- Approved final letter template wording.",
    "- Approved letterhead/header/footer and sign-off block.",
    "- Confirmed document naming convention and PDF bundling process.",
    "- Confirmation that selected supporting documents are correct and approved for this recipient.",
    "",
    "Static app limits",
    "- No auto-send.",
    "- No email recipient generation.",
    "- No uploads or file attachments.",
    "- No write-back of client data to the Google Sheet.",
    "- No practice-system integration.",
    "",
    "Kind regards,",
    "Sue"
  ].join("\n");
}

function setLetterStatus(message, type = "info") {
  const status = document.getElementById("letter-packer-status");
  status.textContent = message;
  status.className = `import-status import-status--${type}`;
}

function ensureLetterDraft() {
  const preview = document.getElementById("letter-preview");
  if (!preview.value.trim()) preview.value = letterPackageText();
  return preview.value;
}

function updateLetterPrintArea(text) {
  const printArea = document.getElementById("letter-print-area");
  printArea.innerHTML = "";
  const pre = document.createElement("pre");
  pre.textContent = text;
  printArea.append(pre);
}

function setupLetterPacker() {
  const form = document.getElementById("letter-packer-form");
  if (!form) return;
  const preview = document.getElementById("letter-preview");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
  });

  document.getElementById("generate-letter-draft").addEventListener("click", () => {
    preview.value = letterPackageText();
    setLetterStatus("TEST/DRAFT package generated in this page only.", "success");
  });

  document.getElementById("download-letter-draft").addEventListener("click", () => {
    const text = ensureLetterDraft();
    downloadFile(`letter-pdf-packer-draft-${today()}.txt`, "text/plain", text);
    setLetterStatus("Downloaded a text draft package. No PDF was generated by the app.", "success");
  });

  document.getElementById("print-letter-draft").addEventListener("click", () => {
    updateLetterPrintArea(ensureLetterDraft());
    setLetterStatus("Browser print opened. Use Save as PDF if available in the print dialog.", "success");
    window.print();
  });

  document.getElementById("clear-letter-draft").addEventListener("click", () => {
    form.reset();
    preview.value = "";
    updateLetterPrintArea("");
    setLetterStatus("Draft fields cleared from this page.", "info");
  });
}

function setupForms() {
  const captureText = document.getElementById("capture-text");
  const captureDue = document.getElementById("capture-due");
  const captureReminderDays = document.getElementById("capture-reminder-days");
  const capturePreview = document.getElementById("capture-preview");
  const captureSpeechStatus = document.getElementById("capture-speech-status");
  const captureSubmitStatus = document.getElementById("capture-submit-status");
  const captureSaveState = document.getElementById("capture-save-state");
  const captureSpeak = document.getElementById("capture-speak");

  function captureTitle(text) {
    return text
      .replace(/\bby\s+(?:next\s+\w+,?\s*)?\d{1,2}\s+[a-z]+\s+\d{4}\b/ig, "")
      .replace(/\bremind\s+me\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|fourteen)\s+days?\s+(?:before|beforehand)\b/ig, "")
      .replace(/\s{2,}/g, " ")
      .replace(/^[.;,\s]+|[.;,\s]+$/g, "")
      .trim() || text;
  }

  function dateFromCaptureText(text) {
    const months = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11 };
    const match = text.match(/\b(?:by\s+)?(?:next\s+\w+,?\s*)?(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(20\d{2})\b/i);
    if (!match) return "";
    const date = new Date(Number(match[3]), months[match[2].toLowerCase()], Number(match[1]));
    if (Number.isNaN(date.getTime()) || date.getFullYear() !== Number(match[3]) || date.getMonth() !== months[match[2].toLowerCase()] || date.getDate() !== Number(match[1])) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function reminderDaysFromCaptureText(text) {
    const match = text.match(/\bremind\s+me\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|fourteen)\s+days?\s+(?:before|beforehand)\b/i);
    if (!match) return "";
    const words = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fourteen: 14 };
    const count = words[String(match[1]).toLowerCase()] || Number(match[1]);
    return String(Math.min(365, Math.max(0, count)));
  }

  function capturePlan(parseText = false) {
    if (parseText && !captureDue.value) {
      const parsedDate = dateFromCaptureText(captureText.value);
      if (parsedDate) captureDue.value = parsedDate;
    }
    if (parseText) {
      const parsedLead = reminderDaysFromCaptureText(captureText.value);
      if (parsedLead) captureReminderDays.value = parsedLead;
    }

    const sourceText = captureText.value.trim();
    const task = captureTitle(sourceText);
    const dueDate = captureDue.value;
    const leadDays = Math.min(365, Math.max(0, Number.parseInt(captureReminderDays.value, 10) || 0));
    const reminderDate = reminderDateFor(dueDate, leadDays);

    return { sourceText, task, dueDate, leadDays, reminderDate };
  }

  function setCaptureStatus(message, type = "info") {
    captureSubmitStatus.textContent = message;
    captureSubmitStatus.className = `import-status import-status--${type}`;
  }

  function renderStructuredCapturePreview(plan) {
    const rows = [];
    if (!plan.task) {
      rows.push("Task: waiting for text.");
    } else {
      rows.push(`Task: ${plan.task}`);
    }
    rows.push(plan.dueDate
      ? `Due: ${formatDate(plan.dueDate)}. Reminder: ${plan.leadDays} day${plan.leadDays === 1 ? "" : "s"} before${plan.reminderDate ? ` (${formatDate(plan.reminderDate)})` : ""}.`
      : "Due/reminder: not recognised yet.");
    rows.push("Will create: task plus deadline/reminder record.");

    capturePreview.innerHTML = "";
    const heading = document.createElement("strong");
    heading.textContent = "Confirmation";
    capturePreview.append(heading);
    rows.forEach((text) => {
      const row = document.createElement("span");
      row.textContent = text;
      capturePreview.append(row);
    });
  }

  function refreshCapturePreview(parseText = false) {
    renderStructuredCapturePreview(capturePlan(parseText));
  }

  function updateSpeechSupportStatus(message, type = "info") {
    captureSpeechStatus.textContent = message;
    captureSpeechStatus.className = `capture-status capture-status--${type}`;
  }

  function focusCaptureTextForKeyboard() {
    captureText.focus({ preventScroll: false });
    const end = captureText.value.length;
    try {
      captureText.setSelectionRange(end, end);
    } catch {
      // Some mobile browsers may not expose selection APIs until the field is active.
    }
    captureText.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function showKeyboardDictationFallback() {
    captureSaveState.textContent = "Typed fallback ready";
    focusCaptureTextForKeyboard();
    updateSpeechSupportStatus("Use the microphone on the iPhone keyboard to dictate", "info");
  }

  function initialiseSpeechCapture() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      captureSpeak.disabled = false;
      captureSpeak.textContent = "Dictate / type task";
      updateSpeechSupportStatus("Use the microphone on the iPhone keyboard to dictate", "info");
      return null;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      updateSpeechSupportStatus("Speech recognition is available, but microphone permission cannot be checked here. Type fallback remains ready.", "info");
      return Recognition;
    }

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: "microphone" }).then((permission) => {
        const describe = () => {
          if (permission.state === "granted") updateSpeechSupportStatus("Microphone permission is allowed. Speak can fill the typed field.", "success");
          else if (permission.state === "denied") updateSpeechSupportStatus("Microphone permission is blocked. Type the task instead or allow the microphone in browser settings.", "error");
          else updateSpeechSupportStatus("Microphone permission will be requested when Speak is pressed. Typed capture is ready.", "info");
        };
        describe();
        permission.addEventListener("change", describe);
      }).catch(() => {
        updateSpeechSupportStatus("Speech recognition is available. Browser permission will be requested when Speak is pressed.", "info");
      });
    } else {
      updateSpeechSupportStatus("Speech recognition is available. Browser permission will be requested when Speak is pressed.", "info");
    }

    return Recognition;
  }

  captureText.addEventListener("input", () => refreshCapturePreview(true));
  captureDue.addEventListener("change", () => refreshCapturePreview(false));
  captureReminderDays.addEventListener("change", () => refreshCapturePreview(false));

  const SpeechRecognitionConstructor = initialiseSpeechCapture();

  captureSpeak.addEventListener("click", () => {
    const Recognition = SpeechRecognitionConstructor || window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      showKeyboardDictationFallback();
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "en-AU"; recognition.interimResults = false; recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      captureSaveState.textContent = "Listening";
      updateSpeechSupportStatus("Listening. Speak the task, due date and reminder lead time.", "info");
    };
    recognition.onresult = (event) => {
      captureText.value = event.results[0][0].transcript;
      captureSaveState.textContent = "Review before saving";
      updateSpeechSupportStatus("Speech captured. Review the text and dates before saving.", "success");
      refreshCapturePreview(true);
    };
    recognition.onerror = () => {
      showKeyboardDictationFallback();
    };
    recognition.onend = () => {
      if (captureSaveState.textContent === "Listening") captureSaveState.textContent = "Typed fallback ready";
    };
    try {
      recognition.start();
    } catch {
      showKeyboardDictationFallback();
    }
  });

  document.getElementById("capture-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const { sourceText, task, dueDate, leadDays, reminderDate } = capturePlan(true);
    if (!sourceText || !task) return;
    if (!dueDate) {
      setCaptureStatus("Choose a due date before creating the work task.", "error");
      return;
    }
    const deadlineRecord = {
      id: createId(),
      title: task,
      date: dueDate,
      leadDays
    };
    try {
      await sheetWrite("addTask", { task, type: "Admin", priority: "Normal", status: "Open", dueDate });
      await sheetWrite("addDeadline", { title: task, date: dueDate, leadDays, reminderDate });
      setApiStatus("Task and deadline/reminder saved to Google Sheet.", "success");
      setCaptureStatus(`Created in the Google Sheet: task plus deadline/reminder record. Due ${formatDate(dueDate)}; reminder ${leadDays} day${leadDays === 1 ? "" : "s"} before${reminderDate ? ` (${formatDate(reminderDate)})` : ""}.`, "success");
    } catch (err) {
      state.tasks.push(localTaskRecord(task, dueDate, "Open"));
      state.deadlines.push(deadlineRecord);
      sortDeadlines();
      setApiStatus("Sheet write unavailable — Quick Capture saved in this browser only.", "error");
      setCaptureStatus(`Sheet write failed or is unavailable. Stored locally: task plus deadline/reminder record. Due ${formatDate(dueDate)}; reminder ${leadDays} day${leadDays === 1 ? "" : "s"} before${reminderDate ? ` (${formatDate(reminderDate)})` : ""}.`, "error");
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
      state.tasks.push(localTaskRecord(task, due, status));
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
    { tab: document.getElementById("progress-tab"), panel: document.getElementById("progress-panel") },
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
setupLetterPacker();
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
    .map((r) => {
      const status = normaliseSheetStatus(r.status);
      const completedAt = status === "Done"
        ? normaliseDateTime(pickField(r, [
          "completedAt",
          "completedDate",
          "completedOn",
          "completionDate",
          "completionTimestamp",
          "dateCompleted",
          "Completed At",
          "Completed Date",
          "Completed On",
          "Completion Date",
          "Date Completed"
        ]))
        : "";
      return {
        id: `sheet-task-${r.rowNumber}`,
        title: String(r.task || "").trim(),
        due: r.dueDate || "",
        status,
        completedAt
      };
    });
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

function mapSheetCompletionHistory(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => {
      if (!r || typeof r !== "object") return null;
      const sourceRow = Number(r.sourceRow || r.rowNumber || 0);
      const title = String(r.title || r.task || r.taskTitle || "").trim();
      const completedAt = String(r.completedAt || r.completedTimestamp || "").trim();
      const status = normaliseTaskStatus(r.status || "Done");
      if (!sourceRow || !title || !completedAt || Number.isNaN(new Date(completedAt).getTime())) return null;
      return {
        id: `sheet-history-${sourceRow}-${status}`,
        taskKey: `sheet-task-${sourceRow}`,
        title,
        sourceRow,
        status,
        completedAt
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
  const completionHistory = mapSheetCompletionHistory(data.completionHistory || data.taskHistory);
  state.tasks = tasks;
  state.deadlines = deadlines;
  state.completionHistory = mergeCompletionHistory(state.completionHistory, completionHistory);
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
