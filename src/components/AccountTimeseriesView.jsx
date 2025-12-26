import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar,
  FileDown,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Activity
} from 'lucide-react';

// Instagram gradient färger
const INSTAGRAM_COLORS = {
  'primary': '#E1306C',
  'secondary': '#833AB4',
  'accent': '#F56040',
  'default': '#000000'
};

// ProfileIcon-komponent för Instagram-konton
const ProfileIcon = ({ username }) => {
  const name = username || 'Okänd';
  const initial = name.charAt(0).toUpperCase();
  
  return (
    <div 
      className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
      style={{ background: 'linear-gradient(45deg, #E1306C, #833AB4, #F56040)' }}
      title={username}
    >
      {initial}
    </div>
  );
};

// Sidstorlekar för paginering
const PAGE_SIZE_OPTIONS = [
  { value: 6, label: '6 per sida' },
  { value: 12, label: '12 per sida' },
  { value: 24, label: '24 per sida' }
];

// Tillgängliga metrics för Instagram
const AVAILABLE_METRICS = [
  { key: 'reach', label: 'Räckvidd', canSum: false },
  { key: 'views', label: 'Visningar', canSum: true },
  { key: 'followers', label: 'Följare', canSum: true }
];

// Metric-definitioner
const METRIC_DEFINITIONS = {
  reach: { displayName: 'Räckvidd', canSumAcrossPages: false, category: 'unique_persons' },
  views: { displayName: 'Visningar', canSumAcrossPages: true, category: 'countable' },
  followers: { displayName: 'Följare', canSumAcrossPages: true, category: 'countable' }
};

function AccountTimeseriesView({ uploadedPeriods = [] }) {
  // State management
  const [availableAccounts, setAvailableAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [accountTimeseriesData, setAccountTimeseriesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Analys-state
  const [accountStats, setAccountStats] = useState(null);
  const [trendAnalysis, setTrendAnalysis] = useState({});
  
  // Tabell-state
  const [sortConfig, setSortConfig] = useState({ key: 'year_month', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [selectedMetrics, setSelectedMetrics] = useState(['reach', 'views', 'followers']);

  // Ladda tillgängliga konton vid montering
  useEffect(() => {
    const loadAccounts = () => {
      try {
        setLoading(true);
        
        if (uploadedPeriods.length === 0) {
          setAvailableAccounts([]);
          setLoading(false);
          return;
        }
        
        // Samla alla unika konton från alla perioder
        const accountsMap = new Map();
        
        uploadedPeriods.forEach(period => {
          if (period.data && Array.isArray(period.data)) {
            period.data.forEach(csvRow => {
              const username = csvRow.Account || csvRow.account || 'Okänt konto';
              const accountId = csvRow['IG ID'] || csvRow.igId || `account_${username.replace(/\s+/g, '_')}`;
              
              if (!accountsMap.has(accountId)) {
                accountsMap.set(accountId, {
                  accountId,
                  username
                });
              }
            });
          }
        });
        
        const accounts = Array.from(accountsMap.values()).sort((a, b) => 
          a.username.localeCompare(b.username)
        );
        
        setAvailableAccounts(accounts);
        
        // Sätt första kontot som default
        if (accounts.length > 0) {
          setSelectedAccountId(accounts[0].accountId);
        }
        
      } catch (err) {
        console.error('Error loading accounts:', err);
        setError('Kunde inte ladda tillgängliga Instagram-konton');
      } finally {
        setLoading(false);
      }
    };
    
    loadAccounts();
  }, [uploadedPeriods]);

  // Ladda data när valt konto ändras
  useEffect(() => {
    if (!selectedAccountId || uploadedPeriods.length === 0) return;
    
    const loadAccountData = () => {
      try {
        setLoading(true);
        setError(null);
        
        // Samla all data för valt konto från alla perioder
        const accountData = [];
        
        uploadedPeriods.forEach(period => {
          if (period.data && Array.isArray(period.data)) {
            const accountRow = period.data.find(csvRow => {
              const accountId = csvRow['IG ID'] || csvRow.igId || `account_${(csvRow.Account || csvRow.account || '').replace(/\s+/g, '_')}`;
              return accountId === selectedAccountId;
            });
            
            if (accountRow) {
              accountData.push({
                year: period.year,
                month: period.month,
                username: accountRow.Account || accountRow.account || 'Okänt konto',
                accountId: selectedAccountId,
                metrics: {
                  reach: parseNumericValue(accountRow.Reach || accountRow.reach),
                  views: parseNumericValue(accountRow.Views || accountRow.views),
                  followers: parseNumericValue(accountRow.Followers || accountRow.followers)
                }
              });
            }
          }
        });
        
        if (accountData.length === 0) {
          const selectedAccount = availableAccounts.find(a => a.accountId === selectedAccountId);
          setError(`Ingen tidserie-data hittades för ${selectedAccount?.username || 'valt konto'}`);
          return;
        }
        
        // Sortera data kronologiskt (senaste först som default)
        const sortedData = accountData.sort((a, b) => {
          if (a.year !== b.year) return b.year - a.year;
          return b.month - a.month;
        });
        
        setAccountTimeseriesData(sortedData);
        
        // Beräkna statistik för kontot
        calculateAccountStatistics(sortedData);
        
      } catch (err) {
        console.error('Error loading account timeseries:', err);
        const selectedAccount = availableAccounts.find(a => a.accountId === selectedAccountId);
        setError(`Kunde inte ladda data för ${selectedAccount?.username || 'valt konto'}`);
      } finally {
        setLoading(false);
      }
    };
    
    loadAccountData();
  }, [selectedAccountId, uploadedPeriods, availableAccounts]);

  // Parse numeriskt värde säkert
  const parseNumericValue = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = parseFloat(String(value).replace(/[,\s]/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  };

  // Beräkna statistik för kontot
  const calculateAccountStatistics = (data) => {
    if (data.length === 0) return;
    
    const selectedAccount = availableAccounts.find(a => a.accountId === selectedAccountId);
    
    const stats = {
      username: selectedAccount?.username || data[0]?.username || 'Okänt konto',
      totalPeriods: data.length,
      firstPeriod: data[data.length - 1],
      lastPeriod: data[0],
      metrics: {}
    };
    
    // Beräkna statistik för varje metric
    const availableMetricKeys = ['reach', 'views', 'followers'];
    for (const metric of availableMetricKeys) {
      const values = data.map(d => d.metrics[metric]).filter(v => v !== null && v !== undefined && !isNaN(v));
      
      if (values.length > 0) {
        const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);
        
        // Hitta bästa och sämsta månader
        const bestMonth = data.find(d => d.metrics[metric] === max);
        const worstMonth = data.find(d => d.metrics[metric] === min);
        
        stats.metrics[metric] = {
          average: Math.round(avg),
          min,
          max,
          bestMonth: bestMonth ? { year: bestMonth.year, month: bestMonth.month, value: max } : null,
          worstMonth: worstMonth ? { year: worstMonth.year, month: worstMonth.month, value: min } : null
        };
      }
    }
    
    setAccountStats(stats);
    
    // Beräkna trend-analys för valda metrics
    const trends = {};
    for (const metric of selectedMetrics) {
      if (data.length >= 2) {
        const oldestValue = data[data.length - 1]?.metrics[metric] || 0;
        const latestValue = data[0]?.metrics[metric] || 0;
        
        const change = latestValue - oldestValue;
        const percentChange = oldestValue > 0 ? ((change / oldestValue) * 100) : 0;
        
        trends[metric] = {
          change,
          percentChange: Math.round(percentChange * 10) / 10,
          trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
        };
      }
    }
    
    setTrendAnalysis(trends);
  };

  // Hjälpfunktion för månadsnamn
  const getMonthName = (month) => {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun',
      'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'
    ];
    return months[month - 1];
  };

  // Sortera data
  const sortedData = useMemo(() => {
    if (!accountTimeseriesData.length) return [];
    
    return [...accountTimeseriesData].sort((a, b) => {
      let aValue, bValue;
      
      if (sortConfig.key === 'year_month') {
        aValue = a.year * 100 + a.month;
        bValue = b.year * 100 + b.month;
      } else {
        aValue = a.metrics[sortConfig.key] || 0;
        bValue = b.metrics[sortConfig.key] || 0;
      }
      
      const comparison = aValue - bValue;
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [accountTimeseriesData, sortConfig]);

  // Paginering
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  // Hantera sortering
  const handleSort = (key) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Få sorterings-ikon
  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    return sortConfig.direction === 'asc' ? 
      <ArrowUp className="h-4 w-4 ml-1" /> : 
      <ArrowDown className="h-4 w-4 ml-1" />;
  };

  // Hantera metric-val med checkboxar
  const handleMetricToggle = (metricKey) => {
    setSelectedMetrics(current => 
      current.includes(metricKey) 
        ? current.filter(m => m !== metricKey)
        : [...current, metricKey]
    );
  };

  // Export till CSV
  const handleExportCSV = () => {
    const selectedAccount = availableAccounts.find(a => a.accountId === selectedAccountId);
    const headers = ['År', 'Månad', 'Period', ...selectedMetrics.map(m => {
      const def = METRIC_DEFINITIONS[m];
      return def ? def.displayName : m;
    })];
    
    const csvData = sortedData.map(item => [
      item.year,
      item.month,
      `${getMonthName(item.month)} ${item.year}`,
      ...selectedMetrics.map(m => item.metrics[m] || 0)
    ]);
    
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${selectedAccount?.username.replace(/[^a-zA-Z0-9]/g, '_')}_tidsserie.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Formatera numeriska värden
  const formatValue = (value) => {
    if (value === null || value === undefined || isNaN(value)) return '-';
    return new Intl.NumberFormat('sv-SE').format(value);
  };

  if (loading) {
    return (
      <Alert>
        <Activity className="h-4 w-4" />
        <AlertTitle>Laddar data</AlertTitle>
        <AlertDescription>
          Analyserar tidserie-data för Instagram-konton...
        </AlertDescription>
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Fel</AlertTitle>
        <AlertDescription>
          {error}
        </AlertDescription>
      </Alert>
    );
  }

  if (availableAccounts.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Inga konton hittades</AlertTitle>
        <AlertDescription>
          Kunde inte hitta några Instagram-konton i den uppladdade datan.
        </AlertDescription>
      </Alert>
    );
  }

  const selectedAccount = availableAccounts.find(a => a.accountId === selectedAccountId);

  return (
    <div className="space-y-6">
      {/* Konto-väljare och kontroller */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-instagram-500" />
            Kontoanalys över tid
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-sm font-medium mb-2 block">Välj Instagram-konto</label>
              <Select 
                value={selectedAccountId}
                onValueChange={setSelectedAccountId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Välj konto att analysera" />
                </SelectTrigger>
                <SelectContent>
                  {availableAccounts.map(account => (
                    <SelectItem key={account.accountId} value={account.accountId}>
                      <div className="flex items-center gap-2">
                        <ProfileIcon username={account.username} />
                        <span>{account.username}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedAccount && (
                <p className="text-xs text-muted-foreground mt-1">
                  ID: {selectedAccount.accountId}
                </p>
              )}
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Metrics att visa</label>
              <div className="flex flex-wrap gap-3">
                {AVAILABLE_METRICS.map(metric => {
                  const isSelected = selectedMetrics.includes(metric.key);
                  
                  return (
                    <label key={metric.key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleMetricToggle(metric.key)}
                        className="h-4 w-4 text-instagram-500 border-gray-300 rounded focus:ring-instagram-500"
                      />
                      <span className="text-sm font-medium">{metric.label}</span>
                      {!metric.canSum && (
                        <span className="text-xs text-orange-600 font-medium">*</span>
                      )}
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                * = Kan inte summeras över månader (unika personer)
              </p>
            </div>
          </div>

          {/* Statistik-sammanfattning */}
          {accountStats && (
            <div className="grid md:grid-cols-4 gap-4 mb-6 p-4 bg-muted/30 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold text-instagram-600 flex items-center justify-center gap-2">
                  <ProfileIcon username={accountStats.username} />
                  {accountStats.totalPeriods}
                </div>
                <div className="text-sm text-muted-foreground">Månader data</div>
              </div>
              
              <div className="text-center">
                <div className="text-lg font-semibold">
                  {getMonthName(accountStats.firstPeriod.month)} {accountStats.firstPeriod.year}
                </div>
                <div className="text-sm text-muted-foreground">Första månad</div>
              </div>
              
              <div className="text-center">
                <div className="text-lg font-semibold">
                  {getMonthName(accountStats.lastPeriod.month)} {accountStats.lastPeriod.year}
                </div>
                <div className="text-sm text-muted-foreground">Senaste månad</div>
              </div>

              <div className="text-center">
                <div className="text-lg font-semibold text-instagram-600">
                  {selectedAccount?.username || 'Okänt konto'}
                </div>
                <div className="text-sm text-muted-foreground">Valt konto</div>
              </div>
            </div>
          )}

          {/* Trend-indikatorer för valda metrics */}
          {Object.keys(trendAnalysis).length > 0 && (
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              {selectedMetrics.slice(0, 3).map(metric => {
                const trend = trendAnalysis[metric];
                const definition = METRIC_DEFINITIONS[metric];
                
                if (!trend || !definition) return null;
                
                return (
                  <div key={metric} className="flex items-center gap-3 p-3 bg-white border rounded-lg">
                    {trend.trend === 'up' && <TrendingUp className="h-5 w-5 text-green-600" />}
                    {trend.trend === 'down' && <TrendingDown className="h-5 w-5 text-red-600" />}
                    {trend.trend === 'stable' && <Activity className="h-5 w-5 text-gray-500" />}
                    
                    <div className="flex-1">
                      <div className="font-medium text-sm">{definition.displayName}</div>
                      <div className="text-xs text-muted-foreground">
                        {trend.percentChange > 0 ? '+' : ''}{trend.percentChange}% sedan första månad
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tidserie-tabell */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Månadsvis utveckling - {selectedAccount?.username || 'Okänt konto'}
          </CardTitle>
          <div className="flex gap-2">
            <Button onClick={handleExportCSV} variant="outline" size="sm">
              <FileDown className="h-4 w-4 mr-2" />
              CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {accountTimeseriesData.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Ingen tidserie-data tillgänglig för valt konto
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer select-none"
                      onClick={() => handleSort('year_month')}
                    >
                      <div className="flex items-center">
                        Period
                        {getSortIcon('year_month')}
                      </div>
                    </TableHead>
                    {selectedMetrics.map(metric => {
                      const definition = METRIC_DEFINITIONS[metric];
                      return (
                        <TableHead 
                          key={metric}
                          className="text-right cursor-pointer select-none"
                          onClick={() => handleSort(metric)}
                        >
                          <div className="flex items-center justify-end">
                            {definition?.displayName || metric}
                            {getSortIcon(metric)}
                            {!definition?.canSumAcrossPages && (
                              <span className="ml-1 text-orange-600">*</span>
                            )}
                          </div>
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((item) => (
                    <TableRow key={`${item.year}_${item.month}`}>
                      <TableCell className="font-medium">
                        {getMonthName(item.month)} {item.year}
                      </TableCell>
                      {selectedMetrics.map(metric => (
                        <TableCell 
                          key={metric}
                          className="text-right"
                        >
                          <div className="flex items-center justify-end gap-1">
                            {formatValue(item.metrics[metric])}
                            {accountStats?.metrics[metric]?.bestMonth && 
                             accountStats.metrics[metric].bestMonth.year === item.year &&
                             accountStats.metrics[metric].bestMonth.month === item.month && (
                              <span className="text-yellow-600" title="Bästa värde för detta konto">🏆</span>
                            )}
                            {accountStats?.metrics[metric]?.worstMonth && 
                             accountStats.metrics[metric].worstMonth.year === item.year &&
                             accountStats.metrics[metric].worstMonth.month === item.month && (
                              <span className="text-gray-500" title="Sämsta värde för detta konto">📉</span>
                            )}
                          </div>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Paginering */}
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Visa:</span>
                  <Select
                    value={pageSize.toString()}
                    onValueChange={(value) => {
                      setPageSize(Number(value));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value.toString()}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center gap-6">
                  <span className="text-sm text-muted-foreground">
                    Visar {((currentPage - 1) * pageSize) + 1} till {Math.min(currentPage * pageSize, sortedData.length)} av {sortedData.length}
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    
                    <span className="text-sm">
                      Sida {currentPage} av {totalPages}
                    </span>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AccountTimeseriesView;
