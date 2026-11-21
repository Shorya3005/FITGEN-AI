
import { GoogleGenAI } from "@google/genai";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

const FITNESS_SYSTEM_INSTRUCTION = `
You are FITGEN AI, a friendly and responsible general fitness coach.
Give concise, practical fitness guidance in clear language.
Ask a brief follow-up question when important details are missing.
For workout suggestions, consider the user's goal, experience, equipment and time.
Encourage safe technique, gradual progression, hydration and rest.
Do not diagnose, treat injuries, prescribe medication or provide medical advice.
If someone mentions pain, injury, pregnancy, a medical condition or alarming symptoms,
recommend stopping the aggravating activity and consulting a qualified healthcare professional.
Do not encourage extreme dieting, unsafe weight loss or exercising through pain.
`;

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}


async function generateWithRetry(ai, options, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await ai.models.generateContentStream(options);
    } catch (error) {
      const status = error.status || error.statusCode;
      const isTemporaryError = [429, 500, 502, 503, 504].includes(Number(status));

      if (!isTemporaryError || attempt === maxAttempts) {
        throw error;
      }

      const delay = attempt * 2000;
      console.log(`Gemini temporarily unavailable. Retry ${attempt}/${maxAttempts} in ${delay}ms.`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}


function cleanHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .slice(-10)
    .filter(item =>
      item &&
      (item.role === "user" || item.role === "assistant") &&
      typeof item.content === "string"
    )
    .map(item => ({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: item.content.slice(0, 1200) }]
    }));
}

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed. Use POST." }, 405);
    }

    if (!process.env.GEMINI_API_KEY) {
      return jsonResponse({
        error: "Gemini API key is not configured on the server yet."
      }, 503);
    }

    try {
      const body = await request.json();
      const message = typeof body.message === "string"
        ? body.message.trim()
        : "";

      if (!message) {
        return jsonResponse({ error: "Please enter a message." }, 400);
      }

      if (message.length > 1000) {
        return jsonResponse({
          error: "Please keep your message under 1000 characters."
        }, 400);
      }

      const history = cleanHistory(body.history);

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY
      });

  
const stream = await generateWithRetry(ai, {
  model: MODEL,
  contents: [
    ...history,
    { role: "user", parts: [{ text: message }] }
  ],
  config: {
    systemInstruction: FITNESS_SYSTEM_INSTRUCTION,
    temperature: 0.6,
    maxOutputTokens: 500
  }
});


      const encoder = new TextEncoder();

      const responseStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              const text = chunk.text;

              if (text) {
                controller.enqueue(encoder.encode(text));
              }
            }

            controller.close();
          } catch (error) {
            console.error("FITGEN AI streaming error:", error.message);
            controller.error(error);
          }
        }
      });

      return new Response(responseStream, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-transform"
        }
      });

    } catch (error) {
      console.error("FITGEN AI chat error:", error.message);

      return jsonResponse({
        error: "The AI coach could not respond right now. Please try again."
      }, 500);
    }
  }
};
