"use client";

import type { ActionType } from "@/lib/types";
import { ACTION_LABELS } from "@/lib/types";

const THINKING_BY_ACTION: Record<ActionType, string> = {
  explain: "AI aiškina…",
  summary: "AI sutraukia…",
  detail: "AI renkasi detales…",
};

interface AiThinkingStatusProps {
  action?: ActionType | null;
  label?: string;
}

export function AiThinkingStatus({ action, label }: AiThinkingStatusProps) {
  const text =
    label ??
    (action ? THINKING_BY_ACTION[action] : null) ??
    "AI galvoja…";

  return (
    <div className="ai-thinking" role="status" aria-live="polite">
      <span className="ai-thinking__spinner" aria-hidden />
      <div className="ai-thinking__copy">
        <p className="ai-thinking__label">{text}</p>
        <p className="ai-thinking__hint">Tai gali užtrukti kelias sekundes</p>
      </div>
    </div>
  );
}
