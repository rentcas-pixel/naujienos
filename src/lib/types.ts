export type ActionType = "detail" | "explain" | "alternative";

export interface Source {
  title: string;
  url: string;
  excerpt: string;
}

export interface RelatedImage {
  url: string;
  caption: string;
  sourceUrl?: string;
}

export interface ExplainResponse {
  text: string;
  sources: Source[];
  actionType: ActionType;
  image?: RelatedImage;
}

export interface FollowUpMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  image?: RelatedImage;
}

export interface AIAnnotation {
  id: string;
  paragraphIndex: number;
  selectedText: string;
  selectionStart: number;
  selectionEnd: number;
  activeAction: ActionType;
  responses: Partial<Record<ActionType, ExplainResponse>>;
  loading: ActionType | null;
  /** Ar anotacija turi bent vieną atsakymą (naudojama spalviniam pažymėjimui) */
  hasResponse: boolean;
  followUps: FollowUpMessage[];
  followUpLoading: boolean;
}

export interface ArticleParagraph {
  id: string;
  text: string;
}

export interface TimelineEvent {
  date: string;
  title: string;
  excerpt: string;
}

/** AI plėtimo metaduomenys — svarbiausi faktai, susijusios temos, chronologija */
export interface ArticleBriefing {
  keyFacts: string[];
  relatedTopics: string[];
  timeline: TimelineEvent[];
}

export interface AlternativePerspective {
  outlet: string;
  headline: string;
  excerpt: string;
  url: string;
  slug?: string;
}

export interface Article {
  slug: string;
  category: string;
  publishedAt: string;
  readingTime: string;
  title: string;
  paragraphs: ArticleParagraph[];
  timeline: TimelineEvent[];
  alternativePerspectives: AlternativePerspective[];
  source?: string;
  originalUrl?: string;
  publishedDate?: Date;
  imageUrl?: string;
  /** RSS santrauka išplėsta į pilnesnį skaitomą tekstą */
  isAiExpanded?: boolean;
  /** Kompanijos PR / reklaminis turinys */
  isPromotional?: boolean;
  /** Struktūrinė AI santrauka */
  briefing?: ArticleBriefing;
}

export const ACTION_ORDER: ActionType[] = [
  "explain",
  "detail",
  "alternative",
];

export const ACTION_LABELS: Record<ActionType, string> = {
  detail: "Detaliau",
  explain: "Paaiškink man",
  alternative: "Alternatyva",
};

export const ACTION_COLORS: Record<
  ActionType,
  { bg: string; active: string; mark: string; border: string }
> = {
  detail: {
    bg: "bg-blue-50",
    active: "bg-blue-600 text-white",
    mark: "bg-blue-100 text-blue-900",
    border: "border-blue-200",
  },
  explain: {
    bg: "bg-emerald-50",
    active: "bg-emerald-600 text-white",
    mark: "bg-emerald-100 text-emerald-900",
    border: "border-emerald-200",
  },
  alternative: {
    bg: "bg-purple-50",
    active: "bg-purple-600 text-white",
    mark: "bg-purple-100 text-purple-900",
    border: "border-purple-200",
  },
};
