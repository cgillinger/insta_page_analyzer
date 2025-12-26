/**
 * Timeseries Models
 * 
 * Datastrukturer för Instagram API tidserie-analys
 * Hanterar Instagram-konton och månadsdata med korrekt typning och validering
 */

/**
 * Instagram-konto datastruktur
 * Representerar ett enskilt Instagram-konto med all grundläggande information
 */
export class InstagramAccount {
  constructor(username, accountId, displayName = null) {
    if (!username || !accountId) {
      throw new Error('InstagramAccount kräver både username och accountId');
    }
    
    this.username = username.trim(); // Account (handle)
    this.accountId = String(accountId).trim(); // IG ID
    this.displayName = displayName ? displayName.trim() : username.trim(); // Account Name
    this.createdAt = new Date();
  }

  /**
   * Skapar ett Instagram-konto från CSV-rad
   * @param {Object} csvRow - Rad från parsad CSV
   * @returns {InstagramAccount} - Ny InstagramAccount instans
   */
  static fromCSVRow(csvRow) {
    if (!csvRow.Account || !csvRow['IG ID']) {
      throw new Error('CSV-rad saknar obligatoriska fält: Account eller IG ID');
    }
    
    return new InstagramAccount(
      csvRow.Account,
      csvRow['IG ID'],
      csvRow['Account Name'] || csvRow.Account
    );
  }

  /**
   * Returnerar unik nyckel för detta konto
   * @returns {string} - Unik identifierare
   */
  getKey() {
    return `account_${this.accountId}`;
  }

  /**
   * Validerar att kontot är giltigt
   * @returns {boolean} - True om kontot är giltigt
   */
  isValid() {
    return this.username.length > 0 && this.accountId.length > 0;
  }
}

/**
 * Månadsdata för ett specifikt Instagram-konto
 * Innehåller alla metrics för ett konto under en månad
 */
export class MonthlyAccountData {
  constructor(account, year, month, metrics) {
    if (!(account instanceof InstagramAccount)) {
      throw new Error('MonthlyAccountData kräver en InstagramAccount instans');
    }
    
    if (!year || !month || month < 1 || month > 12) {
      throw new Error('MonthlyAccountData kräver giltigt år och månad (1-12)');
    }

    this.account = account;
    this.year = parseInt(year);
    this.month = parseInt(month);
    this.metrics = this.validateMetrics(metrics || {});
    this.createdAt = new Date();
  }

  /**
   * Validerar och standardiserar metrics
   * @param {Object} rawMetrics - Rå metrics från CSV
   * @returns {Object} - Validerade metrics
   */
  validateMetrics(rawMetrics) {
    const metrics = {
      // Icke-summerbar metric (unika personer per månad)
      reach: this.parseNumeric(rawMetrics.reach || rawMetrics.Reach),
      
      // Summerbara metrics
      followers: this.parseNumeric(rawMetrics.followers || rawMetrics.Followers),
      views: this.parseNumeric(rawMetrics.views || rawMetrics.Views)
    };

    return metrics;
  }

  /**
   * Parsar numeriska värden säkert
   * @param {any} value - Värde att parsa
   * @returns {number} - Parsad numerisk värde eller 0
   */
  parseNumeric(value) {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = parseFloat(String(value).replace(/,/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Skapar MonthlyAccountData från CSV-rad
   * @param {Object} csvRow - Rad från parsad CSV
   * @param {number} year - År för denna data
   * @param {number} month - Månad för denna data
   * @returns {MonthlyAccountData} - Ny MonthlyAccountData instans
   */
  static fromCSVRow(csvRow, year, month) {
    const account = InstagramAccount.fromCSVRow(csvRow);
    return new MonthlyAccountData(account, year, month, csvRow);
  }

  /**
   * Returnerar unik nyckel för denna månadsdata
   * @returns {string} - Unik identifierare
   */
  getKey() {
    return `${this.account.getKey()}_${this.year}_${this.month}`;
  }

  /**
   * Returnerar period som objekt
   * @returns {Object} - Period objekt {year, month}
   */
  getPeriod() {
    return {
      year: this.year,
      month: this.month
    };
  }

  /**
   * Kontrollerar om detta är samma period som angiven
   * @param {number} year - År att jämföra
   * @param {number} month - Månad att jämföra
   * @returns {boolean} - True om samma period
   */
  isSamePeriod(year, month) {
    return this.year === year && this.month === month;
  }

  /**
   * Returnerar summerbara metrics (kan adderas över månader)
   * @returns {Object} - Summerbara metrics
   */
  getSummerableMetrics() {
    return {
      followers: this.metrics.followers,
      views: this.metrics.views
    };
  }

  /**
   * Returnerar icke-summerbara metrics (unika personer per månad)
   * @returns {Object} - Icke-summerbara metrics
   */
  getNonSummerableMetrics() {
    return {
      reach: this.metrics.reach
    };
  }
}

/**
 * Tidserie-container för ett Instagram-konto
 * Innehåller all månadsdata för ett konto över tid
 */
export class AccountTimeseries {
  constructor(account) {
    if (!(account instanceof InstagramAccount)) {
      throw new Error('AccountTimeseries kräver en InstagramAccount instans');
    }
    
    this.account = account;
    this.monthlyData = new Map(); // Map<string, MonthlyAccountData>
    this.createdAt = new Date();
  }

  /**
   * Lägger till månadsdata för detta konto
   * @param {MonthlyAccountData} monthlyData - Månadsdata att lägga till
   */
  addMonthlyData(monthlyData) {
    if (!(monthlyData instanceof MonthlyAccountData)) {
      throw new Error('addMonthlyData kräver MonthlyAccountData instans');
    }

    if (monthlyData.account.accountId !== this.account.accountId) {
      throw new Error('MonthlyData måste tillhöra samma konto');
    }

    const key = `${monthlyData.year}_${monthlyData.month}`;
    this.monthlyData.set(key, monthlyData);
  }

  /**
   * Hämtar månadsdata för specifik period
   * @param {number} year - År
   * @param {number} month - Månad
   * @returns {MonthlyAccountData|null} - Månadsdata eller null om inte finns
   */
  getMonthlyData(year, month) {
    const key = `${year}_${month}`;
    return this.monthlyData.get(key) || null;
  }

  /**
   * Returnerar alla månader som har data
   * @returns {Array<{year: number, month: number}>} - Lista med perioder
   */
  getAvailablePeriods() {
    return Array.from(this.monthlyData.values())
      .map(data => data.getPeriod())
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });
  }

  /**
   * Returnerar alla månadsdata sorterat kronologiskt
   * @returns {Array<MonthlyAccountData>} - Sorterad lista med månadsdata
   */
  getAllMonthlyData() {
    return Array.from(this.monthlyData.values())
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });
  }

  /**
   * Kontrollerar om kontot har data för specifik period
   * @param {number} year - År
   * @param {number} month - Månad
   * @returns {boolean} - True om data finns
   */
  hasDataForPeriod(year, month) {
    return this.getMonthlyData(year, month) !== null;
  }

  /**
   * Returnerar antal månader med data
   * @returns {number} - Antal månader
   */
  getMonthCount() {
    return this.monthlyData.size;
  }
}

/**
 * Huvudcontainer för all tidserie-data
 * Hanterar flera Instagram-konton över tid
 */
export class TimeseriesDataset {
  constructor() {
    this.accountTimeseries = new Map(); // Map<string, AccountTimeseries>
    this.createdAt = new Date();
  }

  /**
   * Lägger till månadsdata för ett konto
   * @param {MonthlyAccountData} monthlyData - Månadsdata att lägga till
   */
  addMonthlyData(monthlyData) {
    if (!(monthlyData instanceof MonthlyAccountData)) {
      throw new Error('addMonthlyData kräver MonthlyAccountData instans');
    }

    const accountKey = monthlyData.account.getKey();
    
    if (!this.accountTimeseries.has(accountKey)) {
      this.accountTimeseries.set(accountKey, new AccountTimeseries(monthlyData.account));
    }

    this.accountTimeseries.get(accountKey).addMonthlyData(monthlyData);
  }

  /**
   * Hämtar tidserie för ett specifikt konto
   * @param {string} accountId - Konto-ID
   * @returns {AccountTimeseries|null} - Kontotidserie eller null
   */
  getAccountTimeseries(accountId) {
    const accountKey = `account_${accountId}`;
    return this.accountTimeseries.get(accountKey) || null;
  }

  /**
   * Returnerar alla konton som har data
   * @returns {Array<InstagramAccount>} - Lista med konton
   */
  getAllAccounts() {
    return Array.from(this.accountTimeseries.values())
      .map(timeseries => timeseries.account)
      .sort((a, b) => a.username.localeCompare(b.username));
  }

  /**
   * Returnerar alla unika perioder i datasetet
   * @returns {Array<{year: number, month: number}>} - Lista med perioder
   */
  getAllPeriods() {
    const periodsSet = new Set();
    
    for (const timeseries of this.accountTimeseries.values()) {
      for (const period of timeseries.getAvailablePeriods()) {
        periodsSet.add(`${period.year}_${period.month}`);
      }
    }

    return Array.from(periodsSet)
      .map(key => {
        const [year, month] = key.split('_');
        return { year: parseInt(year), month: parseInt(month) };
      })
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });
  }

  /**
   * Returnerar alla konton för en specifik period
   * @param {number} year - År
   * @param {number} month - Månad
   * @returns {Array<MonthlyAccountData>} - Lista med månadsdata
   */
  getDataForPeriod(year, month) {
    const result = [];
    
    for (const timeseries of this.accountTimeseries.values()) {
      const monthlyData = timeseries.getMonthlyData(year, month);
      if (monthlyData) {
        result.push(monthlyData);
      }
    }

    return result.sort((a, b) => a.account.username.localeCompare(b.account.username));
  }

  /**
   * Returnerar statistik om datasetet
   * @returns {Object} - Dataset-statistik
   */
  getStats() {
    return {
      totalAccounts: this.accountTimeseries.size,
      totalPeriods: this.getAllPeriods().length,
      totalDataPoints: Array.from(this.accountTimeseries.values())
        .reduce((sum, timeseries) => sum + timeseries.getMonthCount(), 0)
    };
  }

  /**
   * Rensar all data
   */
  clear() {
    this.accountTimeseries.clear();
  }
}
