# Instagram Page Analyzer

Webbapplikation för analys av Instagram-kontors månadsstatistik. Ladda upp CSV-filer med månatlig data och visualisera utveckling över tid.

## Översikt

Applikationen analyserar och visualiserar Instagram-data över tid:
- Månadsvis utveckling per konto
- Trendanalys över perioder
- Jämförelser mellan konton

## Dataformat

**CSV-filer:** Format `Insta_YYYY_MM.csv` (exempel: `Insta_2025_08.csv`)

**Kolumner:**
- Account
- Account ID
- Reach
- Engagements
- Reactions
- Publications

**Datahantering:**
- **Reach:** Unika personer per månad (kan inte summeras över tid)
- **Engagements, Reactions, Publications:** Summerbara över månader
- **Period:** Extraheras automatiskt från filnamn

## Installation

**Förutsättningar:** Node.js v18+
```bash
cd insta-page-analyzer
npm install
npm run dev
```

**Produktion:**
```bash
npm run build
npm run preview
```

## Teknisk stack

- React 18
- Vite
- TailwindCSS
- Radix UI
- PapaParse (CSV-parsning)
- Lucide React (ikoner)

## Användning

1. Ladda upp CSV-filer med månadsdata
2. Välj konton och perioder att analysera
3. Visualisera trender och jämförelser
4. Exportera resultat som CSV

## Licens

MIT License
