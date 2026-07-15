"use client";

import { useState } from "react";
import type { Article, Source } from "@/lib/types";

interface ArticleFooterProps {
  article: Article;
  sources: Source[];
}

type Tab = "timeline" | "sources";

const TAB_LABELS: Record<Tab, string> = {
  timeline: "Laiko juosta",
  sources: "Šaltiniai",
};

export function ArticleFooter({ article, sources }: ArticleFooterProps) {
  const [activeTab, setActiveTab] = useState<Tab | null>(null);

  return (
    <div className="mt-12 border-t border-lrt-border pt-8">
      <div className="flex flex-wrap gap-2 mb-6">
        {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(activeTab === tab ? null : tab)}
            className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === tab
                ? "border-lrt-red text-lrt-red"
                : "border-transparent text-gray-700 hover:text-lrt-red"
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {activeTab === "timeline" && (
        <div className="space-y-4">
          {article.timeline.map((event, i) => (
            <div key={i} className="flex gap-4">
              <div className="shrink-0 w-24 text-xs text-gray-500 pt-0.5">
                {event.date}
              </div>
              <div className="relative pb-4 border-l border-gray-200 pl-4">
                <div className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-gray-300" />
                <p className="font-medium text-gray-900 text-sm">{event.title}</p>
                <p className="text-sm text-gray-600 mt-0.5">{event.excerpt}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "sources" && (
        <div className="space-y-3">
          {sources.length === 0 ? (
            <p className="text-sm text-gray-500">
              Pažymėkite tekstą straipsnyje — čia bus rodomi AI naudoti šaltiniai.
            </p>
          ) : (
            sources.map((source) => (
              <div
                key={source.url}
              className="rounded-lg border border-lrt-border p-4"
            >
              <a
                href={source.url}
                className="font-medium text-sm text-gray-900 hover:text-lrt-red transition-colors"
              >
                  {source.title}
                </a>
                <p className="text-sm text-gray-600 mt-1">{source.excerpt}</p>
              </div>
            ))
          )}
        </div>
      )}

    </div>
  );
}
