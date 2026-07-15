"use client";

import { useState } from "react";
import type { ActionType } from "@/lib/types";
import { ACTION_LABELS, ACTION_ORDER } from "@/lib/types";

interface InlineActionPromptProps {
  selectedText: string;
  onAction: (action: ActionType) => void;
  onAsk: (question: string) => void;
  onClose: () => void;
}

export function InlineActionPrompt({
  selectedText,
  onAction,
  onAsk,
  onClose,
}: InlineActionPromptProps) {
  const [question, setQuestion] = useState("");

  const submitAsk = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) return;
    setQuestion("");
    onAsk(trimmed);
  };

  return (
    <div
      role="toolbar"
      aria-label="AI veiksmai pažymėtam tekstui"
      data-inline-prompt
      className="ai-selection-bar my-3"
    >
      <span className="ai-selection-bar__spark" aria-hidden>
        ✦
      </span>

      <div className="ai-selection-bar__actions">
        {ACTION_ORDER.map((action) => (
          <button
            key={action}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onAction(action)}
            className="ai-selection-bar__btn"
          >
            {ACTION_LABELS[action]}
          </button>
        ))}
      </div>

      <form onSubmit={submitAsk} className="ai-selection-bar__ask">
        <input
          type="text"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onMouseDown={(event) => event.stopPropagation()}
          placeholder="Klausk..."
          aria-label={`Klausimas apie: ${selectedText.slice(0, 60)}`}
          className="ai-selection-bar__input"
        />
      </form>

      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onClose}
        className="ai-selection-bar__close"
        aria-label="Uždaryti"
      >
        ✕
      </button>
    </div>
  );
}
