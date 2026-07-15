export function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL || "gpt-4o";
}
