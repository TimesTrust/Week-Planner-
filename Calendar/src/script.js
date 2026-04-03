const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const STORAGE_KEY = "weekPlannerTasksByDate";

const plannerGrid = document.getElementById("plannerGrid");
const weekRange = document.getElementById("weekRange");
const prevWeekBtn = document.getElementById("prevWeekBtn");
const nextWeekBtn = document.getElementById("nextWeekBtn");

const today = new Date();
const todayKey = formatDateKey(today);
let weekOffset = 0;
let tasksByDate = loadTasks();
let draggedElement = null;
let draggedFromDate = null;
let draggedTaskId = null;

renderWeek();

prevWeekBtn.addEventListener("click", () => {
  weekOffset -= 1;
  renderWeek("left");
});

nextWeekBtn.addEventListener("click", () => {
  weekOffset += 1;
  renderWeek("right");
});

// Task form submission (add new task)
plannerGrid.addEventListener("submit", (event) => {
  const form = event.target.closest(".task-form");
  if (!form) return;

  event.preventDefault();
  const input = form.querySelector(".task-input");
  const text = input.value.trim();
  if (!text) return;

  const dateKey = form.dataset.date;
  if (!tasksByDate[dateKey]) {
    tasksByDate[dateKey] = [];
  }

  tasksByDate[dateKey].push({
    id: createTaskId(),
    text,
    completed: false,
  });

  saveTasks();
  input.value = "";
  renderWeek();
});

// Task checkbox (mark complete)
plannerGrid.addEventListener("change", (event) => {
  const checkbox = event.target.closest(".task-checkbox");
  if (!checkbox) return;

  const dateKey = checkbox.dataset.date;
  const taskId = checkbox.dataset.taskId;
  const dayTasks = tasksByDate[dateKey] || [];
  const task = dayTasks.find((item) => item.id === taskId);

  if (task) {
    task.completed = checkbox.checked;
    saveTasks();
    renderWeek();
  }
});

// Delete button click
plannerGrid.addEventListener("click", (event) => {
  const deleteBtn = event.target.closest(".delete-btn");
  if (!deleteBtn) return;

  const taskItem = deleteBtn.closest(".task-item");
  const dateKey = deleteBtn.dataset.date;
  const taskId = deleteBtn.dataset.taskId;

  if (!taskItem || !dateKey || !taskId) return;

  // Trigger fade-out animation
  taskItem.classList.add("delete-animating");

  // Remove after animation completes
  setTimeout(() => {
    const dayTasks = tasksByDate[dateKey] || [];
    tasksByDate[dateKey] = dayTasks.filter((item) => item.id !== taskId);
    saveTasks();
    renderWeek();
  }, 300);
});

// Drag and drop functionality
plannerGrid.addEventListener("dragstart", (event) => {
  const taskItem = event.target.closest(".task-item");
  if (!taskItem || taskItem.classList.contains("task-empty")) return;

  draggedElement = taskItem;
  draggedFromDate = taskItem.dataset.date;
  draggedTaskId = taskItem.dataset.taskId;

  taskItem.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
});

plannerGrid.addEventListener("dragend", (event) => {
  if (draggedElement) {
    draggedElement.classList.remove("dragging");
  }
  draggedElement = null;
  draggedFromDate = null;
  draggedTaskId = null;

  // Remove all drag-over classes
  document.querySelectorAll(".task-list.drag-over").forEach((list) => {
    list.classList.remove("drag-over");
  });
});

// Allow drop on task lists
plannerGrid.addEventListener("dragover", (event) => {
  if (!draggedElement) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";

  const taskList = event.target.closest(".task-list");
  if (taskList) {
    taskList.classList.add("drag-over");
  }
});

plannerGrid.addEventListener("dragleave", (event) => {
  const taskList = event.target.closest(".task-list");
  if (taskList && !taskList.contains(event.relatedTarget)) {
    taskList.classList.remove("drag-over");
  }
});

// Drop to reorder tasks
plannerGrid.addEventListener("drop", (event) => {
  event.preventDefault();
  if (!draggedElement || !draggedFromDate || !draggedTaskId) return;

  const taskList = event.target.closest(".task-list");
  if (!taskList) return;

  const toDate = taskList.dataset.date;
  if (!toDate) return;

  // Get the fromDate from the closest day-card if not sure
  const fromDate = draggedFromDate;

  // Find the task being dragged
  const fromTasks = tasksByDate[fromDate] || [];
  const taskIndex = fromTasks.findIndex((t) => t.id === draggedTaskId);

  if (taskIndex === -1) return;

  const task = fromTasks[taskIndex];

  // If moving to a different date, add to new date's task list
  if (toDate !== fromDate) {
    if (!tasksByDate[toDate]) {
      tasksByDate[toDate] = [];
    }
    fromTasks.splice(taskIndex, 1);
    tasksByDate[toDate].push(task);
  } else {
    // Reorder within the same date
    const targetTaskItem = event.target.closest(".task-item");
    if (targetTaskItem && targetTaskItem !== draggedElement) {
      const targetTaskId = targetTaskItem.dataset.taskId;
      const targetIndex = fromTasks.findIndex((t) => t.id === targetTaskId);

      if (targetIndex !== -1 && targetIndex !== taskIndex) {
        // Move the task
        fromTasks.splice(taskIndex, 1);
        fromTasks.splice(targetIndex > taskIndex ? targetIndex - 1 : targetIndex, 0, task);
      }
    }
  }

  saveTasks();
  renderWeek();
});


function renderWeek(direction = "") {
  const weekStart = getWeekStartWithOffset(weekOffset);
  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

  plannerGrid.innerHTML = "";

  DAY_NAMES.forEach((dayName, index) => {
    const headerCell = document.createElement("div");
    headerCell.className = "day-header";
    headerCell.style.gridColumn = `${index + 1}`;
    headerCell.style.gridRow = "1";
    headerCell.textContent = dayName;
    plannerGrid.appendChild(headerCell);
  });

  weekDates.forEach((date, index) => {
    const dateKey = formatDateKey(date);
    const tasks = tasksByDate[dateKey] || [];

    const dayCard = document.createElement("article");
    dayCard.className = `day-card ${dateKey === todayKey ? "current-day" : ""}`.trim();
    dayCard.style.gridColumn = `${index + 1}`;
    dayCard.style.gridRow = "2";

    dayCard.innerHTML = `
      <span class="date-chip" aria-label="Date">${formatDateChip(date)}</span>
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
                class="delete-btn"
                data-date="${dateKey}"
                data-task-id="${task.id}"
                aria-label="Delete task"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
      <form class="task-form" data-date="${dateKey}">
        <input class="task-input" type="text" placeholder="Add a task" maxlength="120" required />
        <button class="add-btn" type="submit">Add Task</button>
      </form>
    `;

    plannerGrid.appendChild(dayCard);
  });

  const lastDay = weekDates[6];
  weekRange.textContent = `${formatRangeDate(weekStart)} - ${formatRangeDate(lastDay)}`;

  applyWeekSwitchAnimation(direction);
}

function applyWeekSwitchAnimation(direction) {
  plannerGrid.classList.remove("switch-left", "switch-right");
  if (!direction) return;

  const className = direction === "left" ? "switch-left" : "switch-right";
  // Restart the animation each time the week changes.
  void plannerGrid.offsetWidth;
  plannerGrid.classList.add(className);
}

function getWeekStartWithOffset(offset) {
  const reference = new Date(today);
  reference.setHours(0, 0, 0, 0);
  reference.setDate(reference.getDate() + offset * 7);
  return startOfWeek(reference);
}

function startOfWeek(date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  // Sunday is day index 0 in JavaScript's local calendar.
  normalized.setDate(normalized.getDate() - normalized.getDay());
  return normalized;
}

function addDays(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateChip(date) {
  const formatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  });
  return formatter.format(date);
}

function formatRangeDate(date) {
  const formatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return formatter.format(date);
}

function loadTasks() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return {};

    const parsed = JSON.parse(saved);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch (error) {
    console.error("Unable to load tasks from localStorage", error);
    return {};
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasksByDate));
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
