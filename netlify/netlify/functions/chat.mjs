export const config = {
  path: "/api/chat",
  method: ["POST"]
};

export default async (req) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
    const baseUrl =
      process.env.GEMINI_BASE_URL ||
      "https://generativelanguage.googleapis.com/v1beta";

    if (!apiKey) {
      return Response.json(
        { reply: "AI service is not configured yet.", mockTest: null },
        { status: 503 }
      );
    }

    const body = await req.json();
    const message = String(body?.message || "").trim();

    if (!message) {
      return Response.json(
        { reply: "Please enter a question.", mockTest: null },
        { status: 400 }
      );
    }

    const languageInstruction = String(
      body?.languageInstruction || ""
    );

    const conversation = Array.isArray(body?.conversation)
      ? body.conversation
          .slice(-20)
          .map((x) => `${x.role || "user"}: ${x.content || ""}`)
          .join("\n")
      : "";

    const prompt = `You are BSN PREP SINDH AI, an educational assistant for nursing-entry-test students in Sindh, Pakistan.

Give accurate, exam-focused explanations. Be clear and concise unless the student asks for detail. Never claim you checked a source you did not check. If uncertain, say so.

${languageInstruction}

Previous conversation:
${conversation || "(none)"}

Student question:
${message}`;

    const response = await fetch(
      `${baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 1200
          }
        })
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("Gemini API error:", response.status, data);
      return Response.json(
        {
          reply: "AI service is temporarily unavailable. Please try again.",
          mockTest: null
        },
        { status: 502 }
      );
    }

    const reply = data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      return Response.json(
        {
          reply: "AI service returned no answer. Please try again.",
          mockTest: null
        },
        { status: 502 }
      );
    }

    return Response.json({
      reply,
      mockTest: null
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        reply: "AI service is temporarily unavailable. Please try again.",
        mockTest: null
      },
      { status: 500 }
    );
  }
};
