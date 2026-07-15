const PROMOTIONAL_PATTERNS = [
  /pranešime\s+(?:spaudai|žiniasklaidai)/i,
  /pranešimas\s+(?:spaudai|žiniasklaidai)/i,
  /rašoma\s+[„"][^"„"]+[""]\s+pranešime/i,
  /\bBNS\b.*pranešim/i,
  /partnerio\s+turinys/i,
  /reklaminis\s+(?:turinys|straipsnis|skelbimas)/i,
  /specialus\s+projektas/i,
  /infomedija/i,
  /publikuojama\s+(?:pagal|remiant)/i,
  /kompanija\s+(?:skelbia|informuoja)/i,
  /įmonė\s+(?:skelbia|informuoja)/i,
  /prekės\s+ženklas.*(?:skelbia|informuoja)/i,
];

export function isPromotionalContent(title: string, text: string): boolean {
  const combined = `${title}\n${text}`;
  return PROMOTIONAL_PATTERNS.some((pattern) => pattern.test(combined));
}
