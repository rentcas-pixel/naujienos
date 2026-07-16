"use client";

import { useState } from "react";

interface Angle {
  id: string;
  label: string;
  facts: string[];
}

/** Pavyzdys: Google Shopping — dinaminės skiltys */
const ANGLES: Angle[] = [
  {
    id: "istorija",
    label: "Istorija",
    facts: [
      "2002 m. Google pristatė Froogle – nemokamą produktų paieškos ir kainų palyginimo sistemą.",
      "2007 m. Froogle pervadinta į Google Product Search.",
      "2012 m. paslauga tapo Google Shopping; produktų rodymas perėjo prie mokamo modelio (PLA).",
      "2018–2021 m. Smart Shopping, vėliau — Performance Max kampanijos.",
      "Šiandien Shopping Ads veikia per Merchant Center ir Google Ads keliuose kanaluose.",
    ],
  },
  {
    id: "kodel",
    label: "Kodėl svarbu",
    facts: [
      "Lietuva patenka į antrąjį Europos plėtros etapą — vietiniai pardavėjai konkuruos vaizdiniais skelbimais paieškoje.",
      "Matomumą vis labiau lemia biudžetas ir kampanijos kokybė, ne vien mažiausia kaina.",
    ],
  },
  {
    id: "idomu",
    label: "Įdomus faktas",
    facts: [
      "Google Shopping pradžioje buvo kuriama pigiausiai prekei rasti; šiandien tai viena didžiausių reklamos platformų pasaulyje.",
    ],
  },
];

export function TopicAnglesMockup() {
  const [active, setActive] = useState(ANGLES[0].id);
  const current = ANGLES.find((a) => a.id === active) ?? ANGLES[0];

  return (
    <section className="mt-10 pt-8 border-t border-bbc-border">
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-bbc-red">
          Kitu kampu
        </h2>
        <p className="bbc-meta shrink-0">mockup · max 3 skiltys</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {ANGLES.map((angle) => {
          const isActive = angle.id === active;
          return (
            <button
              key={angle.id}
              type="button"
              onClick={() => setActive(angle.id)}
              className={`bbc-ai-tab ${isActive ? "bbc-ai-tab--active" : ""}`}
            >
              {angle.label}
            </button>
          );
        })}
      </div>

      <div className="border border-bbc-border px-4 py-5 md:px-5 md:py-6">
        <div className="article-key-facts">
          <div className="article-key-facts__body">
            {current.facts.map((fact) => (
              <div key={fact} className="article-key-facts__line">
                <p className="article-key-facts__text text-[17px] leading-[1.55]">
                  {fact}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
