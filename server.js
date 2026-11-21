
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import express from "express";
import { Readable } from "node:stream";

import chatApi from "./api/chat.js";
import workoutApi from "./api/generate-workout.js";

const app = express();
const PORT = 3000;

app.use(express.json());

async function runApi(apiHandler, req, res) {
  try {
    const request = new Request(
      `http://localhost:${PORT}${req.originalUrl}`,
      {
        method: req.method,
        headers: {
          "Content-Type": "application/json"
        },
        body: ["GET", "HEAD"].includes(req.method)
          ? undefined
          : JSON.stringify(req.body ?? {})
      }
    );

    const response = await apiHandler.fetch(request);

    res.status(response.status);

    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== "transfer-encoding") {
        res.setHeader(key, value);
      }
    });

    if (!response.body) {
      return res.end();
    }

    res.flushHeaders();

    Readable.fromWeb(response.body).pipe(res);
  } catch (error) {
    console.error("API Error:", error);

    if (!res.headersSent) {
      res.status(500).json({
        error: "Internal server error"
      });
    } else {
      res.destroy(error);
    }
  }
}

app.all("/api/chat", (req, res) =>
  runApi(chatApi, req, res)
);

app.all("/api/generate-workout", (req, res) =>
  runApi(workoutApi, req, res)
);

app.listen(PORT, () => {
  console.log(`FITGEN AI backend running at http://localhost:${PORT}`);
});
