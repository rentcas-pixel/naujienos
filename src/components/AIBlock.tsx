"use client";

import type { ActionType, AIAnnotation } from "@/lib/types";
import { ACTION_LABELS, ACTION_ORDER } from "@/lib/types";
import { AiPanel } from "./AiPanel";

interface AIBlockProps {
  annotation: AIAnnotation;
  onSwitchAction: (action: ActionType) => void;
  onClose: () => void;
}

export function AIBlock({
  annotation,
  onSwitchAction,
  onClose,
}: AIBlockProps) {
  const { activeAction, loading, responses, selectedText } = annotation;
  const response = responses[activeAction];

  return (
    <AiPanel
      title="AI paaiškinimas"
      subtitle={`Pažymėta: „${selectedText}"`}
      onClose={onClose}
    >
      <div className="mb-3 flex flex-wrap gap-2 pr-6">
        {ACTION_ORDER.map((action) => {
          const isActive = activeAction === action;
          const isLoading = loading === action;

          return (
            <button
              key={action}
              type="button"
              onClick={() => onSwitchAction(action)}
              disabled={!!loading}
              className={`bbc-ai-tab ${isActive ? "bbc-ai-tab--active" : ""} ${
                isLoading ? "opacity-60 cursor-wait" : ""
              }`}
            >
              {isLoading ? "..." : ACTION_LABELS[action]}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-4 bg-bbc-bg-soft w-full" />
          <div className="h-4 bg-bbc-bg-soft w-5/6" />
          <div className="h-4 bg-bbc-bg-soft w-4/6" />
        </div>
      ) : response ? (
        <>
          <p className="text-[15px] leading-relaxed text-bbc-black">{response.text}</p>

          {response.sources.length > 0 && (
            <div className="mt-3 pt-3 border-t border-bbc-border">
              <p className="text-[12px] font-bold uppercase tracking-wide text-bbc-gray mb-2">
                Šaltiniai
              </p>
              <ul className="space-y-1">
                {response.sources.map((source, index) => (
                  <li key={source.url}>
                    <a
                      href={source.url}
                      className="text-[13px] text-bbc-gray hover:text-bbc-black hover:underline underline-offset-2"
                    >
                      [{index + 1}] {source.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </>
      ) : null}
    </AiPanel>
  );
}
