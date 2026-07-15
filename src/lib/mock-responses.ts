import type { ActionType, ExplainResponse, Source } from "./types";

const MOCK_SOURCES: Source[] = [
  {
    title: "ECB sprendimų suvestinė, 2024 m.",
    url: "#ecb-2024",
    excerpt: "Europos centrinis bankas palaiko griežtą monetarinę politiką.",
  },
  {
    title: "Lietuvos banko infliacijos apžvalga",
    url: "#lb-infliacija",
    excerpt: "Infliacija Lietuvoje lėtėja, tačiau viršija euro zonos vidurkį.",
  },
  {
    title: "Būsto paskolų rinkos analizė",
    url: "#bustas-2024",
    excerpt: "Palūkanų normų kilimas sumažino paskolų paklausą 15 proc.",
  },
];

function pickSources(keywords: string[]): Source[] {
  const lower = keywords.join(" ").toLowerCase();
  if (lower.includes("būst") || lower.includes("paskol")) {
    return [MOCK_SOURCES[2], MOCK_SOURCES[1]];
  }
  if (lower.includes("kvantin") || lower.includes("skatinim")) {
    return [MOCK_SOURCES[0], MOCK_SOURCES[1]];
  }
  return MOCK_SOURCES.slice(0, 2);
}

const RESPONSES: Record<
  ActionType,
  (selectedText: string) => string
> = {
  detail: (text) =>
    `„${text}" kontekste verta prisiminti, kad ECB sprendimai daro tiesioginį poveikį visai euro zonai, įskaitant Lietuvą. ` +
    `Pastarųjų metų palūkanų normų kilimas buvo reakcija į spartų infliacijos augimą po energijos krizės ir tiekimo grandinių sutrikimų. ` +
    `Nors infliacija lėtėja, centrinis bankas nenori skubėti su palūkanų mažinimu, nes bijo, kad per anksti atlaisvinta politika gali vėl pakelti kainas. ` +
    `Lietuvos atveju tai reiškia brangesnį skolinimąsi ir atsargesnį verslo investavimą.`,
  explain: (text) =>
    `„${text}" — tai terminas, reiškiantis, kad centrinis bankas „spausdina" pinigus ir perka obligacijas iš rinkos, kad paskatintų ekonomiką. ` +
    `Paprastai tariant: kai ekonomika lėtėja, bankas į marketą įleidžia daugiau pinigų, kad žmonės ir įmonės lengviau skolintųsi ir leistų. ` +
    `Dabar ECB šios priemonės nebevartoja — vietoj to jis kelia palūkanas, kad pinigų būtų mažiau ir infliacija kristų.`,
  alternative: (text) =>
    `Kalbant apie „${text}", ne visi ekonomistai sutinka su oficialia ECB pozicija. ` +
    `Dalies ekspertų nuomone, per griežta monetarinė politika jau dabar stabdo augimą ir didina nedarbą, nors infliacija ir taip lėtėja dėl energijos kainų stabilizavimo. ` +
    `Jie argumentuoja, kad centrinis bankas reaguoja į praeities duomenis, o ne į ateities rizikas — ir kad smulkus verslas bei jaunos šeimos, ieškančios būsto, moka per didelę kainą.`,
};

export function getMockResponse(
  selectedText: string,
  actionType: ActionType
): ExplainResponse {
  return {
    text: RESPONSES[actionType](selectedText),
    sources: [],
    actionType,
  };
}
