import type { ChatMessage } from "@/lib/prompts";
import { getOpenAIModel } from "@/lib/openai-config";

const UNRELATED_PHRASE =
  /^(?:šis klausimas nėra susijęs su straipsnio turiniu\.?\s*)+(?:tačiau\s*)?/i;

const UNRELATED_PHRASE_END =
  /(?:\s*tačiau\s*)?(?:šis klausimas nėra susijęs su straipsnio turiniu\.?\s*)+$/i;

const REFUSAL_PATTERNS = [
  /^(?:atsiprašau,?\s*)?(?:bet\s*)?(?:aš\s*)?negaliu pateikti nuorod(?:ų|a).*?(?:tačiau|galite).*?$/i,
  /pabandykite paieškoti.*?youtube/i,
  /galite pabandyti paieškoti/i,
  /rekomenduoju ieškoti.*?youtube/i,
];

export function sanitizeAiResponse(text: string): string {
  let result = text.trim();

  while (UNRELATED_PHRASE.test(result)) {
    result = result.replace(UNRELATED_PHRASE, "").trim();
  }

  while (UNRELATED_PHRASE_END.test(result)) {
    result = result.replace(UNRELATED_PHRASE_END, "").trim();
  }

  for (const pattern of REFUSAL_PATTERNS) {
    if (pattern.test(result)) {
      result =
        "Tiesioginės nuorodos šiuo metu neradau. Pabandykite paklausti tiksliau — pvz. įvykio pavadinimo ar datos.";
      break;
    }
  }

  return result;
}

export async function callOpenAIChat(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("No API key");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getOpenAIModel(),
      messages,
      temperature: 0.3,
      max_tokens: 450,
    }),
  });

  if (!res.ok) throw new Error("OpenAI request failed");
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  return sanitizeAiResponse(text);
}
