import { SiteHeader } from "@/components/SiteHeader";
import { TopicAnglesMockup } from "@/components/TopicAnglesMockup";

export default function ArticleTopicMockupPage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader activeCategory="Lietuva" />

      <main className="max-w-[720px] mx-auto px-4 py-8">
        <div className="mb-6 border border-dashed border-bbc-border bg-bbc-bg-soft px-3 py-2 text-[12px] text-bbc-gray">
          Mockup ant tikros naujienos ·{" "}
          <a
            href="https://naujienos.vercel.app/straipsnis/5a60d750d2b8db54"
            className="text-bbc-red font-medium hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            5a60d750d2b8db54
          </a>
        </div>

        <p className="bbc-meta mb-3">
          <span>Lietuva</span>
          <span className="bbc-meta__dot">|</span>
          <span>LRT</span>
          <span className="bbc-meta__dot">|</span>
          <span>prieš 52 min.</span>
          <span className="bbc-meta__dot">|</span>
          <span>2 min skaitymo</span>
        </p>

        <h1 className="bbc-headline-hero text-bbc-black mb-6">
          Siekiant sumažinti demencijos riziką, PSO rekomenduoja aktyvų
          socialinį gyvenimą
        </h1>

        <p className="bbc-meta mb-6 pb-4 border-b border-bbc-border">
          Išplėsta RSS santrauka (AI) ·{" "}
          <a
            href="https://naujienos.vercel.app/straipsnis/5a60d750d2b8db54"
            className="text-bbc-red font-semibold hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Originalus straipsnis →
          </a>
        </p>

        <section className="article-key-facts mb-8 pb-8 border-b border-bbc-border">
          <p className="text-xs font-bold uppercase tracking-wider text-bbc-red mb-4">
            Svarbiausi faktai
          </p>
          <div className="article-key-facts__body">
            <div className="article-key-facts__line">
              <p className="article-key-facts__text text-[17px] leading-[1.55]">
                PSO paskelbė naujas gaires dėl demencijos prevencijos.
              </p>
            </div>
            <div className="article-key-facts__line">
              <p className="article-key-facts__text text-[17px] leading-[1.55]">
                Aktyvus socialinis gyvenimas gali sumažinti demencijos riziką.
              </p>
            </div>
            <div className="article-key-facts__line">
              <p className="article-key-facts__text text-[17px] leading-[1.55]">
                Rūkymas ir alkoholio vartojimas didina demencijos riziką.
              </p>
            </div>
          </div>
        </section>

        <div className="space-y-5 text-[17px] leading-[1.55] text-bbc-black mb-2">
          <p>
            Pasaulio sveikatos organizacija (PSO) neseniai paskelbė naujas
            gaires, siekdama padėti žmonėms sumažinti demencijos ir
            kognityvinių gebėjimų silpnėjimo riziką. Šiose gairėse pabrėžiama
            aktyvaus socialinio gyvenimo svarba, kuri kartu su fizine veikla ir
            sveika mityba gali reikšmingai prisidėti prie rizikos mažinimo. Tai
            reiškia, kad žmonės turėtų stengtis palaikyti socialinius ryšius ir
            dalyvauti bendruomeninėje veikloje.
          </p>
          <p>
            Be to, PSO atkreipia dėmesį į žalingus įpročius, tokius kaip
            rūkymas ir alkoholio vartojimas, kurie gali padidinti demencijos
            riziką. Organizacija rekomenduoja vengti šių įpročių, siekiant
            išsaugoti kognityvinę sveikatą. Tai svarbu ne tik vyresnio amžiaus
            žmonėms, bet ir jaunesniems, kurie nori užtikrinti ilgalaikę
            sveikatą.
          </p>
          <p>
            Demencija yra viena iš pagrindinių vyresnio amžiaus žmonių sveikatos
            problemų, todėl prevencinės priemonės yra itin svarbios. PSO gairės
            remiasi naujausiais tyrimais ir siekia informuoti visuomenę apie
            veiksmingus būdus, kaip sumažinti šios ligos riziką. Kol kas nėra
            aišku, kokie konkretūs socialinės veiklos tipai yra efektyviausi,
            tačiau bendras aktyvumo skatinimas yra laikomas teigiamu žingsniu.
          </p>
          <p>
            Šios gairės taip pat pabrėžia, kad kiekvienas žmogus gali prisidėti
            prie savo sveikatos gerinimo, pasirinkdamas sveikesnį gyvenimo
            būdą. Tai gali turėti teigiamą poveikį ne tik asmens sveikatai, bet
            ir visai visuomenei, mažinant sveikatos priežiūros išlaidas ir
            gerinant gyvenimo kokybę.
          </p>
        </div>

        <TopicAnglesMockup />
      </main>
    </div>
  );
}
