# Naujienos — produkto taisyklės

Viena vieta visoms redakcinėms / publish taisyklėms.  
Kodas privalo laikytis šito dokumento.

---

## 1. Pipeline (eiliškumas)

```
RSS → antraštė → pilnas tekstas → Kitu kampu (+ QA) → Supabase ready → Feed
```

1. Ateina RSS item.
2. AI sutvarko **antraštę**.
3. Jei RSS plonas — AI išplečia į **skaitomą straipsnį**.
4. AI sugeneruoja **„Kitu kampu“** (1–3 skiltys) ir praeina **novelty + AI QA**.
5. Tik tada statusas `ready` ir straipsnis **pateka į feed’ą**.
6. Atidarius straipsnį — skaitoma iš DB, ne „generuojam dabar“.

**Kokybė > kiekis.** Geriau mažiau naujienų feed’e negu silpni / tušti įrašai.

---

## 2. Kada galima dėti į feed (`ready`)

Reikia **abu**:

| Reikalavimas | Slenkstis |
|---|---|
| Normalus straipsnis | ≥ **280** simbolių teksto po paruošimo |
| Normalus „Kitu kampu“ | ≥ **1 skiltis** su ≥ **1 faktu** (ne tuščias `angles: []`) |

Jei trūksta bent vieno — **nededam** į feed.

Saugoma Supabase `topic_angle_packs`:
- `status = ready` + `title` + `article` + `pack` (su faktais)

---

## 3. Kada NEdedam (`skipped` / eilė)

| Priežastis | Kada |
|---|---|
| `promotional` | PR / reklaminis turinys |
| `thin` | Per mažai teksto / per silpna info |
| `no_sources` | Mažiau nei **2** nepriklausomi šaltinių domenai |
| `generation_failed` | AI / paieška nepavyko |
| `qa_failed` | AI QA atmetė rakursus (kartojimas / be vertės) |

Prieš generuojant rakursus (paieška):
- ≥ **2** skirtingi šaltinių domenai
- ≥ **350** simb. paieškos snippet’ų **arba** ≥ **600** simb. straipsnio body

---

## 4. „Kitu kampu“ redakcinės taisyklės

### Tikslas
Skaitytojas po 1–2 min žino **gerokai daugiau**, nei perskaitęs vien straipsnį.  
**Ne** perrašyti / sutrumpinti straipsnį.

### Kiek skilčių
- **1–3** (maks. 3)
- Jei vertingų tik 1 ar 2 — tiek ir daryk
- Kokybė > „kad būtų 3“

### Draudžiama
- Skiltys tipo **„Kas nutiko“ / „Santrauka“ / „Esmė“**
- Kartoti straipsnio sakinius ar parafrazes
- Bendrybės be skaičių („strategiškai svarbu“, „kelia nerimą“)
- „Įdomūs faktai“ be konkretaus skaičiaus / dydžio / datos / palyginimo

### Privaloma
- Kiekvienas faktas praeina testą: *„Gerai, šito straipsnyje tikrai nebuvo.“*
- Remtis tik straipsniu + paieška — **negalvoti** datų / skaičių
- Rašyti **lietuviškai**
- Po generavimo — **AI QA** (antras modelio kvietimas); jei fail — nepublikuoti

### Pavyzdžiai
- **Blogai:** „Hormūzo sąsiauris yra svarbus naftos transportavimui.“ (jei tai jau straipsnyje)
- **Gerai:** konkretūs dydžiai / istorija / % srautų, kurių **nėra** tekste

---

## 5. Antraštės

- Feed ir straipsnio H1 — **tas pats** antraščių kelias (`editHeadlinesForDisplay`)
- Taisyklės taikomos **visoms skiltims**: Naujausios, Lietuva, Pasaulis, Verslas, Sportas, Nepriklausomi (+ straipsnio puslapis)

---

## 6. UI taisyklės (straipsnio puslapis)

| Įrenginys | Elgsena |
|---|---|
| **Desktop** (>768px) | Pažymėjus tekstą — iš karto **„Detaliau“** su generuojamu atsakymu |
| **Mobile** (≤768px) | Piliulė: Paaiškink · Sutrauk · Detaliau · Klausk… |

---

## 7. Infrastruktūra

- Pack’ai / gate: **Supabase** (`topic_angle_packs`, `publish_gate`)
- Fonas: homepage warm + Vercel Cron `/api/cron/warm-angles` (Hobby — kas dieną)
- Lokalė: jei Supabase nepasiekiamas — fallback į `.data/` (dev only)

Env:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (arba `SUPABASE_SERVICE_ROLE`)
- `CRON_SECRET`
- `OPENAI_API_KEY`, `TAVILY_API_KEY`

---

## 8. Trumpa santrauka

1. **Kokybė > kiekis**  
2. Be gero straipsnio **ir** gero „Kitu kampu“ — **nėra feed’e**  
3. „Kitu kampu“ ≠ santrauka; tik nauja vertė  
4. Desktop = Detaliau iš karto; mobile = piliulė  
5. Paruošta DB’ėje → tada rodom  

---

*Atnaujinta pagal sutartą publish gate (2026-07-16).*
