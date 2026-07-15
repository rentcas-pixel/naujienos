<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Headline editor

Kai vartotojas keičia antraščių redaktoriaus promptą / taisykles (`buildHeadlineEditorSystemPrompt`), jas taikyk **visoms skiltims** (Naujausios, Lietuva, Pasaulis, Verslas, Sportas, Nepriklausomi) ir straipsnio puslapiui — ne tik vienai kategorijai. Pipeline: `editHeadlinesForDisplay` / `getLatestNews` / `getHomepageWithSections` / `getNewsArticleBySlug`.