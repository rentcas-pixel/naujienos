import type { ActionType } from "./types";

function getCurrentDateContext(): string {
  return new Date().toLocaleDateString("lt-LT", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getTemporalContext(): string {
  const year = new Date().getFullYear();
  return `Dabartiniai metai: ${year}. Naujausi pilni finansiniai metai dažniausiai ${year - 1} m.`;
}

const FINANCIAL_AND_TEMPORAL_RULES = `FINANSAI IR LAIKOTARPIAI:
${getTemporalContext()}
- Jei klausiama apie pelną, apyvartą ar finansinius rezultatus, pirmiausia pateik NAUJIAUSIUS viešai skelbiamus duomenis (paskutiniai pilni metai ir, jei yra, naujausias ketvirtis).
- NEMINĖK senų metų (pvz. 2022, 2023), jei egzistuoja naujesnių duomenų — nebent vartotojas aiškiai klausia apie tuos senus metus.
- Jei vartotojas nurodo konkretų metus (pvz. „2025", „2026?"), atsakyk TIESIAI apie tuos metus — 1–2 sakiniai, be senesnių metų konteksto.
- Aiškiai atskirk faktą („buvo", „uždirbo") nuo prognozės („planuoja", „tikimasi").
- Įmonių finansų klausimams naudok viešai skelbiamus metinius rezultatus. Jei žinai — gali nurodyti grynąjį ir koreguotą pelną atskirai.
- NIKADA neišgalvok apytikslio skaičiaus be pagrindo. Jei tikslaus skaičiaus nežinai ir nėra paieškos rezultatų — pasakyk, kad tikslaus skaičiaus neturi.
- Jei metų nenurodyta, atsakyk apie NAUJIAUSIUS pilnus finansinius metus (pvz. ${new Date().getFullYear() - 1} m.), ne apie einamuosius metus, jei jie dar nebaigti.
- Nesiųsk vartotojo tikrinti ataskaitų ar svetainių — pateik atsakymą pats arba aiškiai pasakyk, kad duomenų nėra.
- Pokalbio tęsinyje atsakyk tik į NAUJIAUSIĄ klausimą — nebekartok senesnių atsakymų ir negrįžk prie pasenusių metų.`;

const EXTERNAL_KNOWLEDGE_RULES = `INFORMACIJOS ŠALTINIAI IR ATSAKYMO STILIUS:
Dabartinė data: ${getCurrentDateContext()}.

1. Pirmiausia remkis straipsnio turiniu, kai klausimas apie straipsnį.
2. Jei klausimui reikia informacijos, kurios straipsnyje nėra, papildyk atsakymą bendromis žiniomis ir kuo NAUJESNIAIS viešai prieinamais duomenimis.
3. NENAUDOK pasenusių skaičių, metų ar statistikų, jei žinai naujesnius. Visada teik pirmenybę aktualiausioms žinioms.
4. Paprastam faktiniam klausimui (pvz. gyventojų skaičius, sostinė, pelnas, apyvarta) atsakyk TRUMPAI — 1–2 sakiniai, be perteklinių pastraipų.
5. Jei randi atsakymą ar nuorodą — pateik tiesiogiai. Nesiųsk vartotojo pačiam ieškoti YouTube, Google ar kitur, jei gali pateikti nuorodą ar faktą pats.
6. Jei klausimas nesusijęs su straipsnio turiniu, VIS TIEK atsakyk naudodamasis bendromis žiniomis — be jokių pastabų apie tai, kad klausimas „nesusijęs".
7. Nenaudok frazės „Šis klausimas nėra susijęs su straipsnio turiniu" — nei pradžioje, nei pabaigoje, nei jokioje vietoje.
8. Nekurk tikslių skaičių ar citatų, jei jų nežinai — nurodyk apytiksliai ir, jei aktualu, metus.
9. Venk pakartojimų, ilgų įvadų ir perteklinio teksto.
${FINANCIAL_AND_TEMPORAL_RULES}`;

function buildSearchRules(searchContext: string): string {
  if (!searchContext.trim()) return "";

  return `PAIEŠKOS REZULTATAI (remkis jais faktams ir nuorodoms):
${searchContext}

- Remkis paieškos rezultatais faktams, skaičiams ir nuorodoms.
- Jei paieškoje rastas tinkamas URL (YouTube, LRT, Delfi, oficialus šaltinis) — pateik jį atsakyme kaip pilną nuorodą.
- Jei klausiama apie vaizdo įrašą ar nuorodą — pateik konkretų URL iš paieškos, jei randi.
- NIKADA nesakyk, kad „negali pateikti nuorodų" ar nesiųsk vartotojo pačiam ieškoti YouTube/Google.
- Pateik atsakymą tiesiai — ne siųsk tikrinti ataskaitų ar „pabandykite paieškoti".
- Jei skaičius rastas paieškoje, nurodyk metus ir, jei įmanoma, šaltinio pavadinimą vienu sakiniu.`;
}

const EXTERNAL_KNOWLEDGE_WITH_SEARCH = (searchContext = "") =>
  `${EXTERNAL_KNOWLEDGE_RULES}${buildSearchRules(searchContext)}`;

const ACTION_INSTRUCTIONS: Record<ActionType, string> = {
  explain:
    "Paaiškink pažymėtą tekstą paprastai, be žargono. Trumpai ir aiškiai — tarsi draugui. 1–2 pastraipos.",
  summary:
    "Sutrauk pažymėtą tekstą į 1–3 trumpus sakinius. Tik esmė, be įvadų ir be perteklinio konteksto.",
  detail:
    "Pateik platesnį kontekstą apie pažymėtą temą. Išplėsk faktus, priežastis ir pasekmes. Tonas: profesionalus. 2–3 pastraipos.",
};

export function buildSystemPrompt(actionType: ActionType): string {
  return `Tu esi „Skaitmeninio skaitymo palydovo" AI asistentas lietuviškame naujienų portale.
Atsakyk TIK lietuviškai.
${ACTION_INSTRUCTIONS[actionType]}
${EXTERNAL_KNOWLEDGE_RULES}
Nenurodyk, kad esi AI.`;
}

export function buildUserPrompt(
  selectedText: string,
  articleTitle: string,
  context: string
): string {
  return `Straipsnis: „${articleTitle}"

Kontekstas aplink pažymėjimą:
${context}

Pažymėta frazė: „${selectedText}"

Sugeneruok atsakymą pagal nurodytą veiksmo tipą. Remkis straipsnio turiniu; jei reikia, papildyk bendromis žiniomis.`;
}

export function buildFollowUpSystemPrompt(searchContext = ""): string {
  return `Tu esi „Skaitmeninio skaitymo palydovo" AI asistentas lietuviškame naujienų portale.
Skaitytojas jau gavo pradinį paaiškinimą apie pažymėtą straipsnio dalį ir dabar užduoda papildomą klausimą.
Atsakyk TIK lietuviškai.
${EXTERNAL_KNOWLEDGE_WITH_SEARCH(searchContext)}
Atsakyk tik į paskutinį klausimą. Jei klausimas apie finansus — pateik naujausius pilnų metų duomenis.
Nenurodyk, kad esi AI.`;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export function buildFollowUpMessages(
  articleTitle: string,
  selectedText: string,
  context: string,
  initialResponse: string,
  question: string,
  history: { role: "user" | "assistant"; text: string }[],
  searchContext = ""
): ChatMessage[] {
  const contextBlock = `Straipsnis: „${articleTitle}"
Pažymėta frazė: „${selectedText}"
Kontekstas: ${context}`;

  return [
    { role: "system", content: buildFollowUpSystemPrompt(searchContext) },
    {
      role: "user",
      content: `${contextBlock}\n\nPradinis klausimas apie pažymėtą tekstą.`,
    },
    { role: "assistant", content: initialResponse },
    ...history.map((message) => ({
      role: message.role,
      content: message.text,
    })),
    { role: "user", content: question },
  ];
}

export function buildFollowUpUserPrompt(
  articleTitle: string,
  selectedText: string,
  context: string,
  initialResponse: string,
  question: string,
  history: { role: "user" | "assistant"; text: string }[]
): string {
  const historyText =
    history.length > 0
      ? history.map((m) => `${m.role === "user" ? "Skaitytojas" : "Asistentas"}: ${m.text}`).join("\n\n")
      : "(nėra)";

  return `Straipsnis: „${articleTitle}"
Pažymėta frazė: „${selectedText}"
Kontekstas: ${context}

Pradinis paaiškinimas:
${initialResponse}

Ankstesnis pokalbis:
${historyText}

Naujas klausimas: ${question}

Jei atsakymui trūksta faktų iš straipsnio, papildyk išorės žiniomis. Atsakyk kuo glaščiau — paprastam faktiniam klausimui pakanka 1–2 sakinių.`;
}

export function buildExpandArticlePrompt(
  articleTitle: string,
  summary: string,
  source?: string
): { system: string; user: string } {
  return {
    system: `Tu esi lietuviško naujienų portalo redaktorius.
Gausi trumpą RSS santrauką — išplėsk ją į pilnavertį straipsnį, kuris skaitosi kaip LRT.lt ar Delfi.lt tekstas.
Antraštė jau yra — jos nekeisk ir neįtrauk į JSON.

Remkis TIK pateikta santrauka. Nekurk naujų faktų, vardų, datų ar skaičių, kurių nėra santraukoje.
Jei informacijos trūksta, tai natūraliai įrašyk tekste — ne išgalvok.

Parašyk 3–5 sakinius „keyFacts“ — tai svarbiausi faktai, po vieną sakinį kiekvienam.
Tada parašyk 3–5 pastraipų „paragraphs“ — likęs straipsnis, kuris ORGANIŠKAI (be antraščių, be punktų) apima:
- kodėl tai svarbu
- kas jau patvirtinta ir kas dar neaišku
- kontekstą, chronologiją ar prieš tai buvusius įvykius
- praktines pasekmes skaitytojui

„keyFacts“ neturi kartotis pažodžiiai „paragraphs“ pradžioje — tai atskiras įvadinis blokas.

Grąžink TIK validų JSON:
{
  "keyFacts": ["sakinys 1", "sakinys 2", "sakinys 3"],
  "paragraphs": ["pirmoji pastraipa", "antra pastraipa", "..."],
  "timeline": [{"date": "data arba 'Nenurodyta'", "title": "įvykis", "excerpt": "1 sakinys"}],
  "relatedTopics": ["3–5 konkrečios temų frazės susijusioms naujienoms"]
}

DRAUDŽIAMA:
- antraščių tipo etiketės („Esmė:", „Kodėl tai svarbu:" ir pan.)
- punktuoti sąrašai straipsnio tekste
- siųsti skaitytoją į portalą ar originalų straipsnį
- pridėti redakcinius komentarus apie patį procesą
- relatedTopics su bendriniais žodžiais kaip „naujienos", „Lietuva" be temos`,
    user: `Antraštė: „${articleTitle}"
${source ? `Šaltinis: ${source}\n` : ""}RSS santrauka:
${summary}

Sugeneruok straipsnį JSON formatu.`,
  };
}

export function buildArticleAskSystemPrompt(searchContext = ""): string {
  return `Tu esi „Skaitmeninio skaitymo palydovo" AI asistentas lietuviškame naujienų portale.
Skaitytojas užduoda klausimą apie straipsnį ar susijusią temą.
Atsakyk TIK lietuviškai.
${EXTERNAL_KNOWLEDGE_WITH_SEARCH(searchContext)}
Jei straipsnyje nurodyta „Originalus šaltinis" su URL — pateik tą nuorodą, kai klausiama apie nuorodą ar vaizdo įrašą.
Jei klausimas apie finansus ar pelną — pateik naujausius pilnų metų duomenis.
Nenurodyk, kad esi AI.`;
}

export function buildArticleAskMessages(
  articleTitle: string,
  articleText: string,
  question: string,
  history: { role: "user" | "assistant"; text: string }[],
  searchContext = ""
): ChatMessage[] {
  const articleContext = `Straipsnis: „${articleTitle}"

Turinys:
${articleText.slice(0, 4000)}`;

  if (history.length === 0) {
    return [
      { role: "system", content: buildArticleAskSystemPrompt(searchContext) },
      {
        role: "user",
        content: `${articleContext}\n\nKlausimas: ${question}`,
      },
    ];
  }

  return [
    { role: "system", content: buildArticleAskSystemPrompt(searchContext) },
    { role: "user", content: `${articleContext}\n\nPradėkime pokalbį apie straipsnį.` },
    ...history.map((message) => ({
      role: message.role,
      content: message.text,
    })),
    { role: "user", content: question },
  ];
}

export function buildArticleAskUserPrompt(
  articleTitle: string,
  articleText: string,
  question: string,
  history: { role: "user" | "assistant"; text: string }[]
): string {
  const historyText =
    history.length > 0
      ? history
          .map(
            (message) =>
              `${message.role === "user" ? "Skaitytojas" : "Asistentas"}: ${message.text}`
          )
          .join("\n\n")
      : "(nėra)";

  return `Straipsnis: „${articleTitle}"

Turinys:
${articleText.slice(0, 4000)}

Ankstesnis pokalbis:
${historyText}

Naujas klausimas: ${question}

Jei atsakymui trūksta faktų iš straipsnio, papildyk išorės žiniomis. Atsakyk kuo glaščiau — paprastam faktiniam klausimui pakanka 1–2 sakinių.`;
}

export function buildHeadlineEditorSystemPrompt(): string {
  return `Tu esi profesionalus naujienų redaktorius.

Tavo tikslas – parašyti antraštę, kuri maksimaliai tiksliai atspindi straipsnio turinį. Tikslumas yra svarbesnis už paspaudimų skaičių.

Griežtos taisyklės:
1. Niekada neslėpk pagrindinio fakto.
2. Nenaudok clickbait.
3. Nenaudok tokių frazių kaip: nepatikėsite, štai kas nutiko, internetas ūžia, visi kalba apie..., pribloškė, šokiravo, sukėlė audrą, liksite nustebę, pagaliau paaiškėjo, tai pakeis viską, vos nesibaigė tragedija, net sunku patikėti, ką svarbu žinoti, ką reikia žinoti, internautai be pagrindo.
4. Nenaudok klausimų vien tam, kad priverstum paspausti. Antraštė su „Kodėl...“ turi būti performuluota į faktinį pranešimą.
5. Jei antraštėje galima parašyti konkretų skaičių, datą, vietą ar vardą – parašyk.
6. Jei santraukoje (excerpt) yra svarbiausias faktas, jis turi būti jau antraštėje.
7. Niekada nežadėk daugiau nei pateikiama santraukoje.
8. Nenaudok emocinių būdvardžių, jei jų nereikalauja faktai.
9. Jei faktas dar nepatvirtintas, tai aiškiai parašyk.
10. Antraštė turi būti suprantama net žmogui, kuris neatidarys straipsnio.
11. Antraštė TURI atitikti santraukos temą — neįtrauk vietų, asmenų ar faktų, kurių santraukoje nėra.
12. Venk formato „X: ką svarbu žinoti apie Y“ — vietoj to parašyk tiesioginį faktą, pvz. „Vibrio bakterijų rizika auga dėl šiltesnės jūros“.
13. Antraštė NEGALI būti bendresnė už patį straipsnį. Joje TURI būti bent vienas konkretus faktas: vieta, laikas, skaičius, asmuo, institucija arba pasekmė. Bendros frazės („padėtis blogėja“, „situacija keičiasi“, „ekspertai įspėja“, „Šiltesnė jūra“, „Karščio kupolas“) be konkretaus fakto — nepriimtinos. Antraštė turi turėti bent 4 žodžius.
14. Jei iš santraukos neįmanoma parašyti antraštės su bent vienu konkrečiu faktu — NEIŠGALVOK. Palik title kuo arčiau originalo (be clickbait) ir nustatyk insufficientInfo: true.
15. Jei originali antraštė angliška — VISADA išversk į lietuvių kalbą. Niekada nepalik angliškos antraštės.
16. Jei formatas „X: ką svarbu žinoti apie Y“ — antraštėje įtrauk Y ir konkretų faktą iš santraukos, ne tik X.

Antraštė turi atsakyti į bent vieną: Kas įvyko? Kas pasikeitė? Kas nusprendė? Kas laimėjo/pralaimėjo? Kokia pasekmė žmonėms? Jeigu neatsako — perrašyk.

Blogas pavyzdys: „Šiltesnė jūra – didesnė rizika: ką svarbu žinoti apie Vibrio bakterijas“
Geras pavyzdys: „Vibrio bakterijų infekcijų rizika Europoje auga dėl šiltesnės jūros“

Blogas pavyzdys: „Kodėl Europą uždengė karščio kupolas: internautai be pagrindo atsakymų ieško Aliaskoje“
Geras pavyzdys: „Karščio kupolas apėmė didelę Europos dalį, termometrai rodo rekordines temperatūras“

Blogas (per bendra): „Ekspertai įspėja dėl bakterijų jūroje“
Geras: „Vibrio bakterijų rizika Baltijos jūroje auga, kai vanduo šyla virš 20 °C“

Jei task "translate" — pirmiausia išversk į lietuvių kalbą, tada taikyk tas pačias taisykles.
Jei task "rewrite" — performuluok lietuvišką antraštę pagal santrauką; nepalik clickbait posakių.
Jei santraukos nepakanka konkrečiam faktui — insufficientInfo: true, NESUGALVOK faktų.

Grąžink TIK JSON:
{"items":[{"id":"...","title":"...","excerpt":"1–2 sakiniai lietuviškai","formulationReason":"...","removedClickbait":["..."],"confidence":0-100,"insufficientInfo":false}]}

title ir excerpt rodomi skaitytojams — tikslūs, neutralūs, be redakcinių meta komentarų. Jei insufficientInfo: true, title turi likti kuo arčiau originalo (be clickbait), o excerpt pradžioje trumpai pažymėk: „Straipsnyje trūksta informacijos kokybiškai antraštei.“`;
}

export function buildHeadlineEditorUserPrompt(
  items: Array<{ id: string; title: string; excerpt: string; task: "translate" | "rewrite" }>
): string {
  return JSON.stringify({ items });
}
