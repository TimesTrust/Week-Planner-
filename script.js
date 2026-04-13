const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const STORAGE_KEY = "weekPlannerTasksByDate";

const plannerGrid = document.getElementById("plannerGrid");
const calendarGrid = document.getElementById("calendarGrid");
const viewSubtitle = document.getElementById("viewSubtitle");
const monthLabel = document.getElementById("monthLabel");

const weekView = document.getElementById("weekView");
const calendarView = document.getElementById("calendarView");
const weekViewBtn = document.getElementById("weekViewBtn");
const calendarViewBtn = document.getElementById("calendarViewBtn");

const prevWeekBtn = document.getElementById("prevWeekBtn");
const nextWeekBtn = document.getElementById("nextWeekBtn");
const prevMonthBtn = document.getElementById("prevMonthBtn");
const nextMonthBtn = document.getElementById("nextMonthBtn");

const state = {
  activeView: "week",
  weekOffset: 0,
  monthCursor: startOfMonth(new Date()),
  today: startOfDay(new Date()),
  tasksByDate: loadTasks(),
  drag: {
    element: null,
    fromDate: null,
    taskId: null,
  },
  scrollTop: {
    week: 0,
    calendar: 0,
  },
};

boot();

function boot() {
  renderWeekView();
  renderCalendarView();
  updateViewState("week");
  wireEvents();
}

function wireEvents() {
  weekViewBtn.addEventListener("click", () => updateViewState("week"));
  calendarViewBtn.addEventListener("click", () => updateViewState("calendar"));

  prevWeekBtn.addEventListener("click", () => {
    state.weekOffset -= 1;
    renderWeekView("left");
  });

  nextWeekBtn.addEventListener("click", () => {
    state.weekOffset += 1;
    renderWeekView("right");
  });

  prevMonthBtn.addEventListener("click", () => {
    state.monthCursor = addMonths(state.monthCursor, -1);
    renderCalendarView();
    updateSubtitle();
  });

  nextMonthBtn.addEventListener("click", () => {
    state.monthCursor = addMonths(state.monthCursor, 1);
    renderCalendarView();
    updateSubtitle();
  });

  document.addEventListener("submit", handleTaskSubmit);
  document.addEventListener("change", handleTaskToggle);
  document.addEventListener("click", handleTaskClicks);

  [plannerGrid, calendarGrid].forEach((grid) => {
    grid.addEventListener("dragstart", handleDragStart);
    grid.addEventListener("dragend", clearDragState);
    grid.addEventListener("dragover", handleDragOver);
    grid.addEventListener("dragleave", handleDragLeave);
    grid.addEventListener("drop", handleDrop);
  });
}

function updateViewState(view) {
  if (view !== state.activeView) {
    state.scrollTop[state.activeView] = document.documentElement.scrollTop || document.body.scrollTop;
  }

  state.activeView = view;

  const weekActive = view === "week";

  weekView.classList.toggle("is-active", weekActive);
  calendarView.classList.toggle("is-active", !weekActive);
  weekView.setAttribute("aria-hidden", String(!weekActive));
  calendarView.setAttribute("aria-hidden", String(weekActive));

  weekViewBtn.classList.toggle("is-active", weekActive);
  calendarViewBtn.classList.toggle("is-active", !weekActive);
  weekViewBtn.setAttribute("aria-pressed", String(weekActive));
  calendarViewBtn.setAttribute("aria-pressed", String(!weekActive));

  updateSubtitle();
  const targetScroll = state.scrollTop[state.activeView] || 0;
  window.scrollTo({ top: targetScroll, behavior: "auto" });
}

function updateSubtitle() {
  if (state.activeView === "week") {
    const weekDates = getWeekDates(state.weekOffset);
    const start = weekDates[0];
    const end = weekDates[6];
    viewSubtitle.textContent = `${formatRangeDate(start)} - ${formatRangeDate(end)}`;
    return;
  }

  viewSubtitle.textContent = formatMonthYear(state.monthCursor);
}

function renderWeekView(direction = "") {
  const weekDates = getWeekDates(state.weekOffset);
  plannerGrid.innerHTML = "";

  DAY_NAMES.forEach((name, index) => {
    const headerCell = document.createElement("div");
    headerCell.className = "day-header";
    headerCell.style.gridColumn = `${index + 1}`;
    headerCell.style.gridRow = "1";
    headerCell.textContent = name;
    plannerGrid.appendChild(headerCell);
  });

  weekDates.forEach((date, index) => {
    const dateKey = formatDateKey(date);
    const tasks = getTasks(dateKey);
    const isCurrentDay = isSameDate(date, state.today);

    const dayCard = document.createElement("article");
    dayCard.className = `day-card ${isCurrentDay ? "current-day" : ""}`.trim();
    dayCard.style.gridColumn = `${index + 1}`;
    dayCard.style.gridRow = "2";

    dayCard.innerHTML = `
      <span class="date-chip" aria-label="Date">${formatDateChip(date)}</span>
      ${buildTaskListMarkup(dateKey, tasks)}
      ${buildTaskFormMarkup(dateKey)}
    `;

    plannerGrid.appendChild(dayCard);
  });

  applyWeekSwitchAnimation(direction);
  updateSubtitle();
}

function renderCalendarView() {
  const monthStart = startOfMonth(state.monthCursor);
  const calendarStart = startOfWeek(monthStart);

  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  monthLabel.textContent = formatMonthYear(monthStart);

  calendarGrid.innerHTML = "";

  DAY_NAMES.forEach((dayName) => {
    const dayHead = document.createElement("div");
    dayHead.className = "calendar-day-name";
    dayHead.textContent = dayName.slice(0, 3);
    calendarGrid.appendChild(dayHead);
  });

  for (let i = 0; i < 42; i += 1) {
    const date = addDays(calendarStart, i);
    const dateKey = formatDateKey(date);
    const tasks = getTasks(dateKey);
    const isCurrentDay = isSameDate(date, state.today);
    const inCurrentMonth = date.getMonth() === month && date.getFullYear() === year;

    const dayCard = document.createElement("article");
    dayCard.className = `calendar-day ${isCurrentDay ? "current-day" : ""} ${inCurrentMonth ? "" : "is-outside-month"}`.trim();

    dayCard.innerHTML = `
      <span class="calendar-date">${date.getDate()}</span>
      ${buildTaskListMarkup(dateKey, tasks)}
      ${buildTaskFormMarkup(dateKey)}
    `;

    calendarGrid.appendChild(dayCard);
  }
}

function buildTaskListMarkup(dateKey, tasks) {
  return `
    <ul class="task-list" data-date="${dateKey}">
      ${
        tasks.length
          ? tasks
              .map(
                (task) => `
              <li class="task-item" draggable="true" data-date="${dateKey}" data-task-id="${task.id}">
                <input
                  class="task-checkbox"
                  type="checkbox"
                  ${task.completed ? "checked" : ""}
                  data-date="${dateKey}"
                  data-task-id="${task.id}"
                  aria-label="Mark task complete"
                />
                <span class="task-text ${task.completed ? "completed" : ""}">${escapeHtml(task.text)}</span>
                <button
                  type="button"
                  class="edit-btn"
                  data-action="edit"
                  data-date="${dateKey}"
                  data-task-id="${task.id}"
                  aria-label="Edit task"
                  title="Edit task"
                >✎</button>
                <button
                  type="button"
                  class="delete-btn"
                  data-action="delete"
                  data-date="${dateKey}"
                  data-task-id="${task.id}"
                  aria-label="Delete task"
                  title="Delete task"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                </button>
              </li>
            `
              )
              .join("")
          : '<li class="task-empty">No tasks yet</li>'
      }
    </ul>
  `;
}

function buildTaskFormMarkup(dateKey) {
  return `
    <form class="task-form" data-date="${dateKey}">
      <input class="task-input" type="text" placeholder="Add a task" maxlength="120" required />
      <button class="add-btn" type="submit">Add Task</button>
    </form>
  `;
}

function handleTaskSubmit(event) {
  const form = event.target.closest(".task-form");
  if (!form) return;

  event.preventDefault();
  const input = form.querySelector(".task-input");
  const text = input.value.trim();
  if (!text) return;

  addTask(form.dataset.date, text);
  input.value = "";
  rerenderBothViews();
}

function handleTaskToggle(event) {
  const checkbox = event.target.closest(".task-checkbox");
  if (!checkbox) return;

  const dateKey = checkbox.dataset.date;
  const taskId = checkbox.dataset.taskId;
  toggleTask(dateKey, taskId, checkbox.checked);
  rerenderBothViews();
}

function handleTaskClicks(event) {
  const deleteBtn = event.target.closest('.delete-btn[data-action="delete"]');
  if (deleteBtn) {
    const taskItem = deleteBtn.closest(".task-item");
    if (!taskItem) return;

    taskItem.classList.add("delete-animating");
    const { date, taskId } = deleteBtn.dataset;

    setTimeout(() => {
      deleteTask(date, taskId);
      rerenderBothViews();
    }, 280);
    return;
  }

  const editBtn = event.target.closest('.edit-btn[data-action="edit"]');
  if (!editBtn) return;

  const { date, taskId } = editBtn.dataset;
  const task = findTask(date, taskId);
  if (!task) return;

  const nextText = window.prompt("Edit task", task.text);
  if (nextText === null) return;

  const trimmed = nextText.trim();
  if (!trimmed) {
    deleteTask(date, taskId);
  } else {
    task.text = trimmed;
  }

  saveTasks();
  rerenderBothViews();
}

function handleDragStart(event) {
  const taskItem = event.target.closest(".task-item");
  if (!taskItem || taskItem.classList.contains("task-empty")) return;

  state.drag.element = taskItem;
  state.drag.fromDate = taskItem.dataset.date;
  state.drag.taskId = taskItem.dataset.taskId;

  taskItem.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
}

function handleDragOver(event) {
  if (!state.drag.element) return;

  const taskList = event.target.closest(".task-list");
  if (!taskList) return;

  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  taskList.classList.add("drag-over");
}

function handleDragLeave(event) {
  const taskList = event.target.closest(".task-list");
  if (taskList && !taskList.contains(event.relatedTarget)) {
    taskList.classList.remove("drag-over");
  }
}

function handleDrop(event) {
  event.preventDefault();

  const { element, fromDate, taskId } = state.drag;
  if (!element || !fromDate || !taskId) return;

  const targetList = event.target.closest(".task-list");
  if (!targetList) return;

  const toDate = targetList.dataset.date;
  if (!toDate) return;

  const fromTasks = getTasks(fromDate);
  const sourceIndex = fromTasks.findIndex((task) => task.id === taskId);
  if (sourceIndex === -1) return;

  const [movedTask] = fromTasks.splice(sourceIndex, 1);

  if (toDate !== fromDate) {
    const toTasks = getTasks(toDate);
    const targetItem = event.target.closest(".task-item");

    if (targetItem?.dataset.taskId) {
      const targetIndex = toTasks.findIndex((task) => task.id === targetItem.dataset.taskId);
      const insertion = targetIndex === -1 ? toTasks.length : targetIndex;
      toTasks.splice(insertion, 0, movedTask);
    } else {
      toTasks.push(movedTask);
    }

    state.tasksByDate[toDate] = toTasks;
    state.tasksByDate[fromDate] = fromTasks;
  } else {
    const targetItem = event.target.closest(".task-item");
    const toTasks = fromTasks;

    if (targetItem?.dataset.taskId) {
      const targetIndex = toTasks.findIndex((task) => task.id === targetItem.dataset.taskId);
      const insertion = targetIndex === -1 ? toTasks.length : targetIndex;
      toTasks.splice(insertion, 0, movedTask);
    } else {
      toTasks.push(movedTask);
    }

    state.tasksByDate[fromDate] = toTasks;
  }

  saveTasks();
  rerenderBothViews();
  clearDragState();
}

function clearDragState() {
  if (state.drag.element) {
    state.drag.element.classList.remove("dragging");
  }

  document.querySelectorAll(".task-list.drag-over").forEach((list) => {
    list.classList.remove("drag-over");
  });

  state.drag.element = null;
  state.drag.fromDate = null;
  state.drag.taskId = null;
}

function rerenderBothViews() {
  const previousWeekScroll = weekView.scrollTop;
  const previousCalendarScroll = calendarView.scrollTop;

  renderWeekView();
  renderCalendarView();

  weekView.scrollTop = previousWeekScroll;
  calendarView.scrollTop = previousCalendarScroll;
}

function addTask(dateKey, text) {
  const tasks = getTasks(dateKey);
  tasks.push({
    id: createTaskId(),
    text,
    completed: false,
  });

  state.tasksByDate[dateKey] = tasks;
  saveTasks();
}

function toggleTask(dateKey, taskId, completed) {
  const task = findTask(dateKey, taskId);
  if (!task) return;

  task.completed = completed;
  saveTasks();
}

function deleteTask(dateKey, taskId) {
  const tasks = getTasks(dateKey);
  state.tasksByDate[dateKey] = tasks.filter((task) => task.id !== taskId);
  saveTasks();
}

function findTask(dateKey, taskId) {
  return getTasks(dateKey).find((task) => task.id === taskId);
}

function getTasks(dateKey) {
  if (!state.tasksByDate[dateKey]) {
    state.tasksByDate[dateKey] = [];
  }

  return state.tasksByDate[dateKey];
}

function getWeekDates(offset) {
  const today = startOfDay(state.today);
  today.setDate(today.getDate() + offset * 7);
  const weekStart = startOfWeek(today);
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

function applyWeekSwitchAnimation(direction) {
  plannerGrid.classList.remove("switch-left", "switch-right");
  if (!direction) return;

  const className = direction === "left" ? "switch-left" : "switch-right";
  void plannerGrid.offsetWidth;
  plannerGrid.classList.add(className);
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateChip(date) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function formatRangeDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatMonthYear(date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(date);
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date) {
  const d = startOfDay(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date, amount) {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function isSameDate(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    Object.keys(parsed).forEach((key) => {
      if (!Array.isArray(parsed[key])) {
        parsed[key] = [];
      } else {
        parsed[key] = parsed[key]
          .filter((item) => item && typeof item.text === "string" && typeof item.id === "string")
          .map((item) => ({
            id: item.id,
            text: item.text,
            completed: Boolean(item.completed),
          }));
      }
    });

    return parsed;
  } catch (error) {
    console.error("Unable to parse planner data", error);
    return {};
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasksByDate));
}

function createTaskId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
