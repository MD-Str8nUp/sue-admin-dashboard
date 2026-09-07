(function () {
  "use strict";

  const SHEET_API_URL = "https://script.google.com/macros/s/AKfycbzbfT3gTYqPdkLmxGF6BZGLiGFplwzk9dIFGOJVUExASHPU83Mxxi1-ORAJNNBUfGnf/exec";
  const SHEET_API_TIMEOUT_MS = 10000;

  const statusEl = document.getElementById("history-status");
  const weeksEl = document.getElementById("history-weeks");
  const rangeEl = document.getElementById("history-range");

  let dashboardResult = null;
  let personalResult = null;

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.className = "history-status" + (kind ? " history-status--" + kind : "");
    statusEl.hidden = false;
  }

  function hideStatus() {
    statusEl.hidden = true;
  }

  function jsonpGet(action) {
    return new Promise((resolve, reject) => {
      const cbName = "__sueHistoryCb_" + Date.now() + "_" + Math.floor(Math.random() * 1e9);
      const script = document.createElement("script");
      let timer;

      function cleanup() {
        clearTimeout(timer);
        try { delete window[cbName]; } catch (_e) { window[cbName] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      window[cbName] = function (payload) {
        cleanup();
        if (payload && payload.ok) {
          resolve(payload.data);
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

      const params = new URLSearchParams({ action: action, callback: cbName });
      const sep = SHEET_API_URL.includes("?") ? "&" : "?";
      script.src = SHEET_API_URL + sep + params.toString();
      document.head.appendChild(script);
    });
  }

  // ISO week helpers (Monday start).
  function startOfIsoWeek(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dow = d.getDay(); // 0=Sun
    const offset = dow === 0 ? -6 : 1 - dow;
    d.setDate(d.getDate() + offset);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function isoWeekKey(date) {
    const start = startOfIsoWeek(date);
    // ISO week number
    const tmp = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()));
    const dayNum = (tmp.getUTCDay() + 6) % 7;
    tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3);
    const firstThursday = tmp.getTime();
    tmp.setUTCMonth(0, 1);
    if (tmp.getUTCDay() !== 4) {
      tmp.setUTCMonth(0, 1 + ((4 - tmp.getUTCDay()) + 7) % 7);
    }
    const weekNum = 1 + Math.round((firstThursday - tmp.getTime()) / (7 * 24 * 3600 * 1000));
    const year = new Date(firstThursday).getUTCFullYear();
    return { key: year + "-W" + String(weekNum).padStart(2, "0"), year: year, week: weekNum, start: start };
  }

  const AU_DATE = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Sydney" });
  const AU_SHORT = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", timeZone: "Australia/Sydney" });
  const AU_TIME = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Australia/Sydney" });

  function fmtRange(start) {
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    return AU_SHORT.format(start) + " – " + AU_DATE.format(end);
  }

  function parseDate(value) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }

  function buildWeeks(completionRows, personal) {
    const map = new Map();

    function ensureWeek(info) {
      if (!map.has(info.key)) {
        map.set(info.key, {
          key: info.key,
          year: info.year,
          week: info.week,
          start: info.start,
          completedTasks: [],
          activityDays: [],
          strengthSessions: [],
          yogaSessions: []
        });
      }
      return map.get(info.key);
    }

    (Array.isArray(completionRows) ? completionRows : []).forEach(function (row) {
      if (!row || typeof row !== "object") return;
      const title = String(row.title || row.task || row.taskTitle || "").trim();
      const completedAt = parseDate(row.completedAt || row.completedTimestamp || row.completedDate);
      if (!title || !completedAt) return;
      const info = isoWeekKey(completedAt);
      ensureWeek(info).completedTasks.push({ title: title, at: completedAt, status: String(row.status || "Done") });
    });

    let daysSeen = 0;
    let strengthSeen = 0;
    let yogaSeen = 0;

    if (personal && typeof personal === "object") {
      if (personal.days && typeof personal.days === "object") {
        Object.entries(personal.days).forEach(function (entry) {
          const iso = entry[0];
          const minutes = Number(entry[1]);
          if (!iso || !(minutes > 0)) return;
          const d = parseDate(iso.length === 10 ? iso + "T00:00:00" : iso);
          if (!d) return;
          daysSeen += 1;
          const info = isoWeekKey(d);
          ensureWeek(info).activityDays.push({ date: d, minutes: minutes });
        });
      }
      if (Array.isArray(personal.strength)) {
        personal.strength.forEach(function (ts) {
          const d = parseDate(ts);
          if (!d) return;
          strengthSeen += 1;
          const info = isoWeekKey(d);
          ensureWeek(info).strengthSessions.push(d);
        });
      }
      if (Array.isArray(personal.yoga)) {
        personal.yoga.forEach(function (ts) {
          const d = parseDate(ts);
          if (!d) return;
          yogaSeen += 1;
          const info = isoWeekKey(d);
          ensureWeek(info).yogaSessions.push(d);
        });
      }
    }

    const weeks = Array.from(map.values()).sort(function (a, b) {
      return b.start.getTime() - a.start.getTime();
    });

    return {
      weeks: weeks,
      hasAnyPersonal: (daysSeen + strengthSeen + yogaSeen) > 0,
      personalCounts: { days: daysSeen, strength: strengthSeen, yoga: yogaSeen }
    };
  }

  function renderList(items, formatter) {
    const ul = document.createElement("ul");
    ul.className = "history-week__list";
    items.forEach(function (item) {
      const li = document.createElement("li");
      formatter(li, item);
      ul.appendChild(li);
    });
    return ul;
  }

  function renderWeek(week, personalUnavailable) {
    const section = document.createElement("section");
    section.className = "history-week";
    section.setAttribute("aria-label", "Week of " + fmtRange(week.start));

    const header = document.createElement("header");
    header.className = "history-week__header";
    const h3 = document.createElement("h3");
    h3.className = "history-week__title";
    h3.textContent = week.year + " · Week " + week.week;
    const range = document.createElement("span");
    range.className = "history-week__range";
    range.textContent = fmtRange(week.start);
    header.appendChild(h3);
    header.appendChild(range);
    section.appendChild(header);

    // Completed tasks group.
    const tasksGroup = document.createElement("div");
    tasksGroup.className = "history-week__group";
    const tasksHead = document.createElement("h4");
    tasksHead.textContent = "Completed tasks / reminders (" + week.completedTasks.length + ")";
    tasksGroup.appendChild(tasksHead);
    if (week.completedTasks.length) {
      const sorted = week.completedTasks.slice().sort(function (a, b) { return b.at - a.at; });
      tasksGroup.appendChild(renderList(sorted, function (li, item) {
        const time = document.createElement("time");
        time.dateTime = item.at.toISOString();
        time.textContent = AU_TIME.format(item.at);
        const span = document.createElement("span");
        span.textContent = item.title;
        li.appendChild(time);
        li.appendChild(span);
      }));
    } else {
      const empty = document.createElement("p");
      empty.className = "history-week__empty";
      empty.textContent = "No task completions recorded for this week.";
      tasksGroup.appendChild(empty);
    }
    section.appendChild(tasksGroup);

    // Health / activity group.
    const healthGroup = document.createElement("div");
    healthGroup.className = "history-week__group";
    const healthHead = document.createElement("h4");
    healthHead.textContent = "Health / activity";
    healthGroup.appendChild(healthHead);

    if (personalUnavailable) {
      const empty = document.createElement("p");
      empty.className = "history-week__empty";
      empty.textContent = "Weekly health data is not available from the sheet for this week.";
      healthGroup.appendChild(empty);
    } else {
      const activityCount = week.activityDays.length;
      const strengthCount = week.strengthSessions.length;
      const yogaCount = week.yogaSessions.length;
      if (activityCount + strengthCount + yogaCount === 0) {
        const empty = document.createElement("p");
        empty.className = "history-week__empty";
        empty.textContent = "No health entries stored for this week.";
        healthGroup.appendChild(empty);
      } else {
        const ul = document.createElement("ul");
        ul.className = "history-week__list";
        [
          { label: "Daily activity (35 min days)", n: activityCount, of: 7 },
          { label: "Strength sessions", n: strengthCount, of: 2 },
          { label: "Yoga / Pilates sessions", n: yogaCount, of: 2 }
        ].forEach(function (row) {
          const li = document.createElement("li");
          const time = document.createElement("time");
          time.textContent = row.n + " / " + row.of;
          const span = document.createElement("span");
          span.textContent = row.label;
          li.appendChild(time);
          li.appendChild(span);
          ul.appendChild(li);
        });
        healthGroup.appendChild(ul);
      }
    }
    section.appendChild(healthGroup);

    return section;
  }

  function render() {
    if (!dashboardResult && !personalResult) return;

    const dashboardValue = dashboardResult && dashboardResult.status === "fulfilled" ? dashboardResult.value : null;
    const personalValue = personalResult && personalResult.status === "fulfilled" ? personalResult.value : null;

    const completionRows = (dashboardValue && (dashboardValue.completionHistory || dashboardValue.taskHistory)) || [];
    const built = buildWeeks(completionRows, personalValue);

    const personalUnavailable = !built.hasAnyPersonal;

    const rangeVal = rangeEl.value;
    let weeks = built.weeks;
    if (rangeVal !== "all") {
      const n = Number(rangeVal);
      if (Number.isFinite(n) && n > 0) weeks = weeks.slice(0, n);
    }

    weeksEl.innerHTML = "";

    // Status messaging.
    const messages = [];
    if (dashboardResult && dashboardResult.status !== "fulfilled") {
      messages.push("Could not load task history from the sheet.");
    }
    if (personalResult && personalResult.status !== "fulfilled") {
      messages.push("Could not load health data from the sheet.");
    }
    if (personalUnavailable && personalResult && personalResult.status === "fulfilled") {
      messages.push("Older weekly health data has not been stored in the sheet — showing task completions only.");
    }

    if (!weeks.length) {
      const kind = (dashboardResult && dashboardResult.status !== "fulfilled") ? "error" : "empty";
      const base = kind === "error"
        ? "No weekly data available. " + messages.join(" ")
        : "No weekly completions or health entries have been recorded yet.";
      setStatus(base.trim(), kind);
      return;
    }

    if (messages.length) {
      const kind = (dashboardResult && dashboardResult.status !== "fulfilled") ? "error" : "empty";
      setStatus(messages.join(" "), kind);
    } else {
      hideStatus();
    }

    const frag = document.createDocumentFragment();
    weeks.forEach(function (week) {
      frag.appendChild(renderWeek(week, personalUnavailable));
    });
    weeksEl.appendChild(frag);
  }

  rangeEl.addEventListener("change", render);

  setStatus("Loading weekly history from the sheet…", "");

  Promise.allSettled([jsonpGet("dashboardData"), jsonpGet("personalData")]).then(function (results) {
    dashboardResult = results[0];
    personalResult = results[1];
    try {
      render();
    } catch (err) {
      setStatus("Something went wrong rendering history: " + (err && err.message ? err.message : err), "error");
    }
  });
})();
