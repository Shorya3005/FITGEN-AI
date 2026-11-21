
import { GoogleGenAI, Type } from "@google/genai";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

const workoutSchema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Short title for the workout."
    },
    warmup: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    exercises: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          sets: { type: Type.STRING },
          reps: { type: Type.STRING },
          rest: { type: Type.STRING },
          formTip: { type: Type.STRING }
        },
        required: ["name", "sets", "reps", "rest", "formTip"]
      }
    },
    cooldown: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    }
  },
  required: ["title", "warmup", "exercises", "cooldown"]
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed. Use POST." }, 405);
    }

    if (!process.env.GEMINI_API_KEY) {
      return jsonResponse({
        error: "Gemini API key is not configured yet."
      }, 503);
    }

    try {
      const body = await request.json();

      const allowedGoals = [
        "Muscle Gain", "Fat Loss", "Endurance",
        "Flexibility", "General Fitness"
      ];

      const allowedMuscles = [
        "Full Body", "Upper Body", "Lower Body", "Core"
      ];

      const allowedEquipment = [
        "Full Gym", "Dumbbells Only", "Bodyweight"
      ];

      const allowedLevels = [
        "Beginner", "Intermediate", "Advanced"
      ];

      const goal = allowedGoals.includes(body.goal)
        ? body.goal : "General Fitness";

      const muscleGroup = allowedMuscles.includes(body.muscleGroup)
        ? body.muscleGroup : "Full Body";

      const equipment = allowedEquipment.includes(body.equipment)
        ? body.equipment : "Bodyweight";

      const experience = allowedLevels.includes(body.experience)
        ? body.experience : "Beginner";

      const duration = [15, 30, 45, 60].includes(Number(body.duration))
        ? Number(body.duration) : 30;

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY
      });

      const prompt = `
Create a practical, safe fitness workout plan.

User preferences:
Fitness goal: ${goal}
Target muscle group: ${muscleGroup}
Available equipment: ${equipment}
Experience level: ${experience}
Workout duration: ${duration} minutes

Requirements:
1. Keep the exercises appropriate for the experience level.
2. Respect the available equipment.
3. Include a short warm-up and cooldown.
4. Include realistic sets, repetitions and rest periods.
5. Provide a short, useful form tip for every exercise.
6. Keep the total routine appropriate for the requested duration.
7. Do not include medical treatment or injury rehabilitation.
8. If the user is a beginner, use simple exercises and manageable volume.
9. Return valid structured JSON matching the required schema.
`;

      const response = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: workoutSchema,
          temperature: 0.5
        }
      });

      const raw = response.text;

      if (!raw) {
        throw new Error("The AI returned an empty workout.");
      }

      const workout = JSON.parse(raw);

      if (!Array.isArray(workout.exercises) ||
          workout.exercises.length === 0) {
        throw new Error("Invalid workout response.");
      }

      return jsonResponse({ workout });

    } catch (error) {
      console.error("FITGEN AI workout error:", error.message);

      return jsonResponse({
        error: "Could not generate your workout. Please try again."
      }, 500);
    }
  }
};
