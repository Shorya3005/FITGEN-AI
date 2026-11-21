
(() => {
    const STORAGE_KEY = "fitgen_ai_data_v1";
  
    function createDefaultData() {
      return {
        goals: {
          weeklyWorkouts: 4,
          calorieGoal: 300,
          targetWeight: ""
        },
        workouts: [],
        savedWorkout: null
      };
    }
  
    function readData() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return createDefaultData();
  
        const data = JSON.parse(saved);
        const defaults = createDefaultData();
  
        return {
          ...defaults,
          ...data,
          goals: {
            ...defaults.goals,
            ...(data.goals || {})
          },
          workouts: Array.isArray(data.workouts) ? data.workouts : []
        };
      } catch (error) {
        console.error("FITGEN AI: Could not read saved data.", error);
        return createDefaultData();
      }
    }
  
    function writeData(data) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return true;
      } catch (error) {
        console.error("FITGEN AI: Could not save data.", error);
        return false;
      }
    }
  
    function getGoals() {
      return readData().goals;
    }
  
    function saveGoals(goals) {
      const data = readData();
      data.goals = {
        weeklyWorkouts: Number(goals.weeklyWorkouts) || 4,
        calorieGoal: Number(goals.calorieGoal) || 300,
        targetWeight: goals.targetWeight === "" ? "" : Number(goals.targetWeight)
      };
      return writeData(data);
    }
  
    function getWorkouts() {
      return readData().workouts;
    }
  
    function addWorkout(workout) {
      const data = readData();
  
      const item = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: String(workout.name || "Workout").trim(),
        duration: Number(workout.duration) || 0,
        calories: Number(workout.calories) || 0,
        date: new Date().toISOString()
      };
  
      data.workouts.unshift(item);
      return writeData(data) ? item : null;
    }
  
    function deleteWorkout(id) {
      const data = readData();
      data.workouts = data.workouts.filter(
        item => String(item.id) !== String(id)
      );
      return writeData(data);
    }
  
    function getSavedWorkout() {
      return readData().savedWorkout;
    }
  
    function saveWorkout(workout) {
      const data = readData();
      data.savedWorkout = {
        ...workout,
        savedAt: new Date().toISOString()
      };
      return writeData(data);
    }
  
    function getStreak() {
      const workouts = getWorkouts();
      if (!workouts.length) return 0;
  
      const dateKey = date => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };
  
      const workoutDates = new Set(
        workouts.map(item => dateKey(new Date(item.date)))
      );
  
      const cursor = new Date();
      cursor.setHours(0, 0, 0, 0);
  
      if (!workoutDates.has(dateKey(cursor))) {
        cursor.setDate(cursor.getDate() - 1);
        if (!workoutDates.has(dateKey(cursor))) return 0;
      }
  
      let streak = 0;
  
      while (workoutDates.has(dateKey(cursor))) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      }
  
      return streak;
    }
  
    function resetAll() {
      return writeData(createDefaultData());
    }
  
    window.FITGEN_STORAGE = Object.freeze({
      getGoals,
      saveGoals,
      getWorkouts,
      addWorkout,
      deleteWorkout,
      getSavedWorkout,
      saveWorkout,
      getStreak,
      resetAll
    });
  })();
  