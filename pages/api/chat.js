import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const { message } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Message is required",
      });
    }

    const response = await openai.responses.create({
      model: "gpt-5.6",
      instructions:
        "You are the ATTARWALAS AI Fragrance Assistant. Be helpful, friendly, concise, and knowledgeable about fragrances. For now, answer general fragrance questions. Do not invent ATTARWALAS products or product details that have not been provided to you.",
      input: message,
    });

    return res.status(200).json({
      reply: response.output_text,
    });
  } catch (error) {
    console.error("OpenAI API error:", error);

return res.status(500).json({
  error: error.message || "Unknown OpenAI error",
});
  }
}
