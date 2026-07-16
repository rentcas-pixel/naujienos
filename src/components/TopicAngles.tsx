"use client";

import { useState } from "react";
import type { TopicAngle, TopicAnglesPack } from "@/lib/types";

interface TopicAnglesProps {
  pack: TopicAnglesPack;
}

function relativeUpdatedAt(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return "ką tik";
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "ką tik";
  if (mins < 60) return `prieš ${mins} min.`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `prieš ${hours} val.`;
  return `prieš ${Math.round(hours / 24)} d.`;
}

function AngleBody({ angle }: { angle: TopicAngle }) {
  if (angle.facts.length === 0) return null;

  return (
    <div className="border border-bbc-border px-4 py-5 md:px-5 md:py-6">
      <div className="article-key-facts">
        <div className="article-key-facts__body">
          {angle.facts.map((fact) => (
            <div key={fact} className="article-key-facts__line">
              <p className="article-key-facts__text text-[17px] leading-[1.55]">
                {fact}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TopicAngles({ pack }: TopicAnglesProps) {
  const angles = pack.angles
    .filter((angle) => angle.facts?.length > 0 && angle.label)
    .slice(0, 3);

  const [activeId, setActiveId] = useState(angles[0]?.id ?? "");

  if (angles.length === 0) return null;

  const current =
    angles.find((angle) => angle.id === activeId) ?? angles[0];

  return (
    <section className="mt-10 pt-8 border-t border-bbc-border">
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-bbc-red">
          Kitu kampu
        </h2>
        <p className="bbc-meta shrink-0">
          {relativeUpdatedAt(pack.generatedAt)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {angles.map((angle) => {
          const isActive = angle.id === current.id;
          return (
            <button
              key={angle.id}
              type="button"
              onClick={() => setActiveId(angle.id)}
              className={`bbc-ai-tab ${isActive ? "bbc-ai-tab--active" : ""}`}
            >
              {angle.label}
            </button>
          );
        })}
      </div>

      <AngleBody angle={current} />
    </section>
  );
}
