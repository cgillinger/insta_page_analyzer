/**
 * Aggregation Service
 * 
 * Hanterar korrekt aggregering av Instagram API data över månader och konton
 * Säkerställer att summerbara och icke-summerbara metrics behandlas korrekt
 */
import { calculateAverageReach, safeMetricAggregation, SUMMABLE_METRICS, NON_SUMMABLE_METRICS } from './reach_calculator.js';
import { calculateMetricTotal, calculateMetricAverage } from './timeseries_analytics.js';

/**
 * Aggregerar data för ett konto över en tidsperiod
 * @param {AccountTimeseries} accountTimeseries - Tidserie för ett konto
 * @param {Array<{year: number, month: number}>} periods - Perioder att inkludera (optional, alla om ej angiven)
 * @returns {Object} - Aggregerad data för kontot
 */
export function aggregateAccountData(accountTimeseries, periods = null) {
  if (!accountTimeseries) {
    throw new Error('aggregateAccountData kräver AccountTimeseries');
  }

  let monthlyData = accountTimeseries.getAllMonthlyData();
  
  // Filtrera på specifika perioder om angivet
  if (periods && periods.length > 0) {
    const periodKeys = new Set(periods.map(p => `${p.year}_${p.month}`));
    monthlyData = monthlyData.filter(data => {
      const key = `${data.year}_${data.month}`;
      return periodKeys.has(key);
    });
  }

  if (monthlyData.length === 0) {
    return createEmptyAggregation(accountTimeseries.account);
  }

  // Beräkna aggregerade värden för alla metrics
  const aggregated = {
    account: {
      username: accountTimeseries.account.username,
      accountId: accountTimeseries.account.accountId,
      displayName: accountTimeseries.account.displayName
    },
    periods: {
      total: monthlyData.length,
      first: monthlyData[0].getPeriod(),
      last: monthlyData[monthlyData.length - 1].getPeriod(),
      included: monthlyData.map(data => data.getPeriod())
    },
    metrics: {}
  };

  // Aggregera varje metric korrekt
  const allMetrics = ['reach', 'followers', 'views'];
  
  for (const metric of allMetrics) {
    if (NON_SUMMABLE_METRICS.includes(metric)) {
      // För icke-summerbara metrics: beräkna genomsnitt, min, max
      aggregated.metrics[metric] = {
        type: 'average',
        average: safeMetricAggregation(accountTimeseries, metric, 'average'),
        min: safeMetricAggregation(accountTimeseries, metric, 'min'),
        max: safeMetricAggregation(accountTimeseries, metric, 'max'),
        note: 'Genomsnitt - kan ej summeras över månader (unika personer)'
      };
    } else {
      // För summerbara metrics: beräkna total och genomsnitt
      aggregated.metrics[metric] = {
        type: 'total',
        total: safeMetricAggregation(accountTimeseries, metric, 'sum'),
        average: safeMetricAggregation(accountTimeseries, metric, 'average'),
        note: 'Total - kan summeras över månader'
      };
    }
  }

  return aggregated;
}

/**
 * Aggregerar data för flera konton för en specifik period
 * @param {TimeseriesDataset} dataset - Dataset med alla konton
 * @param {number} year - År
 * @param {number} month - Månad
 * @returns {Array<Object>} - Aggregerad data för alla konton i perioden
 */
export function aggregateMultipleAccountsPeriod(dataset, year, month) {
  if (!dataset) {
    throw new Error('aggregateMultipleAccountsPeriod kräver TimeseriesDataset');
  }

  const periodData = dataset.getDataForPeriod(year, month);
  if (periodData.length === 0) {
    return [];
  }

  return periodData.map(monthlyData => ({
    account: {
      username: monthlyData.account.username,
      accountId: monthlyData.account.accountId,
      displayName: monthlyData.account.displayName
    },
    period: {
      year: monthlyData.year,
      month: monthlyData.month
    },
    metrics: {
      reach: {
        value: monthlyData.metrics.reach,
        type: 'unique_persons',
        note: 'Unika personer för denna månad'
      },
      followers: {
        value: monthlyData.metrics.followers,
        type: 'countable_metric',
        note: 'Antal followers för denna månad'
      },
      views: {
        value: monthlyData.metrics.views,
        type: 'countable_events',
        note: 'Antal views för denna månad'
      }
    }
  }));
}

/**
 * Beräknar kombinerad statistik över alla konton för en period
 * @param {TimeseriesDataset} dataset - Dataset med alla konton
 * @param {number} year - År
 * @param {number} month - Månad
 * @returns {Object} - Kombinerad statistik för perioden
 */
export function calculatePeriodSummary(dataset, year, month) {
  if (!dataset) {
    throw new Error('calculatePeriodSummary kräver TimeseriesDataset');
  }

  const periodData = dataset.getDataForPeriod(year, month);
  if (periodData.length === 0) {
    return {
      period: { year, month },
      totalAccounts: 0,
      metrics: {}
    };
  }

  const summary = {
    period: { year, month },
    totalAccounts: periodData.length,
    metrics: {}
  };

  const allMetrics = ['reach', 'followers', 'views'];
  
  for (const metric of allMetrics) {
    const values = periodData
      .map(data => data.metrics[metric])
      .filter(value => value !== null && value !== undefined && !isNaN(value) && value >= 0);

    if (values.length === 0) {
      summary.metrics[metric] = {
        total: 0,
        average: 0,
        min: 0,
        max: 0,
        validAccounts: 0,
        type: NON_SUMMABLE_METRICS.includes(metric) ? 'unique_persons' : 'countable'
      };
      continue;
    }

    if (NON_SUMMABLE_METRICS.includes(metric)) {
      // För reach: endast genomsnitt är meningsfullt över konton
      summary.metrics[metric] = {
        average: Math.round(values.reduce((sum, val) => sum + val, 0) / values.length),
        min: Math.min(...values),
        max: Math.max(...values),
        validAccounts: values.length,
        type: 'unique_persons',
        note: 'Genomsnitt över konton - total reach kan inte beräknas (överlappning okänd)'
      };
    } else {
      // För summerbara metrics: både total och genomsnitt
      const total = values.reduce((sum, val) => sum + val, 0);
      summary.metrics[metric] = {
        total,
        average: Math.round(total / values.length),
        min: Math.min(...values),
        max: Math.max(...values),
        validAccounts: values.length,
        type: 'countable'
      };
    }
  }

  return summary;
}

/**
 * Jämför prestanda mellan olika perioder över alla konton
 * @param {TimeseriesDataset} dataset - Dataset med alla konton
 * @param {Array<{year: number, month: number}>} periods - Perioder att jämföra
 * @returns {Array<Object>} - Jämförelse mellan perioder
 */
export function comparePeriods(dataset, periods) {
  if (!dataset || !periods || periods.length < 2) {
    throw new Error('comparePeriods kräver TimeseriesDataset och minst 2 perioder');
  }

  const periodSummaries = periods.map(period => 
    calculatePeriodSummary(dataset, period.year, period.month)
  );

  const comparisons = [];

  for (let i = 1; i < periodSummaries.length; i++) {
    const current = periodSummaries[i];
    const previous = periodSummaries[i - 1];

    const comparison = {
      currentPeriod: current.period,
      previousPeriod: previous.period,
      accountCountChange: current.totalAccounts - previous.totalAccounts,
      metrics: {}
    };

    const allMetrics = ['reach', 'followers', 'views'];

    for (const metric of allMetrics) {
      const currentMetric = current.metrics[metric];
      const previousMetric = previous.metrics[metric];

      if (NON_SUMMABLE_METRICS.includes(metric)) {
        // Jämför genomsnitt för reach
        const currentVal = currentMetric.average;
        const previousVal = previousMetric.average;
        
        comparison.metrics[metric] = {
          currentAverage: currentVal,
          previousAverage: previousVal,
          absoluteChange: currentVal - previousVal,
          percentageChange: previousVal > 0 ? ((currentVal - previousVal) / previousVal) * 100 : null,
          type: 'average_comparison'
        };
      } else {
        // Jämför totaler för summerbara metrics
        const currentVal = currentMetric.total;
        const previousVal = previousMetric.total;
        
        comparison.metrics[metric] = {
          currentTotal: currentVal,
          previousTotal: previousVal,
          absoluteChange: currentVal - previousVal,
          percentageChange: previousVal > 0 ? ((currentVal - previousVal) / previousVal) * 100 : null,
          type: 'total_comparison'
        };
      }
    }

    comparisons.push(comparison);
  }

  return comparisons;
}

/**
 * Identifierar topppresterande konton för en specifik metric och period
 * @param {TimeseriesDataset} dataset - Dataset med alla konton
 * @param {number} year - År
 * @param {number} month - Månad
 * @param {string} metric - Metric att rangordna efter
 * @param {number} topCount - Antal top-performers att returnera (default 5)
 * @returns {Array<Object>} - Rankad lista med topppresterare
 */
export function getTopPerformers(dataset, year, month, metric, topCount = 5) {
  if (!dataset || !metric) {
    throw new Error('getTopPerformers kräver TimeseriesDataset och metric');
  }

  const periodData = dataset.getDataForPeriod(year, month);
  if (periodData.length === 0) {
    return [];
  }

  // Sortera efter metric-värde (högst först)
  const sorted = periodData
    .filter(data => {
      const value = data.metrics[metric];
      return value !== null && value !== undefined && !isNaN(value) && value >= 0;
    })
    .sort((a, b) => b.metrics[metric] - a.metrics[metric])
    .slice(0, topCount);

  return sorted.map((data, index) => ({
    rank: index + 1,
    account: {
      username: data.account.username,
      accountId: data.account.accountId,
      displayName: data.account.displayName
    },
    period: { year, month },
    metric,
    value: data.metrics[metric],
    allMetrics: data.metrics
  }));
}

/**
 * Beräknar marknadsandel för varje konto för summerbara metrics
 * @param {TimeseriesDataset} dataset - Dataset med alla konton
 * @param {number} year - År
 * @param {number} month - Månad
 * @param {string} metric - Metric att beräkna marknadsandel för (måste vara summerbar)
 * @returns {Array<Object>} - Marknadsandel per konto
 */
export function calculateMarketShare(dataset, year, month, metric) {
  if (!dataset || !metric) {
    throw new Error('calculateMarketShare kräver TimeseriesDataset och metric');
  }

  if (NON_SUMMABLE_METRICS.includes(metric)) {
    throw new Error(`Marknadsandel kan inte beräknas för ${metric} eftersom det representerar unika personer som kan överlappa mellan konton`);
  }

  const periodData = dataset.getDataForPeriod(year, month);
  if (periodData.length === 0) {
    return [];
  }

  // Beräkna total för alla konton
  const validData = periodData.filter(data => {
    const value = data.metrics[metric];
    return value !== null && value !== undefined && !isNaN(value) && value >= 0;
  });

  if (validData.length === 0) {
    return [];
  }

  const totalMarket = validData.reduce((sum, data) => sum + data.metrics[metric], 0);

  if (totalMarket === 0) {
    return [];
  }

  return validData
    .map(data => ({
      account: {
        username: data.account.username,
        accountId: data.account.accountId,
        displayName: data.account.displayName
      },
      period: { year, month },
      metric,
      value: data.metrics[metric],
      marketShare: Math.round((data.metrics[metric] / totalMarket) * 10000) / 100, // 2 decimaler
      totalMarket
    }))
    .sort((a, b) => b.marketShare - a.marketShare);
}

/**
 * Skapar tom aggregering för ett konto utan data
 * @param {InstagramAccount} account - Konto att skapa tom aggregering för
 * @returns {Object} - Tom aggregering
 */
function createEmptyAggregation(account) {
  const allMetrics = ['reach', 'followers', 'views'];
  const metrics = {};

  for (const metric of allMetrics) {
    if (NON_SUMMABLE_METRICS.includes(metric)) {
      metrics[metric] = {
        type: 'average',
        average: 0,
        min: 0,
        max: 0,
        note: 'Inga data tillgängliga'
      };
    } else {
      metrics[metric] = {
        type: 'total',
        total: 0,
        average: 0,
        note: 'Inga data tillgängliga'
      };
    }
  }

  return {
    account: {
      username: account.username,
      accountId: account.accountId,
      displayName: account.displayName
    },
    periods: {
      total: 0,
      first: null,
      last: null,
      included: []
    },
    metrics
  };
}

/**
 * Validerar aggregeringsparametrar
 * @param {Object} params - Parametrar att validera
 * @returns {Object} - Valideringsresultat
 */
export function validateAggregationParams(params) {
  const errors = [];
  const warnings = [];

  if (!params.dataset) {
    errors.push('Dataset krävs för aggregering');
  }

  if (params.periods && !Array.isArray(params.periods)) {
    errors.push('Periods måste vara en array');
  }

  if (params.metric && NON_SUMMABLE_METRICS.includes(params.metric) && params.operation === 'sum') {
    errors.push(`Metric '${params.metric}' kan inte summeras över månader - använd genomsnitt istället`);
  }

  if (params.periods && params.periods.length === 0) {
    warnings.push('Tom periods-array angiven');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
