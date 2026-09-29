const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 3000;
const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const BASE_URL =
  process.env.GEMINI_BASE_URL ||
  "https://generativelanguage.googleapis.com/v1beta";
const API_KEY = process.env.GEMINI_API_KEY;

app.use(helmet());
app.use(express.json({ limit: "256kb" }));

// Allow the GitHub Pages frontend to call this backend
const allowedOrigins = new Set([
  "https://bsnprepsindh.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
]);

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type"
    );
  }

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

// Basic rate limiting
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false
  })
);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    configured: Boolean(API_KEY)
  });
});

// Build AI prompt
function buildPrompt(
  message,
  conversation = [],
  languageInstruction = ""
) {
  const history = Array.isArray(conversation)
    ? conversation
        .slice(-12)
        .map(
          (x) =>
            `${x.role === "assistant" ? "AI" : "Student"}: ${String(
              x.content || ""
            )}`
        )
        .join("\n")
    : "";

  return `You are BSN PREP SINDH AI, an educational assistant for nursing-entry-test students in Sindh, Pakistan.

Give accurate, exam-focused explanations.

Be clear and concise unless the student asks for detail.

Never claim you checked a source you did not check.

If uncertain, say so.

${languageInstruction || ""}

Previous conversation:
${history || "(none)"}

Student question:
${message}`;
}

// AI chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(503).json({
        reply: "AI service is not configured yet.",
        mockTest: null
      });
    }

    const message = String(req.body?.message || "").trim();

    if (!message) {
      return res.status(400).json({
        reply: "Please enter a question.",
        mockTest: null
      });
    }

    const prompt = buildPrompt(
      message,
      req.body?.conversation,
      req.body?.languageInstruction
    );

    const controller = new AbortController();

    const timer = setTimeout(() => {
      controller.abort();
    }, 60000);

    const response = await fetch(
      `${BASE_URL}/models/${encodeURIComponent(
        MODEL
      )}:generateContent?key=${encodeURIComponent(API_KEY)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 1200
          }
        })
      }
    );

    clearTimeout(timer);

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(
        "AI API error:",
        response.status,
        data?.error?.message || data
      );

      return res.status(502).json({
        reply:
          "AI service is temporarily unavailable. Please try again.",
        mockTest: null
      });
    }

    const reply = data?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || "")
      .join("")
      .trim();

    if (!reply) {
      return res.status(502).json({
        reply:
          "AI service returned no answer. Please try again.",
        mockTest: null
      });
    }

    res.json({
      reply,
      mockTest: null
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      reply:
        "AI service is temporarily unavailable. Please try again.",
      mockTest: null
    });
  }
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `BSN PREP SINDH AI backend listening on port ${PORT}`
  );
  console.log(`Gemini model: ${MODEL}`);
  console.log(
    `Gemini key configured: ${Boolean(API_KEY)}`
  );
});
