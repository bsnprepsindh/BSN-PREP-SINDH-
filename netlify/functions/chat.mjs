export const config = {
  path: "/api/chat",
  method: ["POST"]
};

export default async (req) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";

    if (!apiKey) {
      return Response.json(
        {
          reply: "AI service is not configured yet.",
          mockTest: null
        },
        { status: 503 }
      );
    }

    const body = await req.json();
    const message = String(body?.message || "").trim();

    if (!message) {
      return Response.json(
        {
          reply: "Please enter a question.",
          mockTest: null
        },
        { status: 400 }
      );
    }

    const languageInstruction = String(
      body?.languageInstruction || ""
    ).trim();

    const conversation = Array.isArray(body?.conversation)
      ? body.conversation
          .slice(-20)
          .map((x) => ({
            role: x.role === "assistant" ? "model" : "user",
            parts: [
              {
                text: String(x.content || "")
              }
            ]
          }))
      : [];

    const systemInstruction = `You are BSN PREP SINDH AI, an educational assistant for nursing-entry-test students in Sindh, Pakistan.

Give accurate, exam-focused explanations.
Be clear and helpful.
Use simple language unless the student asks for detail.
Never pretend you checked a source when you did not.
If you are uncertain, clearly say so.

Language instruction:
${languageInstruction || "Automatically reply in the same language/style as the student's question."}`;

    const contents = [
      ...conversation,
      {
        role: "user",
        parts: [
          {
            text: message
          }
        ]
      }
    ];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [
              {
                text: systemInstruction
              }
            ]
          },
          contents,
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
          reply:
            "AI service is temporarily unavailable. Please try again.",
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
      console.error("Gemini returned no text:", data);

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
    console.error("Server error:", error);

    return Response.json(
      {
        reply:
          "AI service is temporarily unavailable. Please try again.",
        mockTest: null
      },
      { status: 500 }
    );
  }
};
