(function () {
  "use strict";

  const SHEET_API_URL = "https://script.google.com/macros/s/AKfycbzbfT3gTYqPdkLmxGF6BZGLiGFplwzk9dIFGOJVUExASHPU83Mxxi1-ORAJNNBUfGnf/exec";
  const SHEET_API_TIMEOUT_MS = 10000;
  const MAX_WEEKS = 8;
  const RECENT_ITEMS_LIMIT = 6;

  const statusEl = document.getElementById("history-status");
  const weeksEl = document.getElementById("history-weeks");
  const rangeEl = document.getElementById("history-range");

  const auDate = new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Sydney"
  });
  const auShortDate = new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    timeZone: "Australia/Sydney"
  });
  const auDateTime = new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Australia/Sydney"
  });

  function setStatus(text, kind) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.className = "history-status" + (kind ? " history-status--" + kind : "");
    statusEl.hidden = false;
  }

  function hideStatus() {
    if (statusEl) statusEl.hidden = true;
  }

  function jsonpGetDashboardData() {
    return new Promise(function (resolve, reject) {
      const cbName = "__sueHistoryCb_" + Date.now() + "_" + Math.floor(Math.random() * 1e9);
      const script = document.createElement("script");
      let timer;

      function cleanup() {
        clearTimeout(timer);
        try {
          delete window[cbName];
        } catch (_err) {
          window[cbName] = undefined;
        }
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      window[cbName] = function (payload) {
        cleanup();
        if (payload && payload.ok) {
          resolve(payload.data || {});
        } else {
          reject(new Error(payload && payload.error ? payload.error : "sheet api error"));
        }
      };

      script.onerror = function () {
        cleanup();
        reject(new Error("sheet api unreachable"));
      };

      timer = setTimeout(function () {
        cleanup();
        reject(new Error("sheet api timeout"));
      }, SHEET_API_TIMEOUT_MS);

      const params = new URLSearchParams({ action: "dashboardData", callback: cbName });
      const sep = SHEET_API_URL.includes("?") ? "&" : "?";
      script.src = SHEET_API_URL + sep + params.toString();
      document.head.appendChild(script);
    });
  }

  function parseDate(value) {
    if (!value) return null;
    const text = String(value).trim();
    if (!text) return null;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(text + "T00:00:00") : new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function startOfMondayWeek(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function isoWeekInfo(date) {
    const start = startOfMondayWeek(date);
    const tmp = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()));
    const dayNum = (tmp.getUTCDay() + 6) % 7;
    tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3);
    const firstThursday = tmp.getTime();
    tmp.setUTCMonth(0, 1);
    if (tmp.getUTCDay() !== 4) {
      tmp.setUTCMonth(0, 1 + ((4 - tmp.getUTCDay()) + 7) % 7);
    }
    const week = 1 + Math.round((firstThursday - tmp.getTime()) / 604800000);
    const year = new Date(firstThursday).getUTCFullYear();
    return { key: year + "-W" + String(week).padStart(2, "0"), year: year, week: week, start: start };
  }

  function formatWeekRange(start) {
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    return auShortDate.format(start) + " - " + auDate.format(end);
  }

  function normaliseStatus(value) {
    const status = String(value || "").trim().toLowerCase();
    if (!status) return "Done";
    if (status === "done" || status === "complete" || status === "completed") return "Done";
    return String(value).trim();
  }

  function isCompletedStatus(value) {
    return normaliseStatus(value).toLowerCase().match(/^(done|complete|completed)$/);
  }

  function normaliseCompletedTasks(data) {
    const rows = []
      .concat(Array.isArray(data && data.completionHistory) ? data.completionHistory : [])
      .concat(Array.isArray(data && data.taskHistory) ? data.taskHistory : []);
    const seen = new Set();

    return rows
      .map(function (row) {
        if (!row || typeof row !== "object") return null;
        const title = String(row.title || row.task || row.taskTitle || row.name || "").trim();
        const completedAt = parseDate(
          row.completedAt ||
          row.completedTimestamp ||
          row.completedDate ||
          row.completedOn ||
          row.completionDate ||
          row.dateCompleted ||
          row.timestamp
        );
        const status = normaliseStatus(row.status || "Done");
        if (!title || !completedAt || !isCompletedStatus(status)) return null;
        const sourceRow = String(row.sourceRow || row.rowNumber || "");
        const key = [sourceRow, title, completedAt.toISOString()].join("|");
        if (seen.has(key)) return null;
        seen.add(key);
        return { title: title, completedAt: completedAt, status: status };
      })
      .filter(Boolean)
      .sort(function (a, b) {
        return b.completedAt - a.completedAt;
      });
  }

  function pickExplicitHealthPayload(data) {
    if (!data || typeof data !== "object") return null;
    const keys = [
      "healthHistory",
      "healthStatus",
      "healthStatuses",
      "weeklyHealthHistory",
      "weeklyHealthStatus",
      "personalHealthHistory",
      "personalHealthStatus",
      "health-history",
      "health-status",
      "weekly-health-history",
      "weekly-health-status",
      "personal-health-history",
      "personal-health-status"
    ];

    for (const key of keys) {
      if (Object.hasOwn(data, key) && data[key] !== null && data[key] !== undefined && data[key] !== "") {
        return { key: key, value: data[key] };
      }
    }
    return null;
  }

  function healthRowsFromPayload(payload) {
    if (!payload) return [];
    if (Array.isArray(payload.value)) return payload.value;
    if (typeof payload.value === "object") {
      return Object.entries(payload.value).map(function ([key, value]) {
        if (value && typeof value === "object") {
          return { ...value, date: value.date || value.weekStart || key };
        }
        return { date: key, status: value };
      });
    }
    return [{ status: payload.value }];
  }

  function normaliseHealthItems(data) {
    const payload = pickExplicitHealthPayload(data);
    if (!payload) return { available: false, items: [] };

    const items = healthRowsFromPayload(payload)
      .map(function (row) {
        if (!row || typeof row !== "object") return null;
        const date = parseDate(row.weekStart || row.week || row.date || row.dateKey || row.completedAt || row.timestamp);
        const status = String(row.status || row.summary || row.label || row.note || row.title || "").trim();
        const parts = [];

        [
          ["Activity", row.activity || row.activityDays || row.days],
          ["Strength", row.strength || row.strengthSessions],
          ["Yoga/Pilates", row.yoga || row.yogaSessions || row.pilates]
        ].forEach(function ([label, value]) {
          if (value === null || value === undefined || value === "") return;
          parts.push(label + ": " + String(value).trim());
        });

        const text = status || parts.join(" | ");
        if (!text) return null;
        return { date: date, text: text };
      })
      .filter(Boolean);

    return { available: true, items: items };
  }

  function ensureWeek(map, info) {
    if (!map.has(info.key)) {
      map.set(info.key, {
        key: info.key,
        year: info.year,
        week: info.week,
        start: info.start,
        completedTasks: [],
        healthItems: []
      });
    }
    return map.get(info.key);
  }

  function buildWeeks(data) {
    const map = new Map();
    const completedTasks = normaliseCompletedTasks(data);
    const health = normaliseHealthItems(data);

    completedTasks.forEach(function (item) {
      const info = isoWeekInfo(item.completedAt);
      ensureWeek(map, info).completedTasks.push(item);
    });

    if (health.available) {
      health.items.forEach(function (item) {
        const date = item.date || new Date();
        const info = isoWeekInfo(date);
        ensureWeek(map, info).healthItems.push(item);
      });
    }

    return {
      healthAvailable: health.available,
      weeks: Array.from(map.values())
        .sort(function (a, b) {
          return b.start - a.start;
        })
        .slice(0, MAX_WEEKS)
    };
  }

  function appendSummary(section, week, healthAvailable) {
    const summary = document.createElement("p");
    summary.className = "history-week__empty";
    const bits = [week.completedTasks.length + " completed task" + (week.completedTasks.length === 1 ? "" : "s")];
    if (healthAvailable) {
      bits.push(week.healthItems.length + " health status " + (week.healthItems.length === 1 ? "entry" : "entries"));
    }
    summary.textContent = bits.join(" | ");
    section.appendChild(summary);
  }

  function appendCompletedTasks(section, tasks) {
    const group = document.createElement("div");
    group.className = "history-week__group";

    const heading = document.createElement("h4");
    heading.textContent = "Recently completed";
    group.appendChild(heading);

    if (!tasks.length) {
      const empty = document.createElement("p");
      empty.className = "history-week__empty";
      empty.textContent = "No completed tasks recorded for this week.";
      group.appendChild(empty);
    } else {
      const ul = document.createElement("ul");
      ul.className = "history-week__list";
      tasks.slice(0, RECENT_ITEMS_LIMIT).forEach(function (task) {
        const li = document.createElement("li");
        const time = document.createElement("time");
        time.dateTime = task.completedAt.toISOString();
        time.textContent = auDateTime.format(task.completedAt);
        const title = document.createElement("span");
        title.textContent = task.title;
        li.appendChild(time);
        li.appendChild(title);
        ul.appendChild(li);
      });
      group.appendChild(ul);
    }

    section.appendChild(group);
  }

  function appendHealth(section, week, healthAvailable) {
    const group = document.createElement("div");
    group.className = "history-week__group";

    const heading = document.createElement("h4");
    heading.textContent = "Health status";
    group.appendChild(heading);

    if (!healthAvailable) {
      const empty = document.createElement("p");
      empty.className = "history-week__empty";
      empty.textContent = "Weekly health history will start when recorded.";
      group.appendChild(empty);
    } else if (!week.healthItems.length) {
      const empty = document.createElement("p");
      empty.className = "history-week__empty";
      empty.textContent = "No health status recorded for this week.";
      group.appendChild(empty);
    } else {
      const ul = document.createElement("ul");
      ul.className = "history-week__list";
      week.healthItems.forEach(function (item) {
        const li = document.createElement("li");
        if (item.date) {
          const time = document.createElement("time");
          time.dateTime = item.date.toISOString();
          time.textContent = auShortDate.format(item.date);
          li.appendChild(time);
        }
        const text = document.createElement("span");
        text.textContent = item.text;
        li.appendChild(text);
        ul.appendChild(li);
      });
      group.appendChild(ul);
    }

    section.appendChild(group);
  }

  function renderWeek(week, healthAvailable) {
    const section = document.createElement("section");
    section.className = "history-week";
    section.setAttribute("aria-label", "Week of " + formatWeekRange(week.start));

    const header = document.createElement("header");
    header.className = "history-week__header";

    const title = document.createElement("h3");
    title.className = "history-week__title";
    title.textContent = week.year + " - Week " + week.week;

    const range = document.createElement("span");
    range.className = "history-week__range";
    range.textContent = formatWeekRange(week.start);

    header.appendChild(title);
    header.appendChild(range);
    section.appendChild(header);

    appendSummary(section, week, healthAvailable);
    appendCompletedTasks(section, week.completedTasks);
    appendHealth(section, week, healthAvailable);

    return section;
  }

  function selectedWeekLimit() {
    const value = Number(rangeEl && rangeEl.value ? rangeEl.value : MAX_WEEKS);
    return Number.isFinite(value) && value > 0 ? Math.min(value, MAX_WEEKS) : MAX_WEEKS;
  }

  function render(data) {
    if (!weeksEl) return;
    const built = buildWeeks(data);
    const weeks = built.weeks.slice(0, selectedWeekLimit());
    weeksEl.innerHTML = "";

    if (!weeks.length) {
      setStatus("No completed tasks have been recorded yet. Weekly health history will start when recorded.", "empty");
      return;
    }

    const frag = document.createDocumentFragment();
    weeks.forEach(function (week) {
      frag.appendChild(renderWeek(week, built.healthAvailable));
    });
    weeksEl.appendChild(frag);

    if (built.healthAvailable) {
      hideStatus();
    } else {
      setStatus("Showing completed task history only. Weekly health history will start when recorded.", "empty");
    }
  }

  if (rangeEl) {
    rangeEl.addEventListener("change", function () {
      jsonpGetDashboardData()
        .then(render)
        .catch(function (err) {
          setStatus("Could not load Herstory — Week by week: " + (err && err.message ? err.message : err), "error");
          if (weeksEl) weeksEl.innerHTML = "";
        });
    });
  }

  setStatus("Loading Herstory — Week by week from the sheet...", "");
  jsonpGetDashboardData()
    .then(render)
    .catch(function (err) {
      setStatus("Could not load Herstory — Week by week: " + (err && err.message ? err.message : err), "error");
      if (weeksEl) weeksEl.innerHTML = "";
    });
})();
