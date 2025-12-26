/**
 * Reach Calculator
 * 
 * Hanterar korrekt beräkning av Reach som ALDRIG kan summeras över månader
 * eftersom det representerar unika personer per månad, inte kumulativa värden.
 */

/**
 * Lista över metrics som representerar unika personer per månad
 * Dessa kan ALDRIG summeras över tid
 */
export const NON_SUMMABLE_METRICS = ['reach'];

/**
 * Lista över metrics som kan summeras över tid
 */
export const SUMMABLE_METRICS = ['followers', 'views'];

/**
 * Kontrollerar om en metric kan summeras över månader
 * @param {string} metric - Metric att kontrollera
 * @returns {boolean} - True om metric kan summeras
 */
export function isMetricSummable(metric) {
  return SUMMABLE_METRICS.includes(metric);
}

/**
 * Kontrollerar om en metric representerar unika personer
 * @param {string} metric - Metric att kontrollera
 * @returns {boolean} - True om metric representerar unika personer
 */
export function isMetricUniquePersons(metric) {
  return NON_SUMMABLE_METRICS.includes(metric);
}

/**
 * Beräknar genomsnittlig reach över en period för ett konto
 * Detta är den ENDA korrekta sättet att aggregera reach över månader
 * @param {AccountTimeseries} accountTimeseries - Tidserie för ett konto
 * @returns {Object} - Reach-statistik
 */
export function calculateAverageReach(accountTimeseries) {
  if (!accountTimeseries) {
    throw new Error('calculateAverageReach kräver AccountTimeseries');
  }

  const monthlyData = accountTimeseries.getAllMonthlyData();
  if (monthlyData.length === 0) {
    return {
      averageReach: 0,
      minReach: 0,
      maxReach: 0,
      totalPeriods: 0,
      validPeriods: 0
    };
  }

  let totalReach = 0;
  let validCount = 0;
  let minReach = Infinity;
  let maxReach = -Infinity;

  for (const data of monthlyData) {
    const reach = data.metrics.reach;
    
    if (reach !== null && reach !== undefined && !isNaN(reach) && reach >= 0) {
      totalReach += reach;
      validCount++;
      minReach = Math.min(minReach, reach);
      maxReach = Math.max(maxReach, reach);
    }
  }

  // Hantera fall där ingen giltig data finns
  if (validCount === 0) {
    return {
      averageReach: 0,
      minReach: 0,
      maxReach: 0,
      totalPeriods: monthlyData.length,
      validPeriods: 0
    };
  }

  return {
    averageReach: Math.round(totalReach / validCount),
    minReach: minReach === Infinity ? 0 : minReach,
    maxReach: maxReach === -Infinity ? 0 : maxReach,
    totalPeriods: monthlyData.length,
    validPeriods: validCount
  };
}

/**
 * Beräknar engagement rate (reach / followers) för varje månad
 * @param {AccountTimeseries} accountTimeseries - Tidserie för ett konto
 * @returns {Array<Object>} - Månadsvis engagement rate
 */
export function calculateMonthlyEngagementRates(accountTimeseries) {
  if (!accountTimeseries) {
    throw new Error('calculateMonthlyEngagementRates kräver AccountTimeseries');
  }

  const monthlyData = accountTimeseries.getAllMonthlyData();
  const engagementRates = [];

  for (const data of monthlyData) {
    const reach = data.metrics.reach;
    const followers = data.metrics.followers;
    
    let engagementRate = null;
    if (followers && followers > 0 && reach !== null && reach !== undefined) {
      engagementRate = (reach / followers) * 100;
    }

    engagementRates.push({
      period: data.getPeriod(),
      reach,
      followers,
      engagementRate: engagementRate ? Math.round(engagementRate * 100) / 100 : null, // 2 decimaler
      username: data.account.username,
      accountId: data.account.accountId
    });
  }

  return engagementRates;
}

/**
 * Beräknar genomsnittlig engagement rate över en period
 * @param {AccountTimeseries} accountTimeseries - Tidserie för ett konto
 * @returns {Object} - Genomsnittlig engagement rate statistik
 */
export function calculateAverageEngagementRate(accountTimeseries) {
  if (!accountTimeseries) {
    throw new Error('calculateAverageEngagementRate kräver AccountTimeseries');
  }

  const monthlyRates = calculateMonthlyEngagementRates(accountTimeseries);
  const validRates = monthlyRates.filter(rate => rate.engagementRate !== null);

  if (validRates.length === 0) {
    return {
      averageEngagementRate: 0,
      minEngagementRate: 0,
      maxEngagementRate: 0,
      validPeriods: 0,
      totalPeriods: monthlyRates.length
    };
  }

  const rates = validRates.map(rate => rate.engagementRate);
  const avgRate = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
  const minRate = Math.min(...rates);
  const maxRate = Math.max(...rates);

  return {
    averageEngagementRate: Math.round(avgRate * 100) / 100, // 2 decimaler
    minEngagementRate: Math.round(minRate * 100) / 100,
    maxEngagementRate: Math.round(maxRate * 100) / 100,
    validPeriods: validRates.length,
    totalPeriods: monthlyRates.length,
    monthlyRates: validRates
  };
}

/**
 * Jämför reach-prestanda mellan månader för ett konto
 * @param {AccountTimeseries} accountTimeseries - Tidserie för ett konto
 * @returns {Array<Object>} - Månad-för-månad reach-jämförelse
 */
export function compareMonthlyReach(accountTimeseries) {
  if (!accountTimeseries) {
    throw new Error('compareMonthlyReach kräver AccountTimeseries');
  }

  const monthlyData = accountTimeseries.getAllMonthlyData();
  if (monthlyData.length < 2) {
    return []; // Behöver minst 2 månader för jämförelse
  }

  const comparisons = [];

  for (let i = 1; i < monthlyData.length; i++) {
    const current = monthlyData[i];
    const previous = monthlyData[i - 1];

    const currentReach = current.metrics.reach || 0;
    const previousReach = previous.metrics.reach || 0;

    let percentageChange = null;
    if (previousReach > 0) {
      percentageChange = ((currentReach - previousReach) / previousReach) * 100;
    } else if (currentReach > 0) {
      percentageChange = 100; // 100% ökning från 0
    }

    comparisons.push({
      currentPeriod: current.getPeriod(),
      previousPeriod: previous.getPeriod(),
      currentReach,
      previousReach,
      absoluteChange: currentReach - previousReach,
      percentageChange: percentageChange ? Math.round(percentageChange * 100) / 100 : null,
      username: current.account.username,
      accountId: current.account.accountId
    });
  }

  return comparisons;
}

/**
 * Identifierar månader med exceptionellt hög eller låg reach
 * @param {AccountTimeseries} accountTimeseries - Tidserie för ett konto
 * @param {number} threshold - Tröskelvärde för vad som räknas som exceptionellt (standard 2 = 2 standardavvikelser)
 * @returns {Object} - Exceptionella månader
 */
export function findReachAnomalies(accountTimeseries, threshold = 2) {
  if (!accountTimeseries) {
    throw new Error('findReachAnomalies kräver AccountTimeseries');
  }

  const monthlyData = accountTimeseries.getAllMonthlyData();
  if (monthlyData.length < 3) {
    return { outliers: [], statistics: null }; // Behöver minst 3 datapunkter
  }

  // Samla alla reach-värden
  const reachValues = monthlyData
    .map(data => data.metrics.reach)
    .filter(reach => reach !== null && reach !== undefined && !isNaN(reach));

  if (reachValues.length < 3) {
    return { outliers: [], statistics: null };
  }

  // Beräkna genomsnitt och standardavvikelse
  const mean = reachValues.reduce((sum, val) => sum + val, 0) / reachValues.length;
  const variance = reachValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / reachValues.length;
  const stdDev = Math.sqrt(variance);

  const lowerBound = mean - (threshold * stdDev);
  const upperBound = mean + (threshold * stdDev);

  // Hitta outliers
  const outliers = [];
  for (const data of monthlyData) {
    const reach = data.metrics.reach;
    if (reach !== null && reach !== undefined && !isNaN(reach)) {
      if (reach < lowerBound || reach > upperBound) {
        outliers.push({
          period: data.getPeriod(),
          reach,
          deviation: reach < lowerBound ? 'låg' : 'hög',
          deviationFromMean: reach - mean,
          standardDeviations: Math.abs((reach - mean) / stdDev),
          username: data.account.username,
          accountId: data.account.accountId
        });
      }
    }
  }

  return {
    outliers,
    statistics: {
      mean: Math.round(mean),
      standardDeviation: Math.round(stdDev),
      lowerBound: Math.round(lowerBound),
      upperBound: Math.round(upperBound),
      threshold,
      sampleSize: reachValues.length
    }
  };
}

/**
 * Validerar att en operation är tillåten för given metric
 * Kastar fel om man försöker summera reach
 * @param {string} operation - Operation som ska utföras ('sum', 'average', etc.)
 * @param {string} metric - Metric som operationen ska utföras på
 * @throws {Error} - Om operationen inte är tillåten för denna metric
 */
export function validateMetricOperation(operation, metric) {
  if (operation === 'sum' || operation === 'total') {
    if (NON_SUMMABLE_METRICS.includes(metric)) {
      throw new Error(
        `KRITISKT FEL: ${metric} representerar unika personer per månad och kan ALDRIG summeras över tid. ` +
        `Använd genomsnitt istället. Tillåtna operationer för ${metric}: average, min, max`
      );
    }
  }

  if ((operation === 'average' || operation === 'mean') && SUMMABLE_METRICS.includes(metric)) {
    console.warn(
      `VARNING: Du beräknar genomsnitt för ${metric} som normalt summeras över tid. ` +
      `Kontrollera att detta är det avsedda beteendet.`
    );
  }
}

/**
 * Säker aggregering av en metric med automatisk validering
 * @param {AccountTimeseries} accountTimeseries - Tidserie för ett konto
 * @param {string} metric - Metric att aggregera
 * @param {string} operation - Operation att utföra ('sum', 'average', 'min', 'max')
 * @returns {number} - Aggregerat värde
 */
export function safeMetricAggregation(accountTimeseries, metric, operation) {
  if (!accountTimeseries || !metric || !operation) {
    throw new Error('safeMetricAggregation kräver AccountTimeseries, metric och operation');
  }

  // Validera operation mot metric-typ
  validateMetricOperation(operation, metric);

  const monthlyData = accountTimeseries.getAllMonthlyData();
  if (monthlyData.length === 0) {
    return 0;
  }

  const values = monthlyData
    .map(data => data.metrics[metric])
    .filter(value => value !== null && value !== undefined && !isNaN(value) && value >= 0);

  if (values.length === 0) {
    return 0;
  }

  switch (operation.toLowerCase()) {
    case 'sum':
    case 'total':
      return values.reduce((sum, val) => sum + val, 0);
    
    case 'average':
    case 'mean':
      return Math.round(values.reduce((sum, val) => sum + val, 0) / values.length);
    
    case 'min':
    case 'minimum':
      return Math.min(...values);
    
    case 'max':
    case 'maximum':
      return Math.max(...values);
    
    default:
      throw new Error(`Okänd operation: ${operation}. Tillåtna: sum, average, min, max`);
  }
}
