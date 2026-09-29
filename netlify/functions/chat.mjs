export const config = {
  path: "/api/chat",
  method: ["POST"]
};

export default async (req) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || "gpt-5.6-luna";

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

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        input: prompt,
        max_output_tokens: 1200
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("OpenAI API error:", response.status, data);

      return Response.json(
        {
          reply: "AI service is temporarily unavailable. Please try again.",
          mockTest: null
        },
        { status: 502 }
      );
    }

    const reply = String(data?.output_text || "").trim();

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
    console.error("Server error:", error);

    return Response.json(
      {
        reply: "AI service is temporarily unavailable. Please try again.",
        mockTest: null
      },
      { status: 500 }
    );
  }
};
