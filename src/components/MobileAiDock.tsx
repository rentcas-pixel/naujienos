"use client";

import { useState } from "react";
import type { ActionType } from "@/lib/types";
import { ACTION_LABELS, ACTION_ORDER } from "@/lib/types";

interface MobileAiDockProps {
  onQuickAction: (action: ActionType) => void;
  onAsk: (question: string) => Promise<void> | void;
  loadingAction?: ActionType | null;
  asking?: boolean;
}

export function MobileAiDock({
  onQuickAction,
  onAsk,
  loadingAction = null,
  asking = false,
}: MobileAiDockProps) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const busy = !!loadingAction || asking;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || busy) return;
    setQuestion("");
    await onAsk(trimmed);
    setOpen(false);
  };

  return (
    <div className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-bbc-border bg-white/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-[1280px] mx-auto px-3 py-2.5">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {ACTION_ORDER.map((action) => (
            <button
              key={action}
              type="button"
              disabled={busy}
              onClick={() => onQuickAction(action)}
              className={`bbc-ai-tab shrink-0 min-h-10 ${
                loadingAction === action ? "bbc-ai-tab--active" : ""
              }`}
            >
              {loadingAction === action ? "..." : ACTION_LABELS[action]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className={`bbc-ai-tab shrink-0 min-h-10 ${
              open ? "bbc-ai-tab--active" : ""
            }`}
          >
            Klausk
          </button>
        </div>

        {open && (
          <form onSubmit={submit} className="mt-2 flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Užduokite klausimą…"
              disabled={busy}
              className="bbc-ai-input flex-1 min-h-11"
              autoFocus
            />
            <button
              type="submit"
              disabled={!question.trim() || busy}
              className="bbc-ai-button shrink-0 min-h-11"
            >
              {asking ? "..." : "OK"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
