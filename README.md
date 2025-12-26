# 📊 Facebook API Data Analyser

En tidserie-baserad webbapplikation för analys av Facebook månadsstatistik från Facebook API. Applikationen låter dig ladda upp CSV-filer med månadsdata och visualisera utvecklingen över tid för Facebook-sidor.

**Utvecklingsfas:** 1/8 - Grundkonfiguration ✅ KLAR

## 🎯 Projektöversikt

### Syfte
Analysera och visualisera Facebook API-data över tid med fokus på:
- Månadsvis utveckling per Facebook-sida
- Trendanalys över perioder
- Korrekt hantering av summerbara vs icke-summerbara metrics

### Dataformat
- **CSV-filer:** Format `FB_YYYY_MM.csv` (t.ex. `FB_2025_08.csv` = Augusti 2025)
- **Kolumner:** Page, Page ID, Reach, Engaged Users, Engagements, Reactions, Publications, Status, Comment
- **Storlek:** ~73 rader per fil (en rad per Facebook-sida)

### Kritiska datahanteringsregler
- ⚠️ **Reach & Engaged Users:** KAN ALDRIG summeras över månader (unika personer per månad)
- ✅ **Engagements, Reactions, Publications, Comment:** Kan summeras över månader
- 📅 **Period:** Extraheras automatiskt från filnamn

## 🛠️ Teknisk Stack

- **React 18** - UI-bibliotek
- **Vite** - Byggverktyg och utvecklingsserver
- **TailwindCSS** - Styling och design system
- **Radix UI** - Tillgängliga UI-komponenter
- **PapaParse** - CSV-parsning och validering
- **Lucide React** - Ikoner
- **XLSX** - Excel-export funktionalitet

## 🏗️ Projektstruktur

```
fb-page-analyzer/
├── src/
│   ├── core/                      # Kärnlogik (FAS 2)
│   │   ├── timeseries_models.js   # Datastrukturer för tidsserier
│   │   ├── period_extractor.js    # Extrahera datum från filnamn
│   │   └── csv_processor.js       # Bearbeta månads-CSV:er
│   ├── services/                  # Business logic (FAS 3)
│   │   ├── timeseries_analytics.js # Tidserie-beräkningar
│   │   ├── reach_calculator.js    # Hantera icke-summerbar Reach
│   │   └── aggregation_service.js # Korrekta aggregeringar över tid
│   ├── components/                # React-komponenter
│   │   ├── TimeseriesUploader.jsx # Multi-CSV uppladdning (FAS 5)
│   │   ├── PageTimeseriesView.jsx # Sidor över tid (FAS 6)
│   │   ├── MonthlyComparisonView.jsx # Jämför månader (FAS 6)
│   │   ├── TrendAnalysisView.jsx  # Trend-visualiseringar (FAS 7)
│   │   └── ui/                    # UI-komponenter ✅ KLARA
│   ├── utils/                     # Hjälpfunktioner (FAS 4)
│   │   ├── timeseries_storage.js  # Månadsvis lagring
│   │   ├── period_validator.js    # Validera filnamn och struktur
│   │   └── metric_categorizer.js  # Kategorisera metrics
│   └── lib/                       # Generella utilities ✅ KLAR
└── public/                        # Statiska assets ✅ KLAR
```

## 🚀 Installation och Utveckling

### Förutsättningar
- Node.js (v18 eller senare)
- npm eller yarn

### Installationssteg

1. **Installera dependencies**
   ```bash
   cd fb-page-analyzer
   npm install
   ```

2. **Starta utvecklingsserver**
   ```bash
   npm run dev
   ```

3. **Bygga för produktion**
   ```bash
   npm run build
   ```

4. **Förhandsgranska produktionsbygge**
   ```bash
   npm run preview
   ```

## 📋 Utvecklingsfaser

### ✅ FAS 1: GRUNDKONFIGURATION (KLAR)
- [x] Komplett projektstruktur
- [x] package.json med alla dependencies
- [x] Konfigurationsfiler (Vite, Tailwind, PostCSS)
- [x] UI-komponenter från ShadcnUI
- [x] Global styling med Facebook brand colors
- [x] Bas App.jsx struktur

### 🔄 FAS 2: DATAHANTERING (CORE)
- [ ] timeseries_models.js - Datastrukturer för Facebook-sidor
- [ ] period_extractor.js - Extrahera år/månad från filnamn
- [ ] csv_processor.js - Parsa och validera CSV-data

### 🔄 FAS 3: BUSINESS LOGIC (SERVICES)
- [ ] timeseries_analytics.js - Tidserie-beräkningar
- [ ] reach_calculator.js - Hantera icke-summerbar Reach
- [ ] aggregation_service.js - Korrekta aggregeringar

### 🔄 FAS 4: UTILITIES OCH LAGRING
- [ ] timeseries_storage.js - Datalagring
- [ ] period_validator.js - Filnamnsvalidering
- [ ] metric_categorizer.js - Metric-kategorisering

### 🔄 FAS 5: UPLOAD OCH DATAFLÖDE
- [ ] TimeseriesUploader.jsx - Multi-CSV uppladdning
- [ ] Drag-drop interface
- [ ] Progress indicators och validering

### 🔄 FAS 6: HUVUDVISUALISERINGAR
- [ ] PageTimeseriesView.jsx - Sidor över tid
- [ ] MonthlyComparisonView.jsx - Månadsjämförelser
- [ ] Export till CSV/Excel

### 🔄 FAS 7: TREND-ANALYS
- [ ] TrendAnalysisView.jsx - Avancerade trendanalyser
- [ ] PeriodSelector.jsx - Välj månadsintervall
- [ ] Procentuella förändringar och ranking

### 🔄 FAS 8: INTEGRATION OCH FINPUTSNING
- [ ] Slutgiltig integration av alla komponenter
- [ ] Error handling och loading states
- [ ] Performance-optimering
- [ ] Deployment-förberedelser

## 🎨 Design System

### Färgschema
- **Primary:** Facebook blå (#1877F2)
- **Bakgrund:** Ljusgrå för kontrast
- **Accent:** Variations av Facebook blå för interaktiva element

### Komponenter
Alla UI-komponenter är baserade på **Radix UI** med **Tailwind CSS** styling:
- Button (med Facebook-variant)
- Card (för datavisning)
- Table (för månadsdata)
- Tabs (för navigation)
- Alert (med info-variant)
- Select/Input (för filter och sök)

## 📊 Datahantering

### CSV-struktur förväntat
```csv
Page,Page ID,Reach,Engaged Users,Engagements,Reactions,Publications,Status,Comment
Sidnamn 1,123456,1500,500,75,45,5,25,5
Sidnamn 2,789012,2200,800,120,80,8,30,2
```

### Viktiga datahanteringsregler
1. **Filnamn:** Måste följa format `FB_YYYY_MM.csv`
2. **Reach/Engaged Users:** Visa som genomsnitt, summera ALDRIG över månader
3. **Övriga metrics:** Kan summeras för totaler över tid
4. **Validering:** Kontrollera att alla 9 kolumner finns

## 🔧 Utvecklaranteckningar

### Arkitektoniska principer
- **Modulär design:** Max 300 rader per fil
- **Separation of concerns:** Core → Services → Components → Utils
- **Anti-monolit:** Ingen fil ska hantera flera domäner
- **Testbarhet:** Komponenter ska kunna testas isolerat

### Namnkonventioner
- **Filer:** camelCase för JS, PascalCase för React-komponenter
- **Funktioner:** Beskrivande namn som reflekterar Facebook API-domänen
- **Komponenter:** Tidserie-specifika namn (TimeseriesUploader, MonthlyComparison)

## 📈 Roadmap

### Kortsiktigt (FAS 2-4)
- Implementera kärnlogik för databearbetning
- Bygg robust service-lager för beräkningar
- Sätt upp lagring och validering

### Medellång sikt (FAS 5-7)
- Utveckla användargränssnitt för datauppladdning
- Skapa visualiseringskomponenter
- Implementera avancerade analysverktyg

### Långsiktigt (FAS 8+)
- Performance-optimering för stora datamängder
- Exportfunktioner för rapporter
- Deployment och produktionssättning

## 📄 Licens

MIT License - Se LICENSE-fil för detaljer.

## 👥 Bidrag

Detta projekt utvecklas i faser enligt en detaljerad projektplan. Varje fas måste kompletteras innan nästa påbörjas.

---

**Status:** FAS 1 KOMPLETT ✅  
**Nästa steg:** Börja FAS 2 - Datahantering (Core)  
**Senast uppdaterad:** September 2025