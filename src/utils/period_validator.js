/**
 * Period Validator
 * 
 * Validerar IG_YYYY_MM.csv filformat och CSV-innehåll för Instagram API data
 * Säkerställer korrekt struktur med 9 kolumner och giltigt datum-format
 */
import { extractPeriodFromFile, isValidPeriod, validatePeriodSequence } from '../core/period_extractor.js';
import { EXPECTED_COLUMNS } from '../core/csv_processor.js';

// Validerings-konstanter
const VALIDATION_CONFIG = {
  REQUIRED_FILE_EXTENSION: '.csv',
  REQUIRED_COLUMNS_COUNT: 9,
  MIN_ROWS: 1,
  MAX_ROWS: 200, // Rimlig gräns för antal Instagram-konton
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB max filstorlek
  REQUIRED_ENCODING: 'UTF-8'
};

// Felkategorier
const ERROR_TYPES = {
  FILENAME: 'filename_error',
  FILE_FORMAT: 'file_format_error',
  CSV_STRUCTURE: 'csv_structure_error',
  DATA_CONTENT: 'data_content_error',
  PERIOD_CONFLICT: 'period_conflict_error'
};

/**
 * Validerar en enskild fil komplett
 * @param {File} file - Fil att validera
 * @param {Array<Object>} existingPeriods - Befintliga perioder för dublettskontroll
 * @returns {Promise<Object>} - Valideringsresultat
 */
export async function validateFile(file, existingPeriods = []) {
  const result = {
    isValid: true,
    errors: [],
    warnings: [],
    fileInfo: {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    },
    period: null,
    csvInfo: null
  };

  try {
    // 1. Grundläggande filvalidering
    const basicValidation = validateBasicFileProperties(file);
    if (!basicValidation.isValid) {
      result.isValid = false;
      result.errors.push(...basicValidation.errors);
      return result;
    }

    // 2. Filnamnsvalidering och period-extrahering
    const periodValidation = validateFilenameAndExtractPeriod(file);
    if (!periodValidation.isValid) {
      result.isValid = false;
      result.errors.push(...periodValidation.errors);
      return result;
    }
    
    result.period = periodValidation.period;

    // 3. Dublettskontroll mot befintliga perioder
    const duplicateCheck = checkForPeriodDuplicate(periodValidation.period, existingPeriods);
    if (!duplicateCheck.isValid) {
      result.warnings.push(...duplicateCheck.warnings);
    }

    // 4. CSV-innehållsvalidering
    const csvContent = await readFileContent(file);
    const csvValidation = await validateCSVContent(csvContent, file.name);
    
    if (!csvValidation.isValid) {
      result.isValid = false;
      result.errors.push(...csvValidation.errors);
    } else {
      result.csvInfo = csvValidation.csvInfo;
      result.warnings.push(...csvValidation.warnings);
    }

    return result;

  } catch (error) {
    result.isValid = false;
    result.errors.push({
      type: ERROR_TYPES.FILE_FORMAT,
      message: `Oväntat fel vid validering: ${error.message}`,
      severity: 'error'
    });
    
    return result;
  }
}

/**
 * Validerar flera filer samtidigt
 * @param {FileList|Array<File>} files - Filer att validera
 * @returns {Promise<Object>} - Sammanlagt valideringsresultat
 */
export async function validateMultipleFiles(files) {
  if (!files || files.length === 0) {
    return {
      isValid: false,
      errors: [{
        type: ERROR_TYPES.FILE_FORMAT,
        message: 'Inga filer att validera',
        severity: 'error'
      }],
      fileResults: []
    };
  }

  const fileResults = [];
  const allErrors = [];
  const allWarnings = [];
  const detectedPeriods = [];

  const filesArray = Array.from(files);

  // Validera varje fil individuellt
  for (const file of filesArray) {
    const fileResult = await validateFile(file, detectedPeriods);
    fileResults.push(fileResult);
    
    if (!fileResult.isValid) {
      allErrors.push(...fileResult.errors);
    }
    
    allWarnings.push(...fileResult.warnings);
    
    if (fileResult.period) {
      detectedPeriods.push(fileResult.period);
    }
  }

  // Validera period-sekvens över alla filer
  const sequenceValidation = validatePeriodSequence(detectedPeriods);
  if (!sequenceValidation.isValid) {
    allErrors.push(...sequenceValidation.errors.map(err => ({
      type: ERROR_TYPES.PERIOD_CONFLICT,
      message: err,
      severity: 'error'
    })));
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
    fileResults,
    summary: {
      totalFiles: filesArray.length,
      validFiles: fileResults.filter(r => r.isValid).length,
      invalidFiles: fileResults.filter(r => !r.isValid).length,
      periodsDetected: detectedPeriods.length,
      duplicatePeriods: sequenceValidation.duplicates.length
    }
  };
}

/**
 * Validerar grundläggande filegenskaper
 * @param {File} file - Fil att validera
 * @returns {Object} - Valideringsresultat
 */
function validateBasicFileProperties(file) {
  const errors = [];

  // Kontrollera att det är en fil
  if (!file || typeof file !== 'object' || !file.name) {
    errors.push({
      type: ERROR_TYPES.FILE_FORMAT,
      message: 'Ogiltigt filobjekt',
      severity: 'error'
    });
    return { isValid: false, errors };
  }

  // Kontrollera filstorlek
  if (file.size === 0) {
    errors.push({
      type: ERROR_TYPES.FILE_FORMAT,
      message: 'Filen är tom',
      severity: 'error'
    });
  }

  if (file.size > VALIDATION_CONFIG.MAX_FILE_SIZE) {
    errors.push({
      type: ERROR_TYPES.FILE_FORMAT,
      message: `Filen är för stor: ${(file.size / 1024 / 1024).toFixed(2)}MB (max ${VALIDATION_CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB)`,
      severity: 'error'
    });
  }

  // Kontrollera filtyp
  if (file.type && file.type !== 'text/csv' && file.type !== 'application/csv') {
    errors.push({
      type: ERROR_TYPES.FILE_FORMAT,
      message: `Fel filtyp: ${file.type} (förväntat: text/csv)`,
      severity: 'warning'
    });
  }

  return {
    isValid: errors.filter(e => e.severity === 'error').length === 0,
    errors
  };
}

/**
 * Validerar filnamn och extraherar period
 * @param {File} file - Fil att validera
 * @returns {Object} - Valideringsresultat med period
 */
function validateFilenameAndExtractPeriod(file) {
  const errors = [];

  // Kontrollera filextension
  if (!file.name.toLowerCase().endsWith(VALIDATION_CONFIG.REQUIRED_FILE_EXTENSION)) {
    errors.push({
      type: ERROR_TYPES.FILENAME,
      message: `Fel filextension (förväntat: ${VALIDATION_CONFIG.REQUIRED_FILE_EXTENSION})`,
      severity: 'error'
    });
  }

  // Extrahera period från filnamn
  const period = extractPeriodFromFile(file, true); // Strict mode
  
  if (!period) {
    errors.push({
      type: ERROR_TYPES.FILENAME,
      message: `Filnamnet följer inte formatet IG_YYYY_MM.csv (t.ex. IG_2025_10.csv)`,
      severity: 'error'
    });
    
    return { isValid: false, errors, period: null };
  }

  // Validera extraherad period
  if (!isValidPeriod(period.year, period.month)) {
    errors.push({
      type: ERROR_TYPES.FILENAME,
      message: `Ogiltig period i filnamn: ${period.year}-${period.month}`,
      severity: 'error'
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    period
  };
}

/**
 * Kontrollerar om period redan finns i befintliga perioder
 * @param {Object} period - Period att kontrollera
 * @param {Array<Object>} existingPeriods - Befintliga perioder
 * @returns {Object} - Valideringsresultat
 */
function checkForPeriodDuplicate(period, existingPeriods) {
  const warnings = [];

  if (!period || !existingPeriods || existingPeriods.length === 0) {
    return { isValid: true, warnings };
  }

  const duplicate = existingPeriods.find(p => 
    p.year === period.year && p.month === period.month
  );

  if (duplicate) {
    warnings.push({
      type: ERROR_TYPES.PERIOD_CONFLICT,
      message: `Period ${period.year}-${period.month} finns redan i denna batch`,
      severity: 'warning',
      conflictingPeriod: duplicate
    });
  }

  return { isValid: true, warnings };
}

/**
 * Validerar CSV-innehåll
 * @param {string} csvContent - CSV-innehåll som string
 * @param {string} filename - Filnamn för felmeddelanden
 * @returns {Promise<Object>} - Valideringsresultat
 */
async function validateCSVContent(csvContent, filename) {
  const errors = [];
  const warnings = [];

  if (!csvContent || csvContent.trim().length === 0) {
    return {
      isValid: false,
      errors: [{
        type: ERROR_TYPES.CSV_STRUCTURE,
        message: 'CSV-filen är tom eller kunde inte läsas',
        severity: 'error'
      }],
      warnings: []
    };
  }

  try {
    // Parse CSV-innehåll med Papa Parse (importerat dynamiskt för att undvika cirkulära beroenden)
    const Papa = await import('papaparse');
    const parseResult = Papa.default.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      delimiter: ',',
      quoteChar: '"'
    });

    // Validera CSV-struktur
    const structureValidation = validateCSVStructure(parseResult, filename);
    if (!structureValidation.isValid) {
      errors.push(...structureValidation.errors);
    }
    warnings.push(...structureValidation.warnings);

    // Validera CSV-innehåll om strukturen är OK
    let contentValidation = { isValid: true, errors: [], warnings: [] };
    if (structureValidation.isValid && parseResult.data) {
      contentValidation = validateCSVDataContent(parseResult.data, filename);
      if (!contentValidation.isValid) {
        errors.push(...contentValidation.errors);
      }
      warnings.push(...contentValidation.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      csvInfo: {
        columns: parseResult.meta?.fields || [],
        rowCount: parseResult.data?.length || 0,
        parseErrors: parseResult.errors || []
      }
    };

  } catch (error) {
    return {
      isValid: false,
      errors: [{
        type: ERROR_TYPES.CSV_STRUCTURE,
        message: `Kunde inte parsa CSV: ${error.message}`,
        severity: 'error'
      }],
      warnings: []
    };
  }
}

/**
 * Validerar CSV-struktur (kolumner, headers)
 * @param {Object} parseResult - Papa Parse resultat
 * @param {string} filename - Filnamn för felmeddelanden
 * @returns {Object} - Valideringsresultat
 */
function validateCSVStructure(parseResult, filename) {
  const errors = [];
  const warnings = [];

  // Kontrollera att parsing lyckades
  if (!parseResult.meta || !parseResult.meta.fields) {
    errors.push({
      type: ERROR_TYPES.CSV_STRUCTURE,
      message: 'Kunde inte läsa CSV-kolumner',
      severity: 'error'
    });
    return { isValid: false, errors, warnings };
  }

  // Kontrollera antal kolumner
  const actualColumns = parseResult.meta.fields;
  if (actualColumns.length !== VALIDATION_CONFIG.REQUIRED_COLUMNS_COUNT) {
    errors.push({
      type: ERROR_TYPES.CSV_STRUCTURE,
      message: `Fel antal kolumner: ${actualColumns.length} (förväntat: ${VALIDATION_CONFIG.REQUIRED_COLUMNS_COUNT})`,
      severity: 'error'
    });
  }

  // Kontrollera kolumnnamn mot förväntade
  const normalizedActual = actualColumns.map(col => col.trim());
  const normalizedExpected = EXPECTED_COLUMNS.map(col => col.trim());
  
  const missingColumns = [];
  const extraColumns = [];

  for (let i = 0; i < Math.max(normalizedActual.length, normalizedExpected.length); i++) {
    const actual = normalizedActual[i];
    const expected = normalizedExpected[i];
    
    if (actual !== expected) {
      if (expected && !actual) {
        missingColumns.push(expected);
      } else if (actual && !expected) {
        extraColumns.push(actual);
      } else {
        missingColumns.push(expected);
        extraColumns.push(actual);
      }
    }
  }

  if (missingColumns.length > 0 || extraColumns.length > 0) {
    errors.push({
      type: ERROR_TYPES.CSV_STRUCTURE,
      message: `Felaktiga kolumnnamn. Förväntat: [${normalizedExpected.join(', ')}]. Hittade: [${normalizedActual.join(', ')}]`,
      severity: 'error',
      expected: normalizedExpected,
      actual: normalizedActual
    });
  }

  // Kontrollera antal rader
  const rowCount = parseResult.data?.length || 0;
  if (rowCount < VALIDATION_CONFIG.MIN_ROWS) {
    errors.push({
      type: ERROR_TYPES.CSV_STRUCTURE,
      message: `För få rader: ${rowCount} (minimum: ${VALIDATION_CONFIG.MIN_ROWS})`,
      severity: 'error'
    });
  }

  if (rowCount > VALIDATION_CONFIG.MAX_ROWS) {
    warnings.push({
      type: ERROR_TYPES.CSV_STRUCTURE,
      message: `Många rader: ${rowCount} (över ${VALIDATION_CONFIG.MAX_ROWS} kan påverka prestanda)`,
      severity: 'warning'
    });
  }

  // Kontrollera Papa Parse-fel
  if (parseResult.errors && parseResult.errors.length > 0) {
    warnings.push({
      type: ERROR_TYPES.CSV_STRUCTURE,
      message: `CSV-parsningsvarningar: ${parseResult.errors.length} problem hittades`,
      severity: 'warning',
      parseErrors: parseResult.errors
    });
  }

  return { isValid: errors.length === 0, errors, warnings };
}

/**
 * Validerar CSV-datainnehåll
 * @param {Array<Object>} csvData - Parsade CSV-rader
 * @param {string} filename - Filnamn för felmeddelanden
 * @returns {Object} - Valideringsresultat
 */
function validateCSVDataContent(csvData, filename) {
  const errors = [];
  const warnings = [];

  if (!csvData || csvData.length === 0) {
    errors.push({
      type: ERROR_TYPES.DATA_CONTENT,
      message: 'CSV-filen innehåller ingen data',
      severity: 'error'
    });
    return { isValid: false, errors, warnings };
  }

  let validRows = 0;
  const rowErrors = [];

  // Validera varje rad
  for (let i = 0; i < csvData.length; i++) {
    const row = csvData[i];
    const rowValidation = validateDataRow(row, i + 1);
    
    if (rowValidation.isValid) {
      validRows++;
    } else {
      rowErrors.push(...rowValidation.errors);
    }
    
    warnings.push(...rowValidation.warnings);
  }

  // Kontrollera att vi har tillräckligt med giltiga rader
  if (validRows === 0) {
    errors.push({
      type: ERROR_TYPES.DATA_CONTENT,
      message: 'Inga giltiga datarader hittades',
      severity: 'error'
    });
  } else if (validRows < csvData.length * 0.8) {
    warnings.push({
      type: ERROR_TYPES.DATA_CONTENT,
      message: `Endast ${validRows}/${csvData.length} rader är giltiga (mindre än 80%)`,
      severity: 'warning'
    });
  }

  // Lägg till rad-specifika fel som varningar (inte kritiska fel)
  if (rowErrors.length > 0 && rowErrors.length < csvData.length * 0.5) {
    warnings.push({
      type: ERROR_TYPES.DATA_CONTENT,
      message: `${rowErrors.length} rader har datafel men kan eventuellt processeras`,
      severity: 'warning',
      rowErrors: rowErrors.slice(0, 10) // Visa max 10 första felen
    });
  } else if (rowErrors.length >= csvData.length * 0.5) {
    errors.push({
      type: ERROR_TYPES.DATA_CONTENT,
      message: `För många datafel: ${rowErrors.length}/${csvData.length} rader har problem`,
      severity: 'error'
    });
  }

  return { isValid: errors.length === 0, errors, warnings };
}

/**
 * Validerar en enskild datarad
 * @param {Object} row - CSV-rad att validera
 * @param {number} rowNumber - Radnummer för felmeddelanden
 * @returns {Object} - Valideringsresultat
 */
function validateDataRow(row, rowNumber) {
  const errors = [];
  const warnings = [];

  // Kontrollera obligatoriska fält
  if (!row.Account || row.Account.trim() === '') {
    errors.push({
      type: ERROR_TYPES.DATA_CONTENT,
      message: `Rad ${rowNumber}: Saknar Account (användarnamn)`,
      severity: 'error'
    });
  }

  if (!row['IG ID'] || row['IG ID'].toString().trim() === '') {
    errors.push({
      type: ERROR_TYPES.DATA_CONTENT,
      message: `Rad ${rowNumber}: Saknar IG ID`,
      severity: 'error'
    });
  }

  // Kontrollera numeriska fält
  const numericFields = ['Reach', 'Views', 'Followers', 'Status', 'Comment'];
  
  for (const field of numericFields) {
    const value = row[field];
    
    if (value !== undefined && value !== '' && value !== null) {
      const numValue = parseFloat(String(value).replace(/,/g, ''));
      
      if (isNaN(numValue)) {
        warnings.push({
          type: ERROR_TYPES.DATA_CONTENT,
          message: `Rad ${rowNumber}: ${field} är inte numeriskt: "${value}"`,
          severity: 'warning'
        });
      } else if (numValue < 0) {
        warnings.push({
          type: ERROR_TYPES.DATA_CONTENT,
          message: `Rad ${rowNumber}: ${field} är negativt: ${numValue}`,
          severity: 'warning'
        });
      }
    }
  }

  return { isValid: errors.length === 0, errors, warnings };
}

/**
 * Läser filinnehåll som text
 * @param {File} file - Fil att läsa
 * @returns {Promise<string>} - Filinnehåll
 */
async function readFileContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      resolve(event.target.result);
    };
    
    reader.onerror = () => {
      reject(new Error(`Kunde inte läsa fil: ${file.name}`));
    };
    
    reader.readAsText(file, VALIDATION_CONFIG.REQUIRED_ENCODING);
  });
}

/**
 * Skapar en sammanfattning av valideringsresultat för UI
 * @param {Object} validationResult - Valideringsresultat från validateFile eller validateMultipleFiles
 * @returns {Object} - Formaterad sammanfattning
 */
export function formatValidationSummary(validationResult) {
  if (!validationResult) {
    return { message: 'Ingen valideringsdata', type: 'error' };
  }

  if (validationResult.fileResults) {
    // Flera filer
    const { summary } = validationResult;
    
    if (summary.invalidFiles === 0) {
      return {
        message: `✅ Alla ${summary.totalFiles} filer är giltiga`,
        type: 'success',
        details: `${summary.periodsDetected} perioder detekterade`
      };
    } else if (summary.validFiles === 0) {
      return {
        message: `❌ Inga giltiga filer (${summary.invalidFiles} fel)`,
        type: 'error',
        details: 'Kontrollera filformat och innehåll'
      };
    } else {
      return {
        message: `⚠️ ${summary.validFiles} giltiga, ${summary.invalidFiles} ogiltiga`,
        type: 'warning',
        details: `${summary.periodsDetected} perioder detekterade`
      };
    }
  } else {
    // Enskild fil
    if (validationResult.isValid) {
      const periodStr = validationResult.period 
        ? `Period: ${validationResult.period.year}-${String(validationResult.period.month).padStart(2, '0')}`
        : '';
      
      return {
        message: `✅ Filen är giltig`,
        type: 'success',
        details: periodStr
      };
    } else {
      return {
        message: `❌ Filen är ogiltig`,
        type: 'error',
        details: `${validationResult.errors.length} fel hittades`
      };
    }
  }
}
