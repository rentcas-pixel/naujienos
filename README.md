# Skaitmeninis skaitymo palydovas

Naujienų portalo MVP, kuriame skaitytojas pažymi tekstą ir gauna AI atsakymus tiesiai straipsnyje.

## Paleisti

```bash
npm install
npm run dev
```

Atidarykite [http://localhost:3000](http://localhost:3000)

## Kaip naudoti

1. Eikite į demo straipsnį
2. Pažymėkite bet kurią frazę (pvz. „kvantinis skatinimas" ar „būsto paskolų rinką")
3. Pasirinkite veiksmą: **Detaliau**, **Paaiškink man** ar **Alternatyva**
4. AI blokas atsiras po pastraipa su atsakymu ir šaltiniais

## OpenAI (optional)

Sukurkite `.env.local`:

```
OPENAI_API_KEY=sk-...
TAVILY_API_KEY=tvly-...   # optional — interneto paieška faktiniams klausimams
OPENAI_MODEL=gpt-4o       # optional, numatyta gpt-4o
```

Be `TAVILY_API_KEY` AI atsakys iš atminties (be realaus laiko paieškos).

## Stack

- Next.js 16 + TypeScript
- Tailwind CSS
- OpenAI API (optional)
