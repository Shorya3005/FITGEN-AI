
(() => {
  const API_ENDPOINTS = {
    chat: "/api/chat",
    workout: "/api/generate-workout"
  };

  async function makeRequest(endpoint, payload) {
    let response;

    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      throw new Error(
        "Unable to connect to FITGEN AI. Check your internet connection or try again."
      );
    }

    let data;

    try {
      data = await response.json();
    } catch (error) {
      throw new Error("The server returned an invalid response.");
    }

    if (!response.ok) {
      throw new Error(
        data.error || `Request failed with status ${response.status}.`
      );
    }

    return data;
  }

  async function sendChatMessage(message, history = [], onChunk) {
    const cleanMessage = String(message || "").trim();

    if (!cleanMessage) {
      throw new Error("Please enter a message first.");
    }

    let response;

    try {
      response = await fetch(API_ENDPOINTS.chat, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: cleanMessage,
          history: Array.isArray(history) ? history : []
        })
      });
    } catch (error) {
      throw new Error("Unable to connect to FITGEN AI. Please try again.");
    }

    if (!response.ok) {
      let data = {};

      try {
        data = await response.json();
      } catch (error) {}

      throw new Error(
        data.error || `Chat request failed with status ${response.status}.`
      );
    }

    if (!response.body) {
      throw new Error("Streaming is not supported by this browser.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let reply = "";

    try {
      while (true) {
        const { value, done } = await reader.read();

        if (done) break;

        const text = decoder.decode(value, { stream: true });

        if (text) {
          reply += text;

          if (typeof onChunk === "function") {
            onChunk(text, reply);
          }
        }
      }

      reply += decoder.decode();

      if (!reply.trim()) {
        throw new Error("The AI returned an empty response.");
      }

      return { reply: reply.trim() };

    } catch (error) {
      await reader.cancel().catch(() => {});
      throw error;
    }
  }

  async function generateWorkout(preferences) {
    if (!preferences || typeof preferences !== "object") {
      throw new Error("Please select your workout preferences.");
    }

    return makeRequest(API_ENDPOINTS.workout, {
      goal: preferences.goal,
      muscleGroup: preferences.muscleGroup,
      equipment: preferences.equipment,
      experience: preferences.experience,
      duration: Number(preferences.duration)
    });
  }

  window.FITGEN_API = Object.freeze({
    sendChatMessage,
    generateWorkout
  });

  console.log("FITGEN AI: Streaming API client initialized.");
})();
