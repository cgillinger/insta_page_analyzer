/**
 * Metric Categorizer
 * 
 * Definierar och kategoriserar Instagram API metrics enligt deras egenskaper
 * Säkerställer korrekt hantering av summerbara vs icke-summerbara metrics
 */

// Import från reach_calculator för konsistens
import { SUMMABLE_METRICS, NON_SUMMABLE_METRICS } from '../services/reach_calculator.js';

/**
 * Komplett definition av alla Instagram API metrics med egenskaper
 */
export const METRIC_DEFINITIONS = {
  // ICKE-SUMMERBARA METRICS (Unika personer per månad)
  reach: {
    category: 'unique_persons',
    displayName: 'Räckvidd',
    description: 'Antal unika personer som såg innehållet under månaden',
    unit: 'personer',
    canSumAcrossTime: false,
    canSumAcrossPages: false, // Överlappning mellan konton okänd
    preferredAggregation: 'average',
    validAggregations: ['average', 'min', 'max'],
    dataType: 'integer',
    csvColumn: 'Reach',
    icon: '👁️',
    color: '#E1306C', // Instagram rosa
    warningNote: 'Kan ALDRIG summeras över månader - representerar unika personer'
  },

  // SUMMERBARA METRICS (Räknbara händelser/metrics)
  followers: {
    category: 'countable_metric',
    displayName: 'Följare',
    description: 'Antal följare vid månadens slut',
    unit: 'följare',
    canSumAcrossTime: true,
    canSumAcrossPages: true,
    preferredAggregation: 'sum',
    validAggregations: ['sum', 'average', 'min', 'max'],
    dataType: 'integer',
    csvColumn: 'Followers',
    icon: '👥',
    color: '#833AB4', // Instagram lila
    warningNote: null
  },

  views: {
    category: 'countable_events',
    displayName: 'Visningar',
    description: 'Antal visningar av innehåll under månaden',
    unit: 'visningar',
    canSumAcrossTime: true,
    canSumAcrossPages: true,
    preferredAggregation: 'sum',
    validAggregations: ['sum', 'average', 'min', 'max'],
    dataType: 'integer',
    csvColumn: 'Views',
    icon: '📺',
    color: '#F56040', // Instagram orange
    warningNote: null
  }
};

/**
 * Kategorier av metrics med beskrivningar
 */
export const METRIC_CATEGORIES = {
  unique_persons: {
    name: 'Unika personer',
    description: 'Metrics som representerar unika personer per månad och kan aldrig summeras över tid',
    aggregationRules: {
      acrossTime: 'average', // Endast genomsnitt över månader
      acrossPages: 'average', // Genomsnitt över konton (överlappning okänd)
      forbidden: ['sum', 'total']
    },
    color: '#E1306C',
    icon: '👥',
    warningMessage: 'Dessa metrics kan ALDRIG summeras över månader eftersom de representerar unika personer'
  },
  
  countable_metric: {
    name: 'Räknbara metrics',
    description: 'Metrics som representerar snapshot-värden och kan summeras',
    aggregationRules: {
      acrossTime: 'sum',
      acrossPages: 'sum',
      allowed: ['sum', 'total', 'average', 'min', 'max']
    },
    color: '#833AB4',
    icon: '📊',
    warningMessage: null
  },
  
  countable_events: {
    name: 'Räknbara händelser',
    description: 'Metrics som representerar räknbara händelser och kan summeras över tid och konton',
    aggregationRules: {
      acrossTime: 'sum',
      acrossPages: 'sum',
      allowed: ['sum', 'total', 'average', 'min', 'max']
    },
    color: '#F56040',
    icon: '🔢',
    warningMessage: null
  }
};

/**
 * Hämtar metric-definition för ett specifikt metric
 * @param {string} metricKey - Metric-nyckel (t.ex. 'reach', 'followers')
 * @returns {Object|null} - Metric-definition eller null om inte hittat
 */
export function getMetricDefinition(metricKey) {
  return METRIC_DEFINITIONS[metricKey] || null;
}

/**
 * Kontrollerar om en metric kan summeras över tid
 * @param {string} metricKey - Metric att kontrollera
 * @returns {boolean} - True om metric kan summeras över månader
 */
export function canSumAcrossTime(metricKey) {
  const definition = getMetricDefinition(metricKey);
  return definition ? definition.canSumAcrossTime : false;
}

/**
 * Kontrollerar om en metric kan summeras över konton
 * @param {string} metricKey - Metric att kontrollera
 * @returns {boolean} - True om metric kan summeras över konton
 */
export function canSumAcrossPages(metricKey) {
  const definition = getMetricDefinition(metricKey);
  return definition ? definition.canSumAcrossPages : false;
}

/**
 * Hämtar föredragen aggregeringsmetod för en metric
 * @param {string} metricKey - Metric att kontrollera
 * @returns {string} - Föredragen aggregering ('sum', 'average', etc.)
 */
export function getPreferredAggregation(metricKey) {
  const definition = getMetricDefinition(metricKey);
  return definition ? definition.preferredAggregation : 'average';
}

/**
 * Hämtar alla giltiga aggregeringsmetoder för en metric
 * @param {string} metricKey - Metric att kontrollera
 * @returns {Array<string>} - Lista med giltiga aggregeringar
 */
export function getValidAggregations(metricKey) {
  const definition = getMetricDefinition(metricKey);
  return definition ? definition.validAggregations : ['average'];
}

/**
 * Kontrollerar om en aggregeringsmetod är giltig för en metric
 * @param {string} metricKey - Metric att kontrollera
 * @param {string} aggregation - Aggregeringsmetod att validera
 * @returns {boolean} - True om aggregeringen är giltig
 */
export function isValidAggregation(metricKey, aggregation) {
  const validAggregations = getValidAggregations(metricKey);
  return validAggregations.includes(aggregation);
}

/**
 * Hämtar alla metrics för en specifik kategori
 * @param {string} category - Kategori att filtrera på
 * @returns {Array<string>} - Lista med metric-nycklar i kategorin
 */
export function getMetricsByCategory(category) {
  return Object.keys(METRIC_DEFINITIONS).filter(key => 
    METRIC_DEFINITIONS[key].category === category
  );
}

/**
 * Hämtar alla summerbara metrics
 * @returns {Array<string>} - Lista med summerbara metric-nycklar
 */
export function getSummerableMetrics() {
  return Object.keys(METRIC_DEFINITIONS).filter(key => 
    METRIC_DEFINITIONS[key].canSumAcrossTime
  );
}

/**
 * Hämtar alla icke-summerbara metrics
 * @returns {Array<string>} - Lista med icke-summerbara metric-nycklar
 */
export function getNonSummerableMetrics() {
  return Object.keys(METRIC_DEFINITIONS).filter(key => 
    !METRIC_DEFINITIONS[key].canSumAcrossTime
  );
}

/**
 * Validerar att en operation är tillåten för given metric
 * Kastar fel om man försöker summera reach
 * @param {string} operation - Operation som ska utföras
 * @param {string} metricKey - Metric som operationen ska utföras på
 * @returns {Object} - Valideringsresultat med feedback
 */
export function validateMetricOperation(operation, metricKey) {
  const definition = getMetricDefinition(metricKey);
  
  if (!definition) {
    return {
      isValid: false,
      error: `Okänt metric: ${metricKey}`,
      suggestion: null
    };
  }

  const isValidOp = isValidAggregation(metricKey, operation);
  
  if (!isValidOp) {
    const validOps = getValidAggregations(metricKey);
    const preferred = getPreferredAggregation(metricKey);
    
    return {
      isValid: false,
      error: `Operation '${operation}' är inte giltig för ${definition.displayName}`,
      suggestion: `Använd istället: ${preferred} (eller: ${validOps.join(', ')})`,
      warningNote: definition.warningNote
    };
  }

  // Specialkontroll för summering över tid
  if ((operation === 'sum' || operation === 'total')) {
    if (!definition.canSumAcrossTime) {
      return {
        isValid: false,
        error: `${definition.displayName} kan ALDRIG summeras över månader`,
        suggestion: `Använd genomsnitt istället: ${definition.preferredAggregation}`,
        warningNote: definition.warningNote
      };
    }
  }

  return {
    isValid: true,
    error: null,
    suggestion: null
  };
}

/**
 * Formaterar metric-värde för visning enligt dess typ
 * @param {string} metricKey - Metric-nyckel
 * @param {number} value - Värde att formatera
 * @returns {string} - Formaterat värde
 */
export function formatMetricValue(metricKey, value) {
  const definition = getMetricDefinition(metricKey);
  
  if (!definition || value === null || value === undefined) {
    return '-';
  }

  if (value === 0) {
    return '0';
  }

  // Formatera numeriska värden med tusentalsavgränsare
  if (typeof value === 'number' && definition.dataType === 'integer') {
    const formatted = new Intl.NumberFormat('sv-SE').format(Math.round(value));
    return `${formatted} ${definition.unit}`;
  }

  return String(value);
}

/**
 * Skapar en komplett metrisk rapport med alla definitioner och regler
 * @returns {Object} - Komplett metrisk dokumentation
 */
export function getMetricsDocumentation() {
  return {
    overview: {
      totalMetrics: Object.keys(METRIC_DEFINITIONS).length,
      summerableCount: getSummerableMetrics().length,
      nonSummerableCount: getNonSummerableMetrics().length
    },
    categories: METRIC_CATEGORIES,
    metrics: METRIC_DEFINITIONS,
    rules: {
      summerbara: {
        metrics: getSummerableMetrics(),
        description: 'Dessa metrics kan summeras över både månader och konton',
        operations: ['sum', 'average', 'min', 'max']
      },
      ickeSummerbara: {
        metrics: getNonSummerableMetrics(),
        description: 'Dessa metrics kan ALDRIG summeras - endast genomsnitt är meningsfullt',
        operations: ['average', 'min', 'max'],
        warning: 'Summering över tid eller konton ger felaktiga resultat'
      }
    },
    csvMapping: Object.fromEntries(
      Object.entries(METRIC_DEFINITIONS).map(([key, def]) => [def.csvColumn, key])
    )
  };
}

/**
 * Validerar konsistens med reach_calculator.js definitioner
 * @returns {Object} - Konsistensrapport
 */
export function validateConsistencyWithReachCalculator() {
  const errors = [];
  const warnings = [];
  
  // Kontrollera att våra summerbara metrics matchar reach_calculator.js
  const ourSummerable = getSummerableMetrics();
  const reachCalcSummerable = SUMMABLE_METRICS;
  
  const missingSummerable = reachCalcSummerable.filter(m => !ourSummerable.includes(m));
  const extraSummerable = ourSummerable.filter(m => !reachCalcSummerable.includes(m));
  
  if (missingSummerable.length > 0) {
    errors.push(`Saknade summerbara metrics: ${missingSummerable.join(', ')}`);
  }
  
  if (extraSummerable.length > 0) {
    errors.push(`Extra summerbara metrics: ${extraSummerable.join(', ')}`);
  }
  
  // Kontrollera icke-summerbara metrics
  const ourNonSummerable = getNonSummerableMetrics();
  const reachCalcNonSummerable = NON_SUMMABLE_METRICS;
  
  const missingNonSummerable = reachCalcNonSummerable.filter(m => !ourNonSummerable.includes(m));
  const extraNonSummerable = ourNonSummerable.filter(m => !reachCalcNonSummerable.includes(m));
  
  if (missingNonSummerable.length > 0) {
    errors.push(`Saknade icke-summerbara metrics: ${missingNonSummerable.join(', ')}`);
  }
  
  if (extraNonSummerable.length > 0) {
    errors.push(`Extra icke-summerbara metrics: ${extraNonSummerable.join(', ')}`);
  }
  
  return {
    isConsistent: errors.length === 0,
    errors,
    warnings
  };
}

// Validera konsistens vid modul-load
const consistencyCheck = validateConsistencyWithReachCalculator();
if (!consistencyCheck.isConsistent) {
  console.error('KRITISK: metric_categorizer.js är inte konsistent med reach_calculator.js:', consistencyCheck.errors);
}
