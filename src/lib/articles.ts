import type { Article } from "./types";

export const articles: Record<string, Article> = {
  "centrinis-bankas-palukanos": {
    slug: "centrinis-bankas-palukanos",
    category: "Ekonomika",
    publishedAt: "prieš 2 val.",
    readingTime: "4 min skaitymo",
    title: "Centrinis bankas kelia bazinę palūkanų normą",
    paragraphs: [
      {
        id: "p1",
        text: "Europos centrinis bankas (ECB) ketvirtadienį nusprendė padidinti bazinę palūkanų normą 25 baziniais punktais iki 4,25 proc. Sprendimas priimtas siekiant suvaldyti infliaciją, kuri euro zonoje vis dar viršija 2 proc. tikslą, nors pastaruosius mėnesius rodo lėtėjimo tendenciją.",
      },
      {
        id: "p2",
        text: "ECB valdyba pažymėjo, kad monetarinė politika išlieka griežta, tačiau artimiausiais mėnesiais gali būti peržiūrėta, jei infliacijos rodikliai toliau gerės. Analitikai teigia, kad sprendimas buvo tikėtinas, atsižvelgiant į kitų centrinių bankų pozicijas.",
      },
      {
        id: "p3",
        text: "Lietuvoje sprendimas turės tiesioginį poveikį būsto paskolų rinkai. Bankai jau anksčiau pakėlė palūkanų normas skolininkams, ir naujas ECB sprendimas gali reikšti dar brangesnes paskolas. Finansų ekspertai perspėja, kad namų pirkėjai turėtų atidžiai apsvarstyti skolinimosi galimybes.",
      },
      {
        id: "p4",
        text: "Kai kurie ekonomistai kritikuoja sprendimą, teigdami, kad griežta monetarinė politika gali sulėtinti ekonomikos augimą. Kita vertus, ECB atstovai pabrėžia, kad kvantinis skatinimas nebeaktualus — dabar svarbiausia išlaikyti kainų stabilumą ir pasitikėjimą euru.",
      },
      {
        id: "p5",
        text: "Vyriausybės atstovai paragino gyventojus nepanikuoti ir priminė, kad palūkanų normų kilimas yra ciklinis procesas. Finansų ministerija planuoja pateikti rekomendacijas namų savininkams, turintiems kintamos palūkanos paskolas.",
      },
    ],
    timeline: [
      {
        date: "2024-03-07",
        title: "ECB palieka palūkanas nepakitusias",
        excerpt:
          "Valdyba nusprendė nekeisti bazinės normos, laukiant naujų infliacijos duomenų.",
      },
      {
        date: "2024-06-06",
        title: "Pirmas palūkanų mažinimas po krizės",
        excerpt: "ECB sumažino normą 25 bp, signalizuodamas apie ciklo pabaigą.",
      },
      {
        date: "2024-09-12",
        title: "Infliacija euro zonoje nukrito iki 2,2 proc.",
        excerpt:
          "Rodiklis artėja prie tikslo, tačiau ECB išlieka atsargus dėl energijos kainų.",
      },
      {
        date: "2025-01-15",
        title: "Lietuvos būsto kainos stabilizavosi",
        excerpt:
          "Naujausi duomenys rodo, kad Vilniaus rinka auga lėčiau nei 2023 m.",
      },
    ],
    alternativePerspectives: [
      {
        outlet: "Delfi",
        headline: "Palūkanų kilimas: kas laukia paskolų turėtojų?",
        excerpt:
          "Ekspertai pataria peržiūrėti paskolų sąlygas ir apsvarstyti refinansavimą, kol rinkos palūkanos dar gali kisti.",
        url: "#",
      },
      {
        outlet: "15min",
        headline: "ECB sprendimas: per anksti džiaugtis infliacijos lėtėjimu",
        excerpt:
          "Kritikai teigia, kad viena palūkanų normos didinimo banga dar nepakanka kainų stabilumui užtikrinti.",
        url: "#",
      },
    ],
  },
};

export function getArticle(slug: string): Article | undefined {
  return articles[slug];
}
