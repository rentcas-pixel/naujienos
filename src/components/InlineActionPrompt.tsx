"use client";

import type { ActionType } from "@/lib/types";
import { ACTION_LABELS, ACTION_ORDER } from "@/lib/types";
import { AiPanel } from "./AiPanel";

interface InlineActionPromptProps {
  selectedText: string;
  onAction: (action: ActionType) => void;
  onClose: () => void;
}

export function InlineActionPrompt({
  selectedText,
  onAction,
  onClose,
}: InlineActionPromptProps) {
  return (
    <AiPanel
      title="AI asistentas"
      subtitle={`Pažymėta: „${selectedText}"`}
      onClose={onClose}
      className="my-3"
    >
      <div role="toolbar" aria-label="Pasirinkite veiksmą" data-inline-prompt>
        <div className="flex flex-wrap gap-2">
          {ACTION_ORDER.map((action) => (
            <button
              key={action}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onAction(action)}
              className="bbc-ai-tab"
            >
              {ACTION_LABELS[action]}
            </button>
          ))}
        </div>
      </div>
    </AiPanel>
  );
}
