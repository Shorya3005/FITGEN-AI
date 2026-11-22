
(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const store = window.FITGEN_STORAGE;
  const exercises = window.FITGEN_EXERCISES || [];
  let activeMuscle = "All";
  let chatHistory = [];
  let generatedWorkout = null;
  const dateKey = value => {
    const date = new Date(value);
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  };
  const todayKey = () => dateKey(new Date());
  const thisWeek = items => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);
    return items.filter(item => new Date(item.date) >= start);
  };
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const toast = (message, type = "success") => {
    const region = $("#toast-region");
    if (!region) return;
    const item = make("div", `toast ${type}`, message);
    region.append(item);
    window.setTimeout(() => item.remove(), 3500);
  };
  const formatDate = value => new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const safeNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  function switchView(name) {
    $$("[data-view-panel]").forEach(panel => {
      const active = panel.dataset.viewPanel === name;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
    $$(".nav-link[data-view]").forEach(button =>
      button.classList.toggle("is-active", button.dataset.view === name)
    );
    const titles = {
      dashboard: "Dashboard",
      generator: "AI Workout Generator",
      exercises: "Exercise Library",
      progress: "Goals & Progress"
    };
    $("#page-title").textContent = titles[name] || "Dashboard";
    $("#sidebar").classList.remove("is-open");
    if (name === "dashboard") renderDashboard();
    if (name === "progress") renderProgress();
    if (name === "exercises") renderExercises();
  }
  function renderTableRows(target, items, includeDelete = false) {
    target.replaceChildren();
    if (!items.length) {
      const row = make("tr");
      const cell = make("td", "table-empty", "No workout logs yet. Your first entry starts here.");
      cell.colSpan = includeDelete ? 5 : 4;
      row.append(cell);
      target.append(row);
      return;
    }
    items.slice(0, 8).forEach(item => {
      const row = make("tr");
      [
        item.name,
        `${safeNumber(item.duration)} min`,
        `${safeNumber(item.calories)} kcal`,
        formatDate(item.date)
      ].forEach(value => row.append(make("td", "", value)));
      if (includeDelete) {
        const cell = make("td");
        const button = make("button", "delete-log", "Delete");
        button.type = "button";
        button.dataset.deleteWorkout = item.id;
        cell.append(button);
        row.append(cell);
      }
      target.append(row);
    });
  }
  function renderChart(items) {
    const chart = $("#weekly-activity-chart");
    chart.replaceChildren();
    const days = [];
    for (let offset = 6; offset >= 0; offset--) {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - offset);
      const key = dateKey(day);
      const minutes = items
        .filter(item => dateKey(item.date) === key)
        .reduce((sum, item) => sum + safeNumber(item.duration), 0);
      days.push({
        label: day.toLocaleDateString("en", { weekday: "short" }),
        minutes
      });
    }
    const max = Math.max(30, ...days.map(day => day.minutes));
    days.forEach(day => {
      const column = make("div", "activity-day");
      const bar = make("div", "activity-bar");
      bar.style.height = `${Math.max(4, day.minutes / max * 100)}%`;
      bar.title = `${day.minutes} minutes`;
      column.append(bar, make("small", "", day.label));
      chart.append(column);
    });
  }
  function renderDashboard() {
    const workouts = store.getWorkouts();
    const recent = thisWeek(workouts);
    const todayCalories = workouts
      .filter(item => dateKey(item.date) === todayKey())
      .reduce((sum, item) => sum + safeNumber(item.calories), 0);
    const goals = store.getGoals();
    const streak = store.getStreak();
    $("#calories-value").innerHTML = `${todayCalories} <small>kcal</small>`;
    $("#weekly-workouts-value").textContent = recent.length;
    $("#weekly-target-label").textContent = `${goals.weeklyWorkouts} sessions`;
    $("#dashboard-streak-value").innerHTML = `${streak} <small>days</small>`;
    $("#streak-value").textContent = `${streak} day streak`;
    $("#weight-goal-value").textContent = goals.targetWeight ? `${goals.targetWeight} kg` : "—";
    renderChart(workouts);
    renderTableRows($("#recent-activity-body"), workouts);
    renderSavedWorkout();
  }
  function renderSavedWorkout() {
    const target = $("#today-workout-card");
    target.replaceChildren();
    const workout = store.getSavedWorkout();
    if (!workout) {
      target.append(
        make("div", "empty-icon", "✳"),
        make("h3", "", "No workout saved yet"),
        make("p", "muted-copy", "Generate a routine that fits your goal and schedule.")
      );
      const button = make("button", "button button-primary button-full", "Generate workout");
      button.type = "button";
      button.dataset.view = "generator";
      target.append(button);
      return;
    }
    const count = Array.isArray(workout.exercises) ? workout.exercises.length : 0;
    target.append(
      make("div", "empty-icon", "✦"),
      make("h3", "", workout.title || "Your saved workout"),
      make("p", "muted-copy", `${count} exercises · ${workout.duration || "Custom"} minutes`)
    );
    const button = make("button", "button button-primary button-full", "Mark workout complete");
    button.type = "button";
    button.id = "mark-workout-complete";
    target.append(button);
  }
  function renderExercises() {
    const grid = $("#exercise-grid");
    if (!grid) return;
    const query = $("#exercise-search").value.trim().toLowerCase();
    const equipment = $("#equipment-filter").value;
    const filtered = exercises.filter(item => {
      const matchesMuscle = activeMuscle === "All" || item.muscle === activeMuscle;
      const matchesEquipment = equipment === "all" || item.equipment === equipment;
      const matchesQuery = `${item.name} ${item.muscle} ${item.equipment}`.toLowerCase().includes(query);
      return matchesMuscle && matchesEquipment && matchesQuery;
    });
    grid.replaceChildren();
    if (!filtered.length) {
      grid.append(make("p", "chart-placeholder", "No exercises match your search."));
      return;
    }
    filtered.forEach(item => {
      const card = make("article", "exercise-card");
      card.append(
        make("div", "exercise-visual", "✳"),
        make("h3", "", item.name),
        make("p", "exercise-meta", `${item.muscle} · ${item.equipment} · ${item.difficulty}`)
      );
      const button = make("button", "button button-outline", "View Form Guide");
      button.type = "button";
      button.dataset.exerciseId = item.id;
      card.append(button);
      grid.append(card);
    });
  }
  function openExercise(id) {
    const item = exercises.find(exercise => String(exercise.id) === String(id));
    if (!item) return;
    const content = $("#exercise-modal-content");
    content.replaceChildren();
    content.append(
      make("p", "eyebrow", `${item.muscle.toUpperCase()} · ${item.difficulty.toUpperCase()}`),
      make("h2", "", item.name),
      make("p", "muted-copy", item.description),
      make("h3", "", "How to perform")
    );
    const list = make("ol");
    item.steps.forEach(step => list.append(make("li", "", step)));
    content.append(
      list,
      make("h3", "", "Common mistake"),
      make("p", "muted-copy", item.mistakes),
      make("h3", "", "Coach tip"),
      make("p", "muted-copy", item.tip)
    );
    const ask = make("button", "button button-primary button-full", "Ask AI Coach about this exercise");
    ask.type = "button";
    ask.addEventListener("click", () => {
      closeExercise();
      openChat(`Can you explain the safe technique and beginner tips for ${item.name}?`);
    });
    content.append(ask);
    $("#exercise-modal").hidden = false;
  }
  function closeExercise() {
    $("#exercise-modal").hidden = true;
  }
  function openChat(prefill = "") {
    $("#chat-drawer").classList.add("is-open");
    $("#chat-drawer").setAttribute("aria-hidden", "false");
    $("#chat-backdrop").hidden = false;
    if (prefill) $("#chat-input").value = prefill;
    $("#chat-input").focus();
  }
  function closeChat() {
    $("#chat-drawer").classList.remove("is-open");
    $("#chat-drawer").setAttribute("aria-hidden", "true");
    $("#chat-backdrop").hidden = true;
  }
  function addChatMessage(message, role) {
    const row = make(
      "div",
      `chat-message ${role === "user" ? "user-message" : "assistant-message"}`
    );
    if (role !== "user") {
      row.append(make("span", "message-avatar", "✦"));
    }
    const bubble = make("div", "message-bubble", message);
    row.append(bubble);
    $("#chat-messages").append(row);
    $("#chat-messages").scrollTop = $("#chat-messages").scrollHeight;
    return bubble;
  }
  async function sendChat(message) {
    const clean = message.trim();
    if (!clean) return;
    addChatMessage(clean, "user");
    $("#chat-input").value = "";
    const button = $("#chat-form .send-button");
    button.disabled = true;
    try {
      let reply = "";
      const bubble = addChatMessage("", "assistant");
      const result = await window.FITGEN_API.sendChatMessage(
        clean,
        chatHistory,
        (chunk, fullReply) => {
          reply = fullReply;
          bubble.textContent = fullReply;
          $("#chat-messages").scrollTop = $("#chat-messages").scrollHeight;
        }
      );
      reply = result.reply || reply;
      if (!reply.trim()) {
        throw new Error("The AI returned an empty reply. Please try again.");
      }
      bubble.textContent = reply;
      chatHistory.push(
        { role: "user", content: clean },
        { role: "assistant", content: reply }
      );
      if (chatHistory.length > 12) {
        chatHistory = chatHistory.slice(-12);
      }
    } catch (error) {
      addChatMessage(
        error.message || "Sorry, the AI coach is unavailable right now.",
        "assistant"
      );
    } finally {
      button.disabled = false;
      $("#chat-input").focus();
    }
  }
  function renderWorkout(workout) {
    const target = $("#workout-result");
    target.replaceChildren();
    target.append(make("h3", "", workout.title || "Your personalized workout"));
    if (workout.warmup) {
      target.append(
        make("p", "muted-copy", `Warm-up: ${Array.isArray(workout.warmup) ? workout.warmup.join(", ") : workout.warmup}`)
      );
    }
    const items = Array.isArray(workout.exercises) ? workout.exercises : [];
    items.forEach((item, index) => {
      const row = make("div", "workout-exercise");
      const details = make("div");
      details.append(
        make("strong", "", `${index + 1}. ${item.name || "Exercise"}`),
        make("small", "", `${item.sets || "—"} sets · ${item.reps || "—"} reps · Rest: ${item.rest || "—"}`)
      );
      if (item.formTip) {
        details.append(make("small", "", `Form tip: ${item.formTip}`));
      }
      row.append(details);
      target.append(row);
    });
    if (workout.cooldown) {
      target.append(
        make("p", "muted-copy", `Cooldown: ${Array.isArray(workout.cooldown) ? workout.cooldown.join(", ") : workout.cooldown}`)
      );
    }
    const save = make("button", "button button-primary button-full", "Save as today's workout");
    save.type = "button";
    save.id = "save-generated-workout";
    target.append(save);
  }
  async function handleWorkoutGeneration(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = $("#generate-workout-button");
    const preferences = Object.fromEntries(new FormData(form).entries());
    button.disabled = true;
    button.textContent = "Generating your workout...";
    try {
      const result = await window.FITGEN_API.generateWorkout(preferences);
      const workout = result.workout || result;
      if (!Array.isArray(workout.exercises) || !workout.exercises.length) {
        throw new Error("The AI response did not contain exercises. Please generate again.");
      }
      workout.duration = Number(preferences.duration);
      generatedWorkout = workout;
      renderWorkout(workout);
      toast("Your workout has been generated.");
    } catch (error) {
      toast(error.message || "Could not generate workout.", "error");
    } finally {
      button.disabled = false;
      button.textContent = "Generate my workout →";
    }
  }
  function renderProgress() {
    const goals = store.getGoals();
    const workouts = store.getWorkouts();
    const weekly = thisWeek(workouts);
    const todayCalories = workouts
      .filter(item => dateKey(item.date) === todayKey())
      .reduce((sum, item) => sum + safeNumber(item.calories), 0);
    $("#target-weekly-workouts").value = goals.weeklyWorkouts;
    $("#daily-calorie-goal").value = goals.calorieGoal;
    $("#target-weight").value = goals.targetWeight || "";
    const area = $("#goal-progress-content");
    area.replaceChildren();
    const metrics = [
      { label: "Weekly workouts", value: weekly.length, target: goals.weeklyWorkouts, unit: "sessions" },
      { label: "Today's calories burned", value: todayCalories, target: goals.calorieGoal, unit: "kcal" }
    ];
    metrics.forEach(metric => {
      const item = make("div", "progress-item");
      const top = make("div", "progress-item-top");
      top.append(
        make("span", "", metric.label),
        make("strong", "", `${metric.value} / ${metric.target} ${metric.unit}`)
      );
      const track = make("div", "progress-track");
      const fill = make("div", "progress-fill");
      fill.style.width = `${Math.min(100, metric.target > 0 ? metric.value / metric.target * 100 : 0)}%`;
      track.append(fill);
      item.append(top, track);
      area.append(item);
    });
    renderTableRows($("#progress-log-body"), workouts, true);
  }
  function bindEvents() {
    document.addEventListener("click", event => {
      const viewButton = event.target.closest("[data-view]");
      if (viewButton) switchView(viewButton.dataset.view);
      const navBrand = event.target.closest("[data-navigate]");
      if (navBrand) switchView(navBrand.dataset.navigate);
      const exerciseButton = event.target.closest("[data-exercise-id]");
      if (exerciseButton) openExercise(exerciseButton.dataset.exerciseId);
      const deleteButton = event.target.closest("[data-delete-workout]");
      if (deleteButton && store.deleteWorkout(deleteButton.dataset.deleteWorkout)) {
        renderDashboard();
        renderProgress();
        toast("Workout entry deleted.");
      }
      if (event.target.closest("#save-generated-workout") && generatedWorkout) {
        if (store.saveWorkout(generatedWorkout)) {
          renderDashboard();
          toast("Workout saved to your dashboard.");
        } else {
          toast("Could not save workout.", "error");
        }
      }
      if (event.target.closest("#mark-workout-complete")) {
        const workout = store.getSavedWorkout();
        if (workout && store.addWorkout({
          name: workout.title || "Saved workout",
          duration: workout.duration || 30,
          calories: 0
        })) {
          renderDashboard();
          renderProgress();
          toast("Workout marked complete. Great work!");
        }
      }
      const promptButton = event.target.closest("[data-chat-prompt]");
      if (promptButton) sendChat(promptButton.dataset.chatPrompt);
    });
    $("#sidebar-toggle").addEventListener("click", () =>
      $("#sidebar").classList.toggle("is-open")
    );
    $("#open-chat-button").addEventListener("click", () => openChat());
    $("#close-chat-button").addEventListener("click", closeChat);
    $("#chat-backdrop").addEventListener("click", closeChat);
    $("#close-exercise-modal").addEventListener("click", closeExercise);
    $("#exercise-modal").addEventListener("click", event => {
      if (event.target.id === "exercise-modal") closeExercise();
    });
    $("#chat-form").addEventListener("submit", event => {
      event.preventDefault();
      sendChat($("#chat-input").value);
    });
    $("#workout-form").addEventListener("submit", handleWorkoutGeneration);
    $("#exercise-search").addEventListener("input", renderExercises);
    $("#equipment-filter").addEventListener("change", renderExercises);
    $$("[data-muscle]").forEach(button => {
      button.addEventListener("click", () => {
        activeMuscle = button.dataset.muscle;
        $$("[data-muscle]").forEach(chip =>
          chip.classList.toggle("is-selected", chip === button)
        );
        renderExercises();
      });
    });
    $("#goals-form").addEventListener("submit", event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      if (store.saveGoals(data)) {
        renderDashboard();
        renderProgress();
        toast("Your fitness goals have been saved.");
      } else {
        toast("Could not save your goals.", "error");
      }
    });
    $("#workout-log-form").addEventListener("submit", event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const saved = store.addWorkout({
        name: data.workoutName,
        duration: data.duration,
        calories: data.calories
      });
      if (saved) {
        event.currentTarget.reset();
        renderDashboard();
        renderProgress();
        toast("Workout log saved. Keep it up!");
      } else {
        toast("Could not save your workout log.", "error");
      }
    });
  }
  function init() {
    if (!store || !window.FITGEN_API) {
      console.error("FITGEN AI: Required modules did not load.");
      toast("Some project files did not load. Check the browser console.", "error");
      return;
    }
    bindEvents();
    renderDashboard();
    renderProgress();
    renderExercises();
    console.log("FITGEN AI application initialized.");
  }
  init();
})();
