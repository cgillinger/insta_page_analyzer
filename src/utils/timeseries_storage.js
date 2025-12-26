/**
 * Timeseries Storage
 * 
 * Hanterar lagring av Instagram API månadsdata i webbläsaren
 * Använder localStorage för metadata och IndexedDB för stora datamängder
 * Anpassad för tidserie-data istället för post-baserad data
 */

// Lagringskonfiguration
const STORAGE_CONFIG = {
  LOCALSTORAGE_KEYS: {
    METADATA: 'insta_analyzer_metadata',
    PERIODS: 'insta_analyzer_periods',
    ACCOUNTS: 'insta_analyzer_accounts',
    SETTINGS: 'insta_analyzer_settings'
  },
  INDEXEDDB: {
    NAME: 'InstagramAnalyzerDB',
    VERSION: 1,
    STORES: {
      MONTHLY_DATA: 'monthlyData',
      TIMESERIES: 'timeseries'
    }
  },
  LIMITS: {
    LOCALSTORAGE_MAX: 5 * 1024 * 1024,    // 5MB
    INDEXEDDB_MAX: 50 * 1024 * 1024,      // 50MB
    MAX_PERIODS: 120,                      // Max 10 år data
    MAX_ACCOUNTS: 1000                     // Max 1000 Instagram-konton
  }
};

/**
 * Initialiserar IndexedDB för tidserie-lagring
 */
async function initializeIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(STORAGE_CONFIG.INDEXEDDB.NAME, STORAGE_CONFIG.INDEXEDDB.VERSION);
    
    request.onerror = () => {
      console.error('IndexedDB initialization failed:', request.error);
      reject(request.error);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Store för månadsdata
      if (!db.objectStoreNames.contains(STORAGE_CONFIG.INDEXEDDB.STORES.MONTHLY_DATA)) {
        const monthlyStore = db.createObjectStore(STORAGE_CONFIG.INDEXEDDB.STORES.MONTHLY_DATA, {
          keyPath: 'id'
        });
        
        // Index för snabbare sökningar
        monthlyStore.createIndex('accountId', 'accountId', { unique: false });
        monthlyStore.createIndex('period', ['year', 'month'], { unique: false });
        monthlyStore.createIndex('accountPeriod', ['accountId', 'year', 'month'], { unique: true });
        
        console.log('Created monthlyData store with indexes');
      }
      
      // Store för tidsserier (aggregerad data per konto)
      if (!db.objectStoreNames.contains(STORAGE_CONFIG.INDEXEDDB.STORES.TIMESERIES)) {
        const timeseriesStore = db.createObjectStore(STORAGE_CONFIG.INDEXEDDB.STORES.TIMESERIES, {
          keyPath: 'accountId'
        });
        
        timeseriesStore.createIndex('username', 'username', { unique: false });
        
        console.log('Created timeseries store');
      }
    };
    
    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

/**
 * Sparar månadsdata för ett konto i IndexedDB
 * @param {MonthlyAccountData} monthlyData - Månadsdata att spara
 * @returns {Promise<boolean>} - True om lyckad
 */
export async function saveMonthlyData(monthlyData) {
  if (!monthlyData || !monthlyData.account || !monthlyData.year || !monthlyData.month) {
    throw new Error('Ogiltig månadsdata för lagring');
  }
  
  try {
    const db = await initializeIndexedDB();
    
    // Skapa storage-objekt
    const storageObject = {
      id: `${monthlyData.account.accountId}_${monthlyData.year}_${monthlyData.month}`,
      accountId: monthlyData.account.accountId,
      username: monthlyData.account.username,
      displayName: monthlyData.account.displayName,
      year: monthlyData.year,
      month: monthlyData.month,
      metrics: monthlyData.metrics,
      createdAt: monthlyData.createdAt || new Date(),
      updatedAt: new Date()
    };
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORAGE_CONFIG.INDEXEDDB.STORES.MONTHLY_DATA], 'readwrite');
      const store = transaction.objectStore(STORAGE_CONFIG.INDEXEDDB.STORES.MONTHLY_DATA);
      
      const request = store.put(storageObject);
      
      request.onsuccess = () => {
        console.log(`Saved monthly data: ${storageObject.id}`);
        resolve(true);
      };
      
      request.onerror = () => {
        console.error('Failed to save monthly data:', request.error);
        reject(request.error);
      };
    });
    
  } catch (error) {
    console.error('Error saving monthly data:', error);
    throw error;
  }
}

/**
 * Sparar flera månadsdata i batch
 * @param {Array<MonthlyAccountData>} monthlyDataList - Lista med månadsdata
 * @returns {Promise<Object>} - Resultat med antal sparade och fel
 */
export async function saveMonthlyDataBatch(monthlyDataList) {
  if (!Array.isArray(monthlyDataList) || monthlyDataList.length === 0) {
    throw new Error('Tom eller ogiltig månadsdata-lista');
  }
  
  const results = {
    saved: 0,
    failed: 0,
    errors: []
  };
  
  try {
    const db = await initializeIndexedDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORAGE_CONFIG.INDEXEDDB.STORES.MONTHLY_DATA], 'readwrite');
      const store = transaction.objectStore(STORAGE_CONFIG.INDEXEDDB.STORES.MONTHLY_DATA);
      
      let completed = 0;
      
      for (const monthlyData of monthlyDataList) {
        try {
          const storageObject = {
            id: `${monthlyData.account.accountId}_${monthlyData.year}_${monthlyData.month}`,
            accountId: monthlyData.account.accountId,
            username: monthlyData.account.username,
            displayName: monthlyData.account.displayName,
            year: monthlyData.year,
            month: monthlyData.month,
            metrics: monthlyData.metrics,
            createdAt: monthlyData.createdAt || new Date(),
            updatedAt: new Date()
          };
          
          const request = store.put(storageObject);
          
          request.onsuccess = () => {
            results.saved++;
            completed++;
            
            if (completed === monthlyDataList.length) {
              console.log(`Batch save completed: ${results.saved} saved, ${results.failed} failed`);
              resolve(results);
            }
          };
          
          request.onerror = () => {
            results.failed++;
            results.errors.push({
              id: storageObject.id,
              error: request.error.message
            });
            completed++;
            
            if (completed === monthlyDataList.length) {
              resolve(results);
            }
          };
          
        } catch (error) {
          results.failed++;
          results.errors.push({
            data: monthlyData,
            error: error.message
          });
          completed++;
          
          if (completed === monthlyDataList.length) {
            resolve(results);
          }
        }
      }
    });
    
  } catch (error) {
    console.error('Batch save failed:', error);
    throw error;
  }
}

/**
 * Hämtar månadsdata för ett specifikt konto och period
 * @param {string} accountId - Konto-ID
 * @param {number} year - År
 * @param {number} month - Månad
 * @returns {Promise<Object|null>} - Månadsdata eller null
 */
export async function getMonthlyData(accountId, year, month) {
  if (!accountId || !year || !month) {
    throw new Error('accountId, year och month krävs');
  }
  
  try {
    const db = await initializeIndexedDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORAGE_CONFIG.INDEXEDDB.STORES.MONTHLY_DATA], 'readonly');
      const store = transaction.objectStore(STORAGE_CONFIG.INDEXEDDB.STORES.MONTHLY_DATA);
      const index = store.index('accountPeriod');
      
      const request = index.get([accountId, year, month]);
      
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
    
  } catch (error) {
    console.error('Error getting monthly data:', error);
    throw error;
  }
}

/**
 * Hämtar all data för ett specifikt konto (hela tidsserien)
 * @param {string} accountId - Konto-ID
 * @returns {Promise<Array<Object>>} - Lista med månadsdata
 */
export async function getAccountTimeseries(accountId) {
  if (!accountId) {
    throw new Error('accountId krävs');
  }
  
  try {
    const db = await initializeIndexedDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORAGE_CONFIG.INDEXEDDB.STORES.MONTHLY_DATA], 'readonly');
      const store = transaction.objectStore(STORAGE_CONFIG.INDEXEDDB.STORES.MONTHLY_DATA);
      const index = store.index('accountId');
      
      const request = index.getAll(accountId);
      
      request.onsuccess = () => {
        // Sortera kronologiskt
        const data = request.result.sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year;
          return a.month - b.month;
        });
        
        resolve(data);
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
    
  } catch (error) {
    console.error('Error getting account timeseries:', error);
    throw error;
  }
}

/**
 * Hämtar data för alla konton för en specifik period
 * @param {number} year - År
 * @param {number} month - Månad
 * @returns {Promise<Array<Object>>} - Lista med månadsdata för alla konton
 */
export async function getPeriodData(year, month) {
  if (!year || !month) {
    throw new Error('year och month krävs');
  }
  
  try {
    const db = await initializeIndexedDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORAGE_CONFIG.INDEXEDDB.STORES.MONTHLY_DATA], 'readonly');
      const store = transaction.objectStore(STORAGE_CONFIG.INDEXEDDB.STORES.MONTHLY_DATA);
      const index = store.index('period');
      
      const request = index.getAll([year, month]);
      
      request.onsuccess = () => {
        // Sortera efter användarnamn
        const data = request.result.sort((a, b) => 
          a.username.localeCompare(b.username)
        );
        
        resolve(data);
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
    
  } catch (error) {
    console.error('Error getting period data:', error);
    throw error;
  }
}

/**
 * Hämtar alla unika perioder i databasen
 * @returns {Promise<Array<Object>>} - Lista med perioder {year, month}
 */
export async function getAllPeriods() {
  try {
    const db = await initializeIndexedDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORAGE_CONFIG.INDEXEDDB.STORES.MONTHLY_DATA], 'readonly');
      const store = transaction.objectStore(STORAGE_CONFIG.INDEXEDDB.STORES.MONTHLY_DATA);
      
      const request = store.getAll();
      
      request.onsuccess = () => {
        const periodsSet = new Set();
        
        for (const item of request.result) {
          periodsSet.add(`${item.year}_${item.month}`);
        }
        
        const periods = Array.from(periodsSet)
          .map(key => {
            const [year, month] = key.split('_');
            return { year: parseInt(year), month: parseInt(month) };
          })
          .sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.month - b.month;
          });
        
        resolve(periods);
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
    
  } catch (error) {
    console.error('Error getting all periods:', error);
    throw error;
  }
}

/**
 * Hämtar alla unika konton i databasen
 * @returns {Promise<Array<Object>>} - Lista med konton {accountId, username, displayName}
 */
export async function getAllAccounts() {
  try {
    const db = await initializeIndexedDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORAGE_CONFIG.INDEXEDDB.STORES.MONTHLY_DATA], 'readonly');
      const store = transaction.objectStore(STORAGE_CONFIG.INDEXEDDB.STORES.MONTHLY_DATA);
      
      const request = store.getAll();
      
      request.onsuccess = () => {
        const accountsMap = new Map();
        
        for (const item of request.result) {
          if (!accountsMap.has(item.accountId)) {
            accountsMap.set(item.accountId, {
              accountId: item.accountId,
              username: item.username,
              displayName: item.displayName
            });
          }
        }
        
        const accounts = Array.from(accountsMap.values())
          .sort((a, b) => a.username.localeCompare(b.username));
        
        resolve(accounts);
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
    
  } catch (error) {
    console.error('Error getting all accounts:', error);
    throw error;
  }
}

/**
 * Sparar metadata i localStorage
 * @param {Object} metadata - Metadata att spara
 */
export function saveMetadata(metadata) {
  try {
    const metadataWithTimestamp = {
      ...metadata,
      updatedAt: new Date().toISOString()
    };
    
    localStorage.setItem(
      STORAGE_CONFIG.LOCALSTORAGE_KEYS.METADATA,
      JSON.stringify(metadataWithTimestamp)
    );
    
    console.log('Metadata saved to localStorage');
    
  } catch (error) {
    console.error('Failed to save metadata:', error);
    throw error;
  }
}

/**
 * Hämtar metadata från localStorage
 * @returns {Object|null} - Metadata eller null
 */
export function getMetadata() {
  try {
    const stored = localStorage.getItem(STORAGE_CONFIG.LOCALSTORAGE_KEYS.METADATA);
    return stored ? JSON.parse(stored) : null;
    
  } catch (error) {
    console.error('Failed to get metadata:', error);
    return null;
  }
}

/**
 * Beräknar lagringsstorlek och använd kapacitet
 * @returns {Promise<Object>} - Lagringsstatistik
 */
export async function getStorageStats() {
  try {
    // localStorage storlek
    let localStorageSize = 0;
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key) && key.startsWith('insta_analyzer_')) {
        localStorageSize += localStorage[key].length;
      }
    }
    
    // IndexedDB storlek (approximation)
    const db = await initializeIndexedDB();
    let indexedDBSize = 0;
    let totalRecords = 0;
    
    const transaction = db.transaction([STORAGE_CONFIG.INDEXEDDB.STORES.MONTHLY_DATA], 'readonly');
    const store = transaction.objectStore(STORAGE_CONFIG.INDEXEDDB.STORES.MONTHLY_DATA);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      
      request.onsuccess = () => {
        totalRecords = request.result.length;
        
        // Approximera storlek baserat på antal poster
        indexedDBSize = totalRecords * 1024; // ~1KB per post
        
        const totalSize = localStorageSize + indexedDBSize;
        const totalLimit = STORAGE_CONFIG.LIMITS.LOCALSTORAGE_MAX + STORAGE_CONFIG.LIMITS.INDEXEDDB_MAX;
        
        resolve({
          localStorage: {
            used: localStorageSize,
            limit: STORAGE_CONFIG.LIMITS.LOCALSTORAGE_MAX,
            percentage: (localStorageSize / STORAGE_CONFIG.LIMITS.LOCALSTORAGE_MAX) * 100
          },
          indexedDB: {
            used: indexedDBSize,
            records: totalRecords,
            limit: STORAGE_CONFIG.LIMITS.INDEXEDDB_MAX,
            percentage: (indexedDBSize / STORAGE_CONFIG.LIMITS.INDEXEDDB_MAX) * 100
          },
          total: {
            used: totalSize,
            limit: totalLimit,
            percentage: (totalSize / totalLimit) * 100,
            availableSpace: totalLimit - totalSize
          }
        });
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
    
  } catch (error) {
    console.error('Error getting storage stats:', error);
    throw error;
  }
}

/**
 * Rensar all lagrad data
 * @returns {Promise<boolean>} - True om lyckad
 */
export async function clearAllData() {
  try {
    // Rensa localStorage
    for (const key of Object.values(STORAGE_CONFIG.LOCALSTORAGE_KEYS)) {
      localStorage.removeItem(key);
    }
    
    // Rensa IndexedDB
    const db = await initializeIndexedDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([
        STORAGE_CONFIG.INDEXEDDB.STORES.MONTHLY_DATA,
        STORAGE_CONFIG.INDEXEDDB.STORES.TIMESERIES
      ], 'readwrite');
      
      let cleared = 0;
      const totalStores = 2;
      
      // Rensa monthly data
      const monthlyStore = transaction.objectStore(STORAGE_CONFIG.INDEXEDDB.STORES.MONTHLY_DATA);
      const clearMonthly = monthlyStore.clear();
      
      clearMonthly.onsuccess = () => {
        cleared++;
        if (cleared === totalStores) {
          console.log('All data cleared successfully');
          resolve(true);
        }
      };
      
      // Rensa timeseries
      const timeseriesStore = transaction.objectStore(STORAGE_CONFIG.INDEXEDDB.STORES.TIMESERIES);
      const clearTimeseries = timeseriesStore.clear();
      
      clearTimeseries.onsuccess = () => {
        cleared++;
        if (cleared === totalStores) {
          console.log('All data cleared successfully');
          resolve(true);
        }
      };
      
      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
    
  } catch (error) {
    console.error('Error clearing data:', error);
    throw error;
  }
}
