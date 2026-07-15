"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ActionType,
  AIAnnotation,
  Article,
  ExplainResponse,
  Source,
} from "@/lib/types";
import { ACTION_COLORS } from "@/lib/types";
import { AIBlock } from "./AIBlock";
import { ArticleAskPanel } from "./ArticleAskPanel";
import { ArticleKeyFacts } from "./ArticleKeyFacts";
import { InlineActionPrompt } from "./InlineActionPrompt";

interface ArticleViewProps {
  article: Article;
  onAddSources?: (sources: Source[]) => void;
}

interface HighlightPart {
  text: string;
  highlighted: boolean;
  key: string;
  annotationId?: string;
  actionType?: ActionType;
}

function findParagraphIndex(
  articleEl: HTMLElement,
  range: Range,
  selectedText: string
): number {
  let node: Node | null = range.commonAncestorContainer;
  if (node.nodeType === Node.TEXT_NODE) {
    node = node.parentElement;
  }

  let el = node as Element | null;
  while (el && el !== articleEl) {
    if (el.hasAttribute("data-paragraph-index")) {
      return Number(el.getAttribute("data-paragraph-index"));
    }
    el = el.parentElement;
  }

  const paragraphs = articleEl.querySelectorAll("[data-paragraph-index]");
  for (const p of paragraphs) {
    if (p.textContent?.includes(selectedText)) {
      return Number(p.getAttribute("data-paragraph-index"));
    }
  }

  return 0;
}

function getRangeOffsets(
  container: HTMLElement,
  range: Range
): { start: number; end: number } {
  const pre = document.createRange();
  pre.selectNodeContents(container);
  pre.setEnd(range.startContainer, range.startOffset);
  const start = pre.toString().length;
  const end = start + range.toString().length;
  return { start, end };
}

function getAnnotationOffsets(
  annotation: AIAnnotation,
  paragraphText: string
): { start: number; end: number } {
  const start = annotation.selectionStart;
  const end = annotation.selectionEnd;
  if (
    start >= 0 &&
    end > start &&
    end <= paragraphText.length &&
    paragraphText.slice(start, end) === annotation.selectedText
  ) {
    return { start, end };
  }

  const idx = paragraphText.indexOf(annotation.selectedText);
  return {
    start: idx === -1 ? 0 : idx,
    end: idx === -1 ? annotation.selectedText.length : idx + annotation.selectedText.length,
  };
}

function highlightText(
  text: string,
  annotations: AIAnnotation[],
  activeAnnotationId: string | null,
  onActivate: (id: string) => void
): React.ReactNode {
  const saved = annotations.filter((a) => a.hasResponse);
  if (saved.length === 0) return text;

  const sorted = [...saved].sort(
    (a, b) => b.selectedText.length - a.selectedText.length
  );

  let parts: HighlightPart[] = [{ text, highlighted: false, key: "0" }];

  for (const annotation of sorted) {
    const phrase = annotation.selectedText;
    const next: HighlightPart[] = [];

    for (const part of parts) {
      if (part.highlighted) {
        next.push(part);
        continue;
      }

      const idx = part.text.toLowerCase().indexOf(phrase.toLowerCase());
      if (idx === -1) {
        next.push(part);
        continue;
      }

      if (idx > 0) {
        next.push({
          text: part.text.slice(0, idx),
          highlighted: false,
          key: `${part.key}-pre`,
        });
      }
      next.push({
        text: part.text.slice(idx, idx + phrase.length),
        highlighted: true,
        key: `${part.key}-hl-${annotation.id}`,
        annotationId: annotation.id,
        actionType: annotation.activeAction,
      });
      if (idx + phrase.length < part.text.length) {
        next.push({
          text: part.text.slice(idx + phrase.length),
          highlighted: false,
          key: `${part.key}-post`,
        });
      }
    }
    parts = next;
  }

  return parts.map((part) => {
    if (!part.highlighted || !part.annotationId || !part.actionType) {
      return <span key={part.key}>{part.text}</span>;
    }

    const colors = ACTION_COLORS[part.actionType];
    const isActive = part.annotationId === activeAnnotationId;

    return (
      <mark
        key={part.key}
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.preventDefault();
          onActivate(part.annotationId!);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onActivate(part.annotationId!);
          }
        }}
        className={`rounded px-0.5 cursor-pointer transition-all not-italic ${colors.mark} ${
          isActive
            ? "ring-2 ring-offset-1 ring-gray-500"
            : "hover:brightness-95"
        }`}
        title="Spustelėkite, kad vėl matytumėte paaiškinimą"
      >
        {part.text}
      </mark>
    );
  });
}

function renderActiveMark(text: string, actionType: ActionType) {
  const colors = ACTION_COLORS[actionType];
  return (
    <mark className={`rounded px-0.5 not-italic ring-2 ring-offset-1 ring-gray-500 ${colors.mark}`}>
      {text}
    </mark>
  );
}

export function ArticleView({ article, onAddSources }: ArticleViewProps) {
  const [annotations, setAnnotations] = useState<AIAnnotation[]>([]);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(
    null
  );
  const [pendingSelection, setPendingSelection] = useState<{
    text: string;
    paragraphIndex: number;
    offsets: { start: number; end: number };
  } | null>(null);
  const articleRef = useRef<HTMLElement>(null);
  const annotationsRef = useRef<AIAnnotation[]>([]);
  const isSelectingRef = useRef(false);
  const selectionTimerRef = useRef<number | null>(null);
  const startAnnotationRef = useRef<
    (
      text: string,
      paragraphIndex: number,
      actionType: ActionType,
      offsets: { start: number; end: number }
    ) => Promise<void>
  >(() => Promise.resolve());

  annotationsRef.current = annotations;

  useEffect(() => {
    if (!activeAnnotationId) return;
    const articleEl = articleRef.current;
    if (!articleEl) return;
    const block = articleEl.querySelector("[data-ai-block]");
    block?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeAnnotationId]);

  const closeActiveBlock = useCallback(() => {
    setActiveAnnotationId(null);
    setPendingSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  const activateAnnotation = useCallback((id: string) => {
    setPendingSelection(null);
    setActiveAnnotationId(id);
    window.getSelection()?.removeAllRanges();
  }, []);

  const handlePendingAsk = useCallback(
    async (question: string) => {
      const pending = pendingSelection;
      if (!pending) return;

      const trimmed = question.trim();
      if (!trimmed) return;

      setPendingSelection(null);
      window.getSelection()?.removeAllRanges();

      const id = crypto.randomUUID();
      setActiveAnnotationId(id);
      setAnnotations((prev) => [
        ...prev.filter((a) => a.id !== id),
        {
          id,
          paragraphIndex: pending.paragraphIndex,
          selectedText: pending.text,
          selectionStart: pending.offsets.start,
          selectionEnd: pending.offsets.end,
          activeAction: "explain",
          responses: {},
          hasResponse: false,
          loading: "explain",
          followUps: [{ id: crypto.randomUUID(), role: "user", text: trimmed }],
          followUpLoading: false,
        },
      ]);

      try {
        const paragraph = article.paragraphs[pending.paragraphIndex];
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: `Apie pažymėtą tekstą „${pending.text}”: ${trimmed}`,
            articleId: article.slug,
            articleTitle: article.title,
            articleText: paragraph?.text ?? pending.text,
            history: [],
          }),
        });
        if (!res.ok) throw new Error("Nepavyko gauti atsakymo");
        const data = await res.json();
        setAnnotations((prev) =>
          prev.map((a) =>
            a.id === id
              ? {
                  ...a,
                  loading: null,
                  hasResponse: true,
                  responses: {
                    ...a.responses,
                    explain: {
                      text: data.text,
                      sources: data.sources ?? [],
                      actionType: "explain" as const,
                    },
                  },
                  followUps: [
                    ...a.followUps,
                    {
                      id: crypto.randomUUID(),
                      role: "assistant",
                      text: data.text,
                    },
                  ],
                }
              : a
          )
        );
        onAddSources?.(data.sources ?? []);
      } catch {
        setAnnotations((prev) => prev.filter((a) => a.id !== id));
        setActiveAnnotationId(null);
      }
    },
    [pendingSelection, article, onAddSources]
  );

  const fetchExplanation = async (
    selectedText: string,
    actionType: ActionType,
    paragraphIndex: number
  ): Promise<ExplainResponse> => {
    const paragraph = article.paragraphs[paragraphIndex];
    const context = paragraph?.text ?? "";

    const res = await fetch("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selectedText,
        articleId: article.slug,
        actionType,
        context,
        articleTitle: article.title,
      }),
    });

    if (!res.ok) throw new Error("Nepavyko gauti atsakymo");
    return res.json();
  };

  const applyResponse = (
    id: string,
    actionType: ActionType,
    response: ExplainResponse
  ) => {
    setAnnotations((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              loading: null,
              activeAction: actionType,
              hasResponse: true,
              responses: { ...a.responses, [actionType]: response },
            }
          : a
      )
    );
    onAddSources?.(response.sources);
  };

  const startAnnotation = useCallback(
    async (
      text: string,
      paragraphIndex: number,
      actionType: ActionType,
      offsets: { start: number; end: number }
    ) => {
      const existing = annotationsRef.current.find(
        (a) =>
          a.paragraphIndex === paragraphIndex &&
          a.selectionStart === offsets.start &&
          a.selectionEnd === offsets.end
      );

      window.getSelection()?.removeAllRanges();

      if (existing?.responses[actionType]) {
        setAnnotations((prev) =>
          prev.map((a) =>
            a.id === existing.id
              ? { ...a, activeAction: actionType, followUps: [] }
              : a
          )
        );
        setActiveAnnotationId(existing.id);
        return;
      }

      const id = existing?.id ?? crypto.randomUUID();
      setActiveAnnotationId(id);

      setAnnotations((prev) => {
        const filtered = prev.filter((a) => a.id !== id);
        return [
          ...filtered,
          {
            id,
            paragraphIndex,
            selectedText: text,
            selectionStart: offsets.start,
            selectionEnd: offsets.end,
            activeAction: actionType,
            responses: existing?.responses ?? {},
            hasResponse: existing?.hasResponse ?? false,
            loading: actionType,
            followUps: [],
            followUpLoading: false,
          },
        ];
      });

      try {
        const response = await fetchExplanation(text, actionType, paragraphIndex);
        applyResponse(id, actionType, response);
      } catch {
        setAnnotations((prev) => prev.filter((a) => a.id !== id));
        setActiveAnnotationId(null);
      }
    },
    [article.paragraphs, article.slug, article.title, onAddSources]
  );

  startAnnotationRef.current = startAnnotation;

  const readSelection = useCallback(() => {
    const articleEl = articleRef.current;
    if (!articleEl || isSelectingRef.current) return;

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      return;
    }

    const text = sel.toString().trim();
    if (text.length < 2) return;

    const range = sel.getRangeAt(0);
    if (!articleEl.contains(range.commonAncestorContainer)) return;

    // Jei spaudžiame AI juostą / promptus — nenuimam žymėjimo dar
    const paragraphIndex = findParagraphIndex(articleEl, range, text);
    const paragraphEl = articleEl.querySelector(
      `[data-paragraph-index="${paragraphIndex}"] [data-paragraph-text]`
    ) as HTMLElement | null;

    const offsets = paragraphEl
      ? getRangeOffsets(paragraphEl, range)
      : {
          start: article.paragraphs[paragraphIndex]?.text.indexOf(text) ?? 0,
          end:
            (article.paragraphs[paragraphIndex]?.text.indexOf(text) ?? 0) +
            text.length,
        };

    const existing = annotationsRef.current.find(
      (a) =>
        a.paragraphIndex === paragraphIndex &&
        a.selectionStart === offsets.start &&
        a.selectionEnd === offsets.end
    );

    if (existing?.hasResponse) {
      setPendingSelection(null);
      setActiveAnnotationId(existing.id);
      window.getSelection()?.removeAllRanges();
      return;
    }

    setActiveAnnotationId(null);
    setPendingSelection({ text, paragraphIndex, offsets });
  }, [article.paragraphs]);

  useEffect(() => {
    const scheduleRead = (delay: number) => {
      if (selectionTimerRef.current) {
        window.clearTimeout(selectionTimerRef.current);
      }
      selectionTimerRef.current = window.setTimeout(() => {
        selectionTimerRef.current = null;
        readSelection();
      }, delay);
    };

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element;
      if (target.closest("[data-ai-block]")) return;
      if (target.closest("[data-inline-prompt]")) return;
      if (target.closest("mark[role='button']")) return;
      isSelectingRef.current = true;
    };

    const onPointerUp = () => {
      isSelectingRef.current = false;
      const delay = window.matchMedia("(pointer: coarse)").matches ? 320 : 40;
      scheduleRead(delay);
    };

    const onSelectionChange = () => {
      if (isSelectingRef.current) return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      const delay = window.matchMedia("(pointer: coarse)").matches ? 350 : 80;
      scheduleRead(delay);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("touchend", onPointerUp, { passive: true });
    document.addEventListener("selectionchange", onSelectionChange);

    return () => {
      if (selectionTimerRef.current) {
        window.clearTimeout(selectionTimerRef.current);
      }
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("touchend", onPointerUp);
      document.removeEventListener("selectionchange", onSelectionChange);
    };
  }, [readSelection]);

  useEffect(() => {
    if (!activeAnnotationId) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeActiveBlock();
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeAnnotationId, closeActiveBlock]);

  const handleSwitchAction = async (
    annotationId: string,
    actionType: ActionType
  ) => {
    const annotation = annotations.find((a) => a.id === annotationId);
    if (!annotation) return;

    if (annotation.responses[actionType]) {
      setAnnotations((prev) =>
        prev.map((a) =>
          a.id === annotationId
            ? { ...a, activeAction: actionType, followUps: [] }
            : a
        )
      );
      return;
    }

    setAnnotations((prev) =>
      prev.map((a) =>
        a.id === annotationId
          ? {
              ...a,
              loading: actionType,
              activeAction: actionType,
              followUps: [],
            }
          : a
      )
    );

    try {
      const response = await fetchExplanation(
        annotation.selectedText,
        actionType,
        annotation.paragraphIndex
      );
      applyResponse(annotationId, actionType, response);
    } catch {
      setAnnotations((prev) =>
        prev.map((a) =>
          a.id === annotationId ? { ...a, loading: null } : a
        )
      );
    }
  };

  const annotationsForParagraph = (index: number) =>
    annotations.filter((a) => a.paragraphIndex === index);

  const activeBlock = activeAnnotationId
    ? annotations.find((a) => a.id === activeAnnotationId)
    : null;

  const keyFactCount = article.briefing?.keyFacts?.length ?? 0;

  const handlePendingAction = (action: ActionType) => {
    if (!pendingSelection) return;
    const { text, paragraphIndex, offsets } = pendingSelection;
    setPendingSelection(null);
    void startAnnotationRef.current(text, paragraphIndex, action, offsets);
  };

  const renderParagraphBlock = (
    index: number,
    options?: { keyFact?: boolean; className?: string }
  ) => {
    const paragraph = article.paragraphs[index];
    if (!paragraph) return null;

    const paragraphAnnotations = annotationsForParagraph(index);
    const isActiveParagraph = activeBlock?.paragraphIndex === index;
    const isPendingParagraph = pendingSelection?.paragraphIndex === index;

    if (isActiveParagraph && activeBlock) {
      const { start, end } = getAnnotationOffsets(
        activeBlock,
        paragraph.text
      );
      const before = paragraph.text.slice(0, start);
      const selected = paragraph.text.slice(start, end);
      const after = paragraph.text.slice(end);
      const otherAnnotations = paragraphAnnotations.filter(
        (a) => a.id !== activeBlock.id
      );

      return (
        <div
          key={paragraph.id}
          className={options?.className ?? "mb-6"}
          data-paragraph-index={index}
        >
          <p
            className={
              options?.keyFact
                ? "article-key-facts__text text-[17px] leading-[1.55] text-bbc-black"
                : "text-[17px] leading-[1.75] text-gray-800"
            }
            data-paragraph-text
          >
            {before.length > 0 &&
              highlightText(
                before,
                otherAnnotations,
                activeAnnotationId,
                activateAnnotation
              )}
            {renderActiveMark(selected, activeBlock.activeAction)}
          </p>

          {renderAiBlock(activeBlock)}

          {after.length > 0 && (
            <p className="text-[17px] leading-[1.75] text-gray-800">
              {highlightText(
                after,
                otherAnnotations,
                activeAnnotationId,
                activateAnnotation
              )}
            </p>
          )}
        </div>
      );
    }

    return (
      <div
        key={paragraph.id}
        className={options?.className ?? "mb-6"}
        data-paragraph-index={index}
      >
        <p
          className={
            options?.keyFact
              ? "article-key-facts__text text-[17px] leading-[1.55] text-bbc-black"
              : "text-[17px] leading-[1.75] text-gray-800"
          }
          data-paragraph-text
        >
          {highlightText(
            paragraph.text,
            paragraphAnnotations,
            activeAnnotationId,
            activateAnnotation
          )}
        </p>

        {isPendingParagraph && pendingSelection && (
          <div data-inline-prompt>
            <InlineActionPrompt
              selectedText={pendingSelection.text}
              onAction={handlePendingAction}
              onAsk={(question) => void handlePendingAsk(question)}
              onClose={() => {
                setPendingSelection(null);
                window.getSelection()?.removeAllRanges();
              }}
            />
          </div>
        )}
      </div>
    );
  };

  const renderAiBlock = (block: AIAnnotation) => (
    <div className="my-2 space-y-0" data-ai-block>
      <AIBlock
        key={block.id}
        annotation={block}
        onSwitchAction={(action) => handleSwitchAction(block.id, action)}
        onClose={closeActiveBlock}
      />
      <ArticleAskPanel
        article={article}
        inline
        selectedText={block.selectedText}
        initialResponse={block.responses[block.activeAction]?.text}
        actionType={block.activeAction}
      />
    </div>
  );

  return (
    <>
      <article
        ref={articleRef}
        className="max-w-none text-gray-800 leading-relaxed select-text"
      >
        {keyFactCount > 0 && (
          <ArticleKeyFacts
            count={keyFactCount}
            renderParagraph={(index) =>
              renderParagraphBlock(index, { keyFact: true, className: "mb-0" })
            }
          />
        )}
        {article.paragraphs.slice(keyFactCount).map((_, offset) =>
          renderParagraphBlock(keyFactCount + offset)
        )}
      </article>
    </>
  );
}
