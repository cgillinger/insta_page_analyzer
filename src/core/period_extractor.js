/**
 * Period Extractor
 * 
 * Extraherar år och månad från Instagram API CSV-filnamn
 * Hanterar format: IG_YYYY_MM.csv (t.ex. IG_2025_10.csv)
 */

/**
 * Regex för att matcha Instagram API filnamnsformat
 * Format: IG_YYYY_MM.csv
 */
const IG_FILENAME_PATTERN = /^IG_(\d{4})_(\d{1,2})\.csv$/i;

/**
 * Alternativt regex för flexibilitet (med eller utan IG_ prefix)
 * Format: [IG_]YYYY_MM.csv
 */
const FLEXIBLE_FILENAME_PATTERN = /^(?:IG_)?(\d{4})_(\d{1,2})\.csv$/i;

/**
 * Extraherar period från Instagram API filnamn
 * @param {string} filename - Filnamn att analysera
 * @param {boolean} strict - Om true, kräv exakt IG_YYYY_MM.csv format
 * @returns {Object|null} - Period objekt {year, month, filename} eller null vid fel
 */
export function extractPeriodFromFilename(filename, strict = true) {
  if (!filename || typeof filename !== 'string') {
    console.warn('extractPeriodFromFilename: Ogiltigt filnamn', filename);
    return null;
  }

  // Använd strict eller flexibelt pattern
  const pattern = strict ? IG_FILENAME_PATTERN : FLEXIBLE_FILENAME_PATTERN;
  const match = filename.match(pattern);

  if (!match) {
    console.warn(`extractPeriodFromFilename: Filnamn matchar inte förväntat format: ${filename}`);
    return null;
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);

  // Validera år och månad
  if (!isValidYear(year) || !isValidMonth(month)) {
    console.warn(`extractPeriodFromFilename: Ogiltigt år (${year}) eller månad (${month}) i ${filename}`);
    return null;
  }

  return {
    year,
    month,
    filename,
    isValid: true
  };
}

/**
 * Extraherar period från File-objekt
 * @param {File} file - File objekt från filuppladdning
 * @param {boolean} strict - Om true, kräv exakt IG_YYYY_MM.csv format
 * @returns {Object|null} - Period objekt eller null vid fel
 */
export function extractPeriodFromFile(file, strict = true) {
  if (!file || !file.name) {
    console.warn('extractPeriodFromFile: Ogiltigt File objekt', file);
    return null;
  }

  const result = extractPeriodFromFilename(file.name, strict);
  if (result) {
    result.file = file;
    result.fileSize = file.size;
    result.lastModified = file.lastModified;
  }

  return result;
}

/**
 * Validerar om ett år är rimligt för Instagram API data
 * @param {number} year - År att validera
 * @returns {boolean} - True om året är giltigt
 */
export function isValidYear(year) {
  const currentYear = new Date().getFullYear();
  // Instagram grundades 2010, tillåt data från 2010 till 5 år framåt
  return year >= 2010 && year <= currentYear + 5;
}

/**
 * Validerar om en månad är giltig
 * @param {number} month - Månad att validera (1-12)
 * @returns {boolean} - True om månaden är giltig
 */
export function isValidMonth(month) {
  return month >= 1 && month <= 12;
}

/**
 * Validerar komplett period
 * @param {number} year - År
 * @param {number} month - Månad
 * @returns {boolean} - True om perioden är giltig
 */
export function isValidPeriod(year, month) {
  return isValidYear(year) && isValidMonth(month);
}

/**
 * Skapar standardiserat filnamn för en period
 * @param {number} year - År
 * @param {number} month - Månad
 * @returns {string} - Standardiserat filnamn (IG_YYYY_MM.csv)
 */
export function createStandardFilename(year, month) {
  if (!isValidPeriod(year, month)) {
    throw new Error(`Ogiltig period: år=${year}, månad=${month}`);
  }

  // Padding för månad (01, 02, etc.)
  const paddedMonth = month.toString().padStart(2, '0');
  return `IG_${year}_${paddedMonth}.csv`;
}

/**
 * Extraherar perioder från flera filer
 * @param {FileList|Array<File>} files - Lista med filer
 * @param {boolean} strict - Om true, kräv exakt IG_YYYY_MM.csv format
 * @returns {Array<Object>} - Lista med period-objekt (endast giltiga)
 */
export function extractPeriodsFromFiles(files, strict = true) {
  if (!files || files.length === 0) {
    console.warn('extractPeriodsFromFiles: Inga filer att behandla');
    return [];
  }

  const periods = [];
  const filesArray = Array.from(files);

  for (const file of filesArray) {
    const period = extractPeriodFromFile(file, strict);
    if (period) {
      periods.push(period);
    }
  }

  // Sortera kronologiskt
  return periods.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });
}

/**
 * Grupperar period-objekt efter år
 * @param {Array<Object>} periods - Lista med period-objekt
 * @returns {Object} - Grupperade perioder: {year: [periods]}
 */
export function groupPeriodsByYear(periods) {
  const grouped = {};

  for (const period of periods) {
    if (!grouped[period.year]) {
      grouped[period.year] = [];
    }
    grouped[period.year].push(period);
  }

  // Sortera månader inom varje år
  for (const year in grouped) {
    grouped[year].sort((a, b) => a.month - b.month);
  }

  return grouped;
}

/**
 * Hittar saknade månader i en sekvens
 * @param {Array<Object>} periods - Lista med period-objekt
 * @returns {Array<Object>} - Lista med saknade perioder {year, month}
 */
export function findMissingPeriods(periods) {
  if (periods.length === 0) return [];

  const sortedPeriods = [...periods].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  const first = sortedPeriods[0];
  const last = sortedPeriods[sortedPeriods.length - 1];
  const missing = [];

  // Skapa set av befintliga perioder för snabb lookup
  const existingPeriods = new Set(
    periods.map(p => `${p.year}_${p.month}`)
  );

  // Gå igenom alla månader från första till sista
  let currentYear = first.year;
  let currentMonth = first.month;

  while (currentYear < last.year || (currentYear === last.year && currentMonth <= last.month)) {
    const periodKey = `${currentYear}_${currentMonth}`;
    
    if (!existingPeriods.has(periodKey)) {
      missing.push({
        year: currentYear,
        month: currentMonth,
        filename: createStandardFilename(currentYear, currentMonth)
      });
    }

    // Gå till nästa månad
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
  }

  return missing;
}

/**
 * Validerar att en lista med perioder är konsistent och utan dubletter
 * @param {Array<Object>} periods - Lista med period-objekt
 * @returns {Object} - Valideringsresultat {isValid, errors, duplicates}
 */
export function validatePeriodSequence(periods) {
  const result = {
    isValid: true,
    errors: [],
    duplicates: []
  };

  if (periods.length === 0) {
    result.errors.push('Inga perioder att validera');
    result.isValid = false;
    return result;
  }

  const seenPeriods = new Set();

  for (const period of periods) {
    // Kontrollera att period-objektet är korrekt format
    if (!period.year || !period.month) {
      result.errors.push(`Ogiltig period: ${JSON.stringify(period)}`);
      result.isValid = false;
      continue;
    }

    // Kontrollera dubletter
    const periodKey = `${period.year}_${period.month}`;
    if (seenPeriods.has(periodKey)) {
      result.duplicates.push(period);
      result.errors.push(`Dublett hittad: ${period.filename || periodKey}`);
      result.isValid = false;
    } else {
      seenPeriods.add(periodKey);
    }

    // Validera individuell period
    if (!isValidPeriod(period.year, period.month)) {
      result.errors.push(`Ogiltig period: år=${period.year}, månad=${period.month}`);
      result.isValid = false;
    }
  }

  return result;
}

/**
 * Formaterar period för visning
 * @param {Object} period - Period objekt {year, month}
 * @returns {string} - Formaterad period (t.ex. "Oktober 2025")
 */
export function formatPeriodForDisplay(period) {
  const months = [
    'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
    'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
  ];

  if (!period || !period.year || !period.month) {
    return 'Ogiltig period';
  }

  const monthName = months[period.month - 1] || 'Okänd månad';
  return `${monthName} ${period.year}`;
}
