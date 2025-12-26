/**
 * Timeseries Analytics
 * 
 * Grundläggande analysverktyg och trend-beräkningar för Instagram API tidserie-data
 * Hanterar korrekt beräkning av trends med hänsyn till summerbara vs icke-summerbara metrics
 */

/**
 * Beräknar procentuell förändring mellan två värden
 * @param {number} currentValue - Nuvarande värde
 * @param {number} previousValue - Föregående värde
 * @returns {number|null} - Procentuell förändring eller null om beräkning inte möjlig
 */
export function calculatePercentageChange(currentValue, previousValue) {
  if (previousValue === 0 || previousValue === null || previousValue === undefined) {
    return currentValue > 0 ? 100 : 0; // 100% ökning från 0, annars ingen förändring
  }
  
  if (currentValue === null || currentValue === undefined) {
    return null;
  }

  return ((currentValue - previousValue) / previousValue) * 100;
}

/**
 * Beräknar månad-för-månad trend för ett konto
 * @param {AccountTimeseries} accountTimeseries - Tidserie för ett konto
 * @param {string} metric - Metric att analysera
 * @returns {Array<Object>} - Lista med trend-data
 */
export function calculateMonthToMonthTrend(accountTimeseries, metric) {
  if (!accountTimeseries || !metric) {
    throw new Error('calculateMonthToMonthTrend kräver AccountTimeseries och metric');
  }

  const monthlyData = accountTimeseries.getAllMonthlyData();
  if (monthlyData.length < 2) {
    return []; // Behöver minst 2 månader för att beräkna trend
  }

  const trendData = [];

  for (let i = 1; i < monthlyData.length; i++) {
    const current = monthlyData[i];
    const previous = monthlyData[i - 1];

    const currentValue = current.metrics[metric];
    const previousValue = previous.metrics[metric];
    const percentageChange = calculatePercentageChange(currentValue, previousValue);

    trendData.push({
      period: current.getPeriod(),
      previousPeriod: previous.getPeriod(),
      currentValue,
      previousValue,
      absoluteChange: currentValue - previousValue,
      percentageChange,
      metric,
      username: current.account.username,
      accountId: current.account.accountId
    });
  }

  return trendData;
}

/**
 * Beräknar genomsnittlig månadsförändring över en period
 * @param {Array<Object>} trendData - Trend-data från calculateMonthToMonthTrend
 * @returns {Object} - Genomsnittlig trend-statistik
 */
export function calculateAverageTrend(trendData) {
  if (!trendData || trendData.length === 0) {
    return {
      averageAbsoluteChange: 0,
      averagePercentageChange: 0,
      totalPeriods: 0,
      positiveMonths: 0,
      negativeMonths: 0,
      stableMonths: 0
    };
  }

  let totalAbsolute = 0;
  let totalPercentage = 0;
  let validPercentageCount = 0;
  let positiveMonths = 0;
  let negativeMonths = 0;
  let stableMonths = 0;

  for (const trend of trendData) {
    totalAbsolute += trend.absoluteChange;

    if (trend.percentageChange !== null && !isNaN(trend.percentageChange)) {
      totalPercentage += trend.percentageChange;
      validPercentageCount++;

      if (trend.percentageChange > 1) {
        positiveMonths++;
      } else if (trend.percentageChange < -1) {
        negativeMonths++;
      } else {
        stableMonths++;
      }
    }
  }

  return {
    averageAbsoluteChange: totalAbsolute / trendData.length,
    averagePercentageChange: validPercentageCount > 0 ? totalPercentage / validPercentageCount : 0,
    totalPeriods: trendData.length,
    positiveMonths,
    negativeMonths,
    stableMonths
  };
}

/**
 * Identifierar bäst och sämst presterande månader för ett konto
 * @param {AccountTimeseries} accountTimeseries - Tidserie för ett konto
 * @param {string} metric - Metric att analysera
 * @returns {Object} - Bästa och sämsta prestationer
 */
export function findPerformanceExtremes(accountTimeseries, metric) {
  if (!accountTimeseries || !metric) {
    throw new Error('findPerformanceExtremes kräver AccountTimeseries och metric');
  }

  const monthlyData = accountTimeseries.getAllMonthlyData();
  if (monthlyData.length === 0) {
    return { best: null, worst: null };
  }

  let best = monthlyData[0];
  let worst = monthlyData[0];

  for (const data of monthlyData) {
    const value = data.metrics[metric];
    
    if (value !== null && value !== undefined) {
      if (best.metrics[metric] === null || value > best.metrics[metric]) {
        best = data;
      }
      
      if (worst.metrics[metric] === null || value < worst.metrics[metric]) {
        worst = data;
      }
    }
  }

  return {
    best: {
      period: best.getPeriod(),
      value: best.metrics[metric],
      data: best
    },
    worst: {
      period: worst.getPeriod(),
      value: worst.metrics[metric],
      data: worst
    }
  };
}

/**
 * Beräknar genomsnitt för en metric över en period
 * @param {AccountTimeseries} accountTimeseries - Tidserie för ett konto
 * @param {string} metric - Metric att beräkna genomsnitt för
 * @returns {number} - Genomsnittsvärde
 */
export function calculateMetricAverage(accountTimeseries, metric) {
  if (!accountTimeseries || !metric) {
    throw new Error('calculateMetricAverage kräver AccountTimeseries och metric');
  }

  const monthlyData = accountTimeseries.getAllMonthlyData();
  if (monthlyData.length === 0) {
    return 0;
  }

  let total = 0;
  let validCount = 0;

  for (const data of monthlyData) {
    const value = data.metrics[metric];
    if (value !== null && value !== undefined && !isNaN(value)) {
      total += value;
      validCount++;
    }
  }

  return validCount > 0 ? total / validCount : 0;
}

/**
 * Beräknar total för summerbara metrics över en period
 * @param {AccountTimeseries} accountTimeseries - Tidserie för ett konto
 * @param {string} metric - Metric att summera (måste vara summerbar)
 * @returns {number} - Totalsumma
 */
export function calculateMetricTotal(accountTimeseries, metric) {
  if (!accountTimeseries || !metric) {
    throw new Error('calculateMetricTotal kräver AccountTimeseries och metric');
  }

  // Kontrollera att metric är summerbar
  const summerableMetrics = ['followers', 'views'];
  if (!summerableMetrics.includes(metric)) {
    throw new Error(`Metric '${metric}' kan inte summeras över månader. Summerbara metrics: ${summerableMetrics.join(', ')}`);
  }

  const monthlyData = accountTimeseries.getAllMonthlyData();
  if (monthlyData.length === 0) {
    return 0;
  }

  let total = 0;

  for (const data of monthlyData) {
    const value = data.metrics[metric];
    if (value !== null && value !== undefined && !isNaN(value)) {
      total += value;
    }
  }

  return total;
}

/**
 * Beräknar omfattande trend-analys för alla metrics för ett konto
 * @param {AccountTimeseries} accountTimeseries - Tidserie för ett konto
 * @returns {Object} - Omfattande trend-analys
 */
export function calculateComprehensiveTrendAnalysis(accountTimeseries) {
  if (!accountTimeseries) {
    throw new Error('calculateComprehensiveTrendAnalysis kräver AccountTimeseries');
  }

  const monthlyData = accountTimeseries.getAllMonthlyData();
  if (monthlyData.length === 0) {
    return {
      username: accountTimeseries.account.username,
      accountId: accountTimeseries.account.accountId,
      totalPeriods: 0,
      metrics: {}
    };
  }

  // Alla tillgängliga metrics
  const allMetrics = ['reach', 'followers', 'views'];
  const metricsAnalysis = {};

  for (const metric of allMetrics) {
    const trendData = calculateMonthToMonthTrend(accountTimeseries, metric);
    const averageTrend = calculateAverageTrend(trendData);
    const extremes = findPerformanceExtremes(accountTimeseries, metric);
    
    // Beräkna total eller genomsnitt beroende på metric-typ
    let aggregatedValue;
    const summerableMetrics = ['followers', 'views'];
    
    if (summerableMetrics.includes(metric)) {
      aggregatedValue = {
        type: 'total',
        value: calculateMetricTotal(accountTimeseries, metric)
      };
    } else {
      aggregatedValue = {
        type: 'average',
        value: calculateMetricAverage(accountTimeseries, metric)
      };
    }

    metricsAnalysis[metric] = {
      aggregated: aggregatedValue,
      trend: averageTrend,
      extremes,
      monthlyTrends: trendData
    };
  }

  return {
    username: accountTimeseries.account.username,
    accountId: accountTimeseries.account.accountId,
    totalPeriods: monthlyData.length,
    firstPeriod: monthlyData[0].getPeriod(),
    lastPeriod: monthlyData[monthlyData.length - 1].getPeriod(),
    metrics: metricsAnalysis
  };
}

/**
 * Jämför prestanda mellan flera konton för en specifik metric
 * @param {Array<AccountTimeseries>} accountTimeseriesList - Lista med kontotidsserier
 * @param {string} metric - Metric att jämföra
 * @returns {Array<Object>} - Rankad lista med kontoprestanda
 */
export function compareAccountPerformance(accountTimeseriesList, metric) {
  if (!accountTimeseriesList || accountTimeseriesList.length === 0 || !metric) {
    throw new Error('compareAccountPerformance kräver lista med AccountTimeseries och metric');
  }

  const performances = [];

  for (const accountTimeseries of accountTimeseriesList) {
    if (accountTimeseries.getMonthCount() === 0) {
      continue; // Hoppa över konton utan data
    }

    const analysis = calculateComprehensiveTrendAnalysis(accountTimeseries);
    const metricAnalysis = analysis.metrics[metric];

    if (metricAnalysis) {
      performances.push({
        username: accountTimeseries.account.username,
        accountId: accountTimeseries.account.accountId,
        totalPeriods: analysis.totalPeriods,
        aggregatedValue: metricAnalysis.aggregated.value,
        aggregationType: metricAnalysis.aggregated.type,
        averageTrend: metricAnalysis.trend.averagePercentageChange,
        bestPerformance: metricAnalysis.extremes.best,
        worstPerformance: metricAnalysis.extremes.worst
      });
    }
  }

  // Sortera efter aggregerat värde (högst först)
  return performances.sort((a, b) => b.aggregatedValue - a.aggregatedValue);
}

/**
 * Beräknar korrelation mellan två metrics över tid för ett konto
 * @param {AccountTimeseries} accountTimeseries - Tidserie för ett konto
 * @param {string} metric1 - Första metric
 * @param {string} metric2 - Andra metric
 * @returns {Object} - Korrelationsanalys
 */
export function calculateMetricCorrelation(accountTimeseries, metric1, metric2) {
  if (!accountTimeseries || !metric1 || !metric2) {
    throw new Error('calculateMetricCorrelation kräver AccountTimeseries och två metrics');
  }

  const monthlyData = accountTimeseries.getAllMonthlyData();
  if (monthlyData.length < 3) {
    return {
      correlation: null,
      message: 'Behöver minst 3 datapunkter för korrelationsanalys'
    };
  }

  const values1 = [];
  const values2 = [];

  for (const data of monthlyData) {
    const val1 = data.metrics[metric1];
    const val2 = data.metrics[metric2];
    
    if (val1 !== null && val1 !== undefined && !isNaN(val1) &&
        val2 !== null && val2 !== undefined && !isNaN(val2)) {
      values1.push(val1);
      values2.push(val2);
    }
  }

  if (values1.length < 3) {
    return {
      correlation: null,
      message: 'Inte tillräckligt med giltiga datapunkter för båda metrics'
    };
  }

  // Beräkna Pearson korrelationskoefficient
  const mean1 = values1.reduce((sum, val) => sum + val, 0) / values1.length;
  const mean2 = values2.reduce((sum, val) => sum + val, 0) / values2.length;

  let numerator = 0;
  let denominator1 = 0;
  let denominator2 = 0;

  for (let i = 0; i < values1.length; i++) {
    const diff1 = values1[i] - mean1;
    const diff2 = values2[i] - mean2;
    
    numerator += diff1 * diff2;
    denominator1 += diff1 * diff1;
    denominator2 += diff2 * diff2;
  }

  const correlation = numerator / Math.sqrt(denominator1 * denominator2);

  return {
    correlation: isNaN(correlation) ? 0 : correlation,
    sampleSize: values1.length,
    metric1,
    metric2,
    mean1,
    mean2
  };
}
