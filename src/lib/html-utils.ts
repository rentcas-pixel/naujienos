/** Dažniausios RSS / HTML named entities (LT + tipografija). */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  laquo: "«",
  raquo: "»",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
  sbquo: "‚",
  bdquo: "„",
  bull: "•",
  middot: "·",
  deg: "°",
  euro: "€",
  pound: "£",
  copy: "©",
  reg: "®",
  trade: "™",
  times: "×",
  divide: "÷",
  minus: "−",
  shy: "",
  // Lietuviškos / Centrinės Europos raidės
  scaron: "š",
  Scaron: "Š",
  zcaron: "ž",
  Zcaron: "Ž",
  ccaron: "č",
  Ccaron: "Č",
  aacute: "á",
  Aacute: "Á",
  eacute: "é",
  Eacute: "É",
  iacute: "í",
  Iacute: "Í",
  oacute: "ó",
  Oacute: "Ó",
  uacute: "ú",
  Uacute: "Ú",
  yacute: "ý",
  Yacute: "Ý",
  agrave: "à",
  Agrave: "À",
  egrave: "è",
  Egrave: "È",
  igrave: "ì",
  Igrave: "Ì",
  ograve: "ò",
  Ograve: "Ò",
  ugrave: "ù",
  Ugrave: "Ù",
  acirc: "â",
  Acirc: "Â",
  ecirc: "ê",
  Ecirc: "Ê",
  icirc: "î",
  Icirc: "Î",
  ocirc: "ô",
  Ocirc: "Ô",
  ucirc: "û",
  Ucirc: "Û",
  auml: "ä",
  Auml: "Ä",
  euml: "ë",
  Euml: "Ë",
  iuml: "ï",
  Iuml: "Ï",
  ouml: "ö",
  Ouml: "Ö",
  uuml: "ü",
  Uuml: "Ü",
  szlig: "ß",
  ntilde: "ñ",
  Ntilde: "Ñ",
  ccedil: "ç",
  Ccedil: "Ç",
  oslash: "ø",
  Oslash: "Ø",
  aelig: "æ",
  AElig: "Æ",
};

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&#(\d+);/g, (_, code: string) => {
      const n = Number(code);
      return Number.isFinite(n) ? String.fromCodePoint(n) : _;
    })
    .replace(/&([a-zA-Z][a-zA-Z0-9]+);/g, (match, name: string) => {
      return NAMED_ENTITIES[name] ?? match;
    });
}

export function stripHtml(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

export function estimateReadingTime(text: string): string {
  const words = text.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min skaitymo`;
}

export function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "ką tik";
  if (minutes < 60) return `prieš ${minutes} min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `prieš ${hours} val.`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "vakar";
  if (days < 7) return `prieš ${days} d.`;
  return date.toLocaleDateString("lt-LT", {
    month: "short",
    day: "numeric",
  });
}

export function formatLrtDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}
