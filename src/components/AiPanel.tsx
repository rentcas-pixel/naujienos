"use client";

import type { FormEvent, ReactNode } from "react";

interface AiAskFormProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  loading?: boolean;
  placeholder?: string;
  buttonLabel?: string;
}

export function AiAskForm({
  value,
  onChange,
  onSubmit,
  loading = false,
  placeholder = "Užduokite savo klausimą…",
  buttonLabel = "Klausk",
}: AiAskFormProps) {
  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={loading}
        className="bbc-ai-input flex-1"
      />
      <button
        type="submit"
        disabled={!value.trim() || loading}
        className="bbc-ai-button shrink-0"
      >
        {loading ? "..." : buttonLabel}
      </button>
    </form>
  );
}

interface AiPanelProps {
  title?: string;
  subtitle?: string;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
  attached?: boolean;
}

export function AiPanel({
  title,
  subtitle,
  onClose,
  children,
  className = "",
  attached = false,
}: AiPanelProps) {
  return (
    <div
      className={`bbc-ai-panel not-prose relative ${
        attached ? "bbc-ai-panel--attached" : ""
      } ${className}`}
    >
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-bbc-gray hover:text-bbc-black text-sm"
          aria-label="Uždaryti"
        >
          ✕
        </button>
      )}
      {(title || subtitle) && (
        <div className={`mb-3 ${onClose ? "pr-8" : ""}`}>
          {title && (
            <p className="text-[13px] font-bold uppercase tracking-wide text-bbc-black">
              {title}
            </p>
          )}
          {subtitle && (
            <p className="text-[13px] text-bbc-gray mt-1 leading-snug">{subtitle}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
