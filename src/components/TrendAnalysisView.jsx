import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { TrendingUp, TrendingDown, Activity, LineChart } from 'lucide-react';
import { METRIC_DEFINITIONS } from '../utils/metric_categorizer';

// ENDAST dessa tre metrics som ska visas
const ALLOWED_METRICS = [
  { key: 'reach', label: 'Räckvidd', canSum: false },
  { key: 'views', label: 'Visningar', canSum: true },
  { key: 'followers', label: 'Följare', canSum: true }
];

// FÖRBÄTTRADE FÄRGER - tydligt åtskilda färger som tilldelas i ordning
const CHART_COLORS = [
  '#2563EB', // Blå
  '#16A34A', // Grön
  '#EAB308', // Gul/guld
  '#DC2626', // Röd
  '#7C3AED', // Lila
  '#EA580C', // Orange
  '#0891B2', // Cyan
  '#BE185D', // Rosa/magenta
  '#059669', // Emerald
  '#7C2D12', // Brun
  '#4338CA', // Indigo
  '#C2410C'  // Orange-röd
];

const TrendAnalysisView = ({ uploadedPeriods }) => {
  // State för linjediagram
  const [selectedMetric, setSelectedMetric] = useState('reach');
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [selectedPeriods, setSelectedPeriods] = useState([]);
  const [hoveredDataPoint, setHoveredDataPoint] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Få alla unika konton från uploadedPeriods
  const availableAccounts = useMemo(() => {
    if (!uploadedPeriods || uploadedPeriods.length === 0) {
      return [];
    }
    
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
    
    return Array.from(accountsMap.values()).sort((a, b) => 
      a.username.localeCompare(b.username)
    );
  }, [uploadedPeriods]);

  // Få alla tillgängliga perioder sorterade
  const availablePeriods = useMemo(() => {
    if (!uploadedPeriods) return [];
    
    return uploadedPeriods
      .map(period => ({
        ...period,
        sortKey: period.year * 100 + period.month
      }))
      .sort((a, b) => a.sortKey - b.sortKey);
  }, [uploadedPeriods]);

  // Månadsnamn för X-axel
  const getMonthName = (month) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 
                   'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
    return months[month - 1] || month.toString();
  };

  // Mappa metric-nycklar till exakta CSV-kolumnnamn
  const getCSVColumnName = (metricKey) => {
    const mapping = {
      'reach': 'Reach',
      'views': 'Views', 
      'followers': 'Followers'
    };
    return mapping[metricKey] || metricKey;
  };

  // FÖRBÄTTRAD FÄRGVAL - tilldela färger baserat på ordning av valda konton
  const getAccountColor = (accountId, selectedAccountIds) => {
    const index = selectedAccountIds.indexOf(accountId);
    return index >= 0 ? CHART_COLORS[index % CHART_COLORS.length] : CHART_COLORS[0];
  };

  // FIXAD PNG-export med legenda och korrekt aspect ratio
  const exportChartAsPNG = () => {
    const svg = document.querySelector('#trend-chart-svg');
    if (!svg || chartLines.length === 0) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const exportWidth = 1200;
    const exportHeight = 900;
    
    canvas.width = exportWidth;
    canvas.height = exportHeight;
    
    // Vit bakgrund för PPT
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, exportWidth, exportHeight);
    
    // Rita datapunkt-indikator (prominent blå box)
    const boxY = 60;
    const boxHeight = 60;
    ctx.fillStyle = '#dbeafe';
    ctx.fillRect(100, boxY, exportWidth - 200, boxHeight);
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.strokeRect(100, boxY, exportWidth - 200, boxHeight);
    
    // Text i blå box - CENTRERAD
    ctx.fillStyle = '#1e40af';
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.fillText(`Visar: ${METRIC_DEFINITIONS[selectedMetric]?.displayName}`, exportWidth / 2, boxY + 30);
    ctx.font = '14px Arial, sans-serif';
    ctx.fillText('Aktuell datapunkt som visas i diagrammet', exportWidth / 2, boxY + 50);
    
    // Rita legenda FÖRE diagrammet
    const legendY = 140;
    const legendItemWidth = 200;
    
    const totalLegendWidth = chartLines.length * legendItemWidth;
    const legendStartX = (exportWidth - totalLegendWidth) / 2;
    
    chartLines.forEach((line, index) => {
      const startX = legendStartX + (index * legendItemWidth);
      
      // Färgad cirkel
      ctx.fillStyle = line.color;
      ctx.beginPath();
      ctx.arc(startX + 10, legendY + 12, 6, 0, 2 * Math.PI);
      ctx.fill();
      
      // Kontonamn
      ctx.fillStyle = '#374151';
      ctx.font = '14px Arial, sans-serif';
      ctx.textAlign = 'left';
      
      let displayName = line.username;
      if (displayName.length > 20) {
        displayName = displayName.substring(0, 17) + '...';
      }
      
      ctx.fillText(displayName, startX + 25, legendY + 17);
    });
    
    // Konvertera och rita SVG-diagrammet
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const URL = window.URL || window.webkitURL;
    const svgUrl = URL.createObjectURL(svgBlob);
    
    const img = new Image();
    img.onload = () => {
      const chartStartY = legendY + 50;
      const chartHeight = exportHeight - chartStartY - 100;
      const chartWidth = exportWidth - 200;
      
      ctx.drawImage(img, 100, chartStartY, chartWidth, chartHeight);
      
      // Footer-information
      const footerY = exportHeight - 60;
      ctx.fillStyle = '#6b7280';
      ctx.font = '16px Arial, sans-serif';
      ctx.textAlign = 'center';
      
      const selectedAccountNames = chartLines.map(line => line.username);
      let accountText = '';
      if (selectedAccountNames.length === 1) {
        accountText = `Konto: ${selectedAccountNames[0]}`;
      } else if (selectedAccountNames.length <= 3) {
        accountText = `Konton: ${selectedAccountNames.join(', ')}`;
      } else {
        accountText = `${selectedAccountNames.length} konton: ${selectedAccountNames.slice(0, 2).join(', ')} med flera`;
      }
      
      const maxWidth = exportWidth - 200;
      const words = accountText.split(' ');
      let line = '';
      let y = footerY;
      
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        
        if (testWidth > maxWidth && n > 0) {
          ctx.fillText(line, exportWidth / 2, y);
          line = words[n] + ' ';
          y += 25;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, exportWidth / 2, y);
      
      // Exportera som PNG
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        const kontoSuffix = selectedAccountNames.length === 1 
          ? selectedAccountNames[0].replace(/[^a-zA-Z0-9]/g, '-')
          : `${selectedAccountNames.length}-konton`;
        a.download = `trend-analys-${selectedMetric}-${kontoSuffix}-${new Date().toISOString().slice(0, 10)}.png`;
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 'image/png', 1.0);
      
      URL.revokeObjectURL(svgUrl);
    };
    img.src = svgUrl;
  };

  // Hantera kontoval med checkboxar
  const handleAccountToggle = (accountId) => {
    setSelectedAccounts(current => 
      current.includes(accountId) 
        ? current.filter(id => id !== accountId)
        : [...current, accountId]
    );
  };

  // Hantera metric-val med radio buttons
  const handleMetricToggle = (metricKey) => {
    setSelectedMetric(metricKey);
  };

  // Hantera periodval
  const handlePeriodToggle = (period) => {
    const periodKey = `${period.year}-${period.month}`;
    setSelectedPeriods(current => {
      const exists = current.find(p => `${p.year}-${p.month}` === periodKey);
      return exists 
        ? current.filter(p => `${p.year}-${p.month}` !== periodKey)
        : [...current, period];
    });
  };

  // Beräkna om alla perioder är valda
  const allPeriodsSelected = useMemo(() => {
    return selectedPeriods.length > 0 && selectedPeriods.length === availablePeriods.length;
  }, [selectedPeriods.length, availablePeriods.length]);
  
  const handleToggleAllPeriods = () => {
    if (allPeriodsSelected) {
      setSelectedPeriods([]);
    } else {
      setSelectedPeriods(availablePeriods);
    }
  };

  // Generera linjediagram-data
  const generateChartData = useMemo(() => {
    if (!uploadedPeriods || selectedAccounts.length === 0 || selectedPeriods.length === 0) {
      return [];
    }

    const chartPoints = [];
    const periodsToShow = selectedPeriods;
    
    periodsToShow.forEach(period => {
      if (period.data && Array.isArray(period.data)) {
        selectedAccounts.forEach(accountId => {
          const csvRow = period.data.find(row => {
            const rowAccountId = row['IG ID'] || row.igId || `account_${(row.Account || row.account || '').replace(/\s+/g, '_')}`;
            return rowAccountId === accountId;
          });
          
          if (csvRow) {
            const csvColumnName = getCSVColumnName(selectedMetric);
            const rawValue = csvRow[csvColumnName];
            
            let value = 0;
            if (rawValue !== null && rawValue !== undefined && rawValue !== '') {
              const cleanValue = String(rawValue).replace(/[,\s]/g, '');
              value = parseFloat(cleanValue) || 0;
            }
            
            chartPoints.push({
              periodKey: `${period.year}-${period.month.toString().padStart(2, '0')}`,
              period: `${getMonthName(period.month)} ${period.year}`,
              month: getMonthName(period.month),
              year: period.year,
              accountId,
              username: csvRow.Account || csvRow.account || 'Okänt konto',
              value,
              metric: selectedMetric
            });
          }
        });
      }
    });

    return chartPoints;
  }, [uploadedPeriods, selectedAccounts, selectedPeriods, selectedMetric]);

  // Gruppera data per konto för linjediagram
  const chartLines = useMemo(() => {
    const groupedByAccount = new Map();
    
    generateChartData.forEach(point => {
      if (!groupedByAccount.has(point.accountId)) {
        groupedByAccount.set(point.accountId, {
          accountId: point.accountId,
          username: point.username,
          points: [],
          color: getAccountColor(point.accountId, selectedAccounts)
        });
      }
      groupedByAccount.get(point.accountId).points.push(point);
    });

    groupedByAccount.forEach(line => {
      line.points.sort((a, b) => a.periodKey.localeCompare(b.periodKey));
    });

    return Array.from(groupedByAccount.values());
  }, [generateChartData, selectedAccounts]);

  // Y-axel logik - alltid börja på 0 och visa jämna tusental
  const yAxisConfig = useMemo(() => {
    if (generateChartData.length === 0) {
      return { 
        min: 0, 
        max: 1000, 
        step: 200,
        ticks: [0, 200, 400, 600, 800, 1000]
      };
    }
    
    const values = generateChartData.map(d => d.value);
    const maxValue = Math.max(...values);
    
    let step, max;
    
    if (maxValue <= 500) {
      step = 100;
      max = Math.ceil(maxValue / step) * step;
    } else if (maxValue <= 5000) {
      step = 1000;
      max = Math.ceil(maxValue / step) * step;
    } else if (maxValue <= 50000) {
      step = 10000;
      max = Math.ceil(maxValue / step) * step;
    } else if (maxValue <= 500000) {
      step = 100000;
      max = Math.ceil(maxValue / step) * step;
    } else {
      step = 1000000;
      max = Math.ceil(maxValue / step) * step;
    }
    
    const ticks = [];
    for (let i = 0; i <= max; i += step) {
      ticks.push(i);
    }
    
    return {
      min: 0,
      max,
      step,
      ticks
    };
  }, [generateChartData]);

  // MJUK KURV-FUNKTION (Catmull-Rom spline)
  const createSmoothPath = (points) => {
    if (points.length < 2) return '';
    
    if (points.length === 2) {
      const [p1, p2] = points;
      return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
    }
    
    let path = `M ${points[0].x} ${points[0].y}`;
    
    for (let i = 1; i < points.length; i++) {
      const current = points[i];
      const previous = points[i - 1];
      
      if (i === 1) {
        const next = points[i + 1] || current;
        const cp1x = previous.x + (current.x - previous.x) * 0.3;
        const cp1y = previous.y + (current.y - previous.y) * 0.3;
        const cp2x = current.x - (next.x - previous.x) * 0.1;
        const cp2y = current.y - (next.y - previous.y) * 0.1;
        
        path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${current.x} ${current.y}`;
      } else if (i === points.length - 1) {
        const beforePrev = points[i - 2] || previous;
        const cp1x = previous.x + (current.x - beforePrev.x) * 0.1;
        const cp1y = previous.y + (current.y - beforePrev.y) * 0.1;
        const cp2x = current.x - (current.x - previous.x) * 0.3;
        const cp2y = current.y - (current.y - previous.y) * 0.3;
        
        path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${current.x} ${current.y}`;
      } else {
        const next = points[i + 1];
        const beforePrev = points[i - 2] || previous;
        const cp1x = previous.x + (current.x - beforePrev.x) * 0.1;
        const cp1y = previous.y + (current.y - beforePrev.y) * 0.1;
        const cp2x = current.x - (next.x - previous.x) * 0.1;
        const cp2y = current.y - (next.y - previous.y) * 0.1;
        
        path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${current.x} ${current.y}`;
      }
    }
    
    return path;
  };

  // Hantera mouse events för tooltip
  const handleMouseMove = (event, point) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });
    setHoveredDataPoint(point);
  };

  if (!uploadedPeriods || uploadedPeriods.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Trendanalys
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Ladda upp minst två månadsfiler för att se trendanalys.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Linjediagram-sektion */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <LineChart className="h-5 w-5" />
            Utveckling över tid
          </CardTitle>
          <div className="flex gap-2">
            <Button onClick={exportChartAsPNG} variant="outline" size="sm" disabled={chartLines.length === 0}>
              📊 Exportera PNG
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Kontroller */}
          <div className="grid md:grid-cols-3 gap-4">
            {/* Kontoval med checkboxar */}
            <div>
              <label className="text-sm font-medium mb-2 block">Välj Instagram-konton ({selectedAccounts.length} valda)</label>
              <div className="max-h-32 overflow-y-auto border rounded p-2 space-y-1">
                {availableAccounts.map(account => {
                  const isSelected = selectedAccounts.includes(account.accountId);
                  
                  return (
                    <label key={account.accountId} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleAccountToggle(account.accountId)}
                        className="h-4 w-4 text-instagram-500 border-gray-300 rounded focus:ring-instagram-500"
                      />
                      <span className="text-sm font-medium">{account.username}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Datapunkt-väljare */}
            <div>
              <label className="text-sm font-medium mb-2 block">Välj datapunkt</label>
              <div className="space-y-2">
                {ALLOWED_METRICS.map(metric => {
                  const isSelected = selectedMetric === metric.key;
                  
                  return (
                    <label key={metric.key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="metric"
                        checked={isSelected}
                        onChange={() => handleMetricToggle(metric.key)}
                        className="h-4 w-4 text-instagram-500 border-gray-300 focus:ring-instagram-500"
                      />
                      <span className="text-sm font-medium">{metric.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Periodval med "Välj alla" checkbox */}
            <div>
              <label className="text-sm font-medium mb-2 block">Välj perioder ({selectedPeriods.length} valda)</label>
              
              <label className="flex items-center gap-2 cursor-pointer mb-2 p-2 bg-gray-50 rounded">
                <input
                  type="checkbox"
                  checked={allPeriodsSelected}
                  onChange={handleToggleAllPeriods}
                  className="h-4 w-4 text-instagram-500 border-gray-300 rounded focus:ring-instagram-500"
                />
                <span className="text-sm font-medium">Välj alla perioder</span>
              </label>

              <div className="max-h-32 overflow-y-auto border rounded p-2 space-y-1">
                {availablePeriods.map(period => {
                  const isSelected = selectedPeriods.some(p => p.year === period.year && p.month === period.month);
                  
                  return (
                    <label key={`${period.year}-${period.month}`} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handlePeriodToggle(period)}
                        className="h-4 w-4 text-instagram-500 border-gray-300 rounded focus:ring-instagram-500"
                      />
                      <span className="text-sm font-medium">
                        {getMonthName(period.month)} {period.year}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* PROMINENT DATAPUNKT-VISNING */}
          {selectedMetric && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <h3 className="text-lg font-bold text-blue-900">
                Visar: {METRIC_DEFINITIONS[selectedMetric]?.displayName}
              </h3>
              <p className="text-sm text-blue-700 mt-1">
                Aktuell datapunkt som visas i diagrammet
              </p>
            </div>
          )}

          {/* Linjediagram */}
          {chartLines.length > 0 ? (
            <div className="space-y-4">
              {/* Legenda */}
              <div className="flex flex-wrap gap-3">
                {chartLines.map(line => (
                  <div key={line.accountId} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full border"
                      style={{ backgroundColor: line.color }}
                    />
                    <span className="text-sm font-medium">{line.username}</span>
                  </div>
                ))}
              </div>

              {/* SVG Diagram */}
              <div className="relative">
                <svg 
                  id="trend-chart-svg"
                  width="100%" 
                  height="500" 
                  viewBox="0 0 1000 500"
                  className="border rounded bg-gray-50"
                  onMouseLeave={() => setHoveredDataPoint(null)}
                >
                  {/* Grid-linjer */}
                  <defs>
                    <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                      <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e5e7eb" strokeWidth="1"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />

                  {/* Y-axel värden */}
                  {yAxisConfig.ticks.map(tickValue => {
                    const yPos = 450 - (tickValue / yAxisConfig.max) * 380;
                    return (
                      <g key={tickValue}>
                        <line x1="100" y1={yPos} x2="930" y2={yPos} stroke="#d1d5db" strokeWidth="1"/>
                        <text x="95" y={yPos + 4} textAnchor="end" fontSize="14" fill="#6b7280">
                          {tickValue.toLocaleString()}
                        </text>
                      </g>
                    );
                  })}

                  {/* X-axel månader */}
                  {availablePeriods.map((period, index) => {
                    const xPos = 100 + (index / Math.max(1, availablePeriods.length - 1)) * 830;
                    return (
                      <g key={`${period.year}-${period.month}`}>
                        <line x1={xPos} y1="70" x2={xPos} y2="450" stroke="#d1d5db" strokeWidth="1"/>
                        <text x={xPos} y="475" textAnchor="middle" fontSize="14" fill="#6b7280">
                          {getMonthName(period.month)}
                        </text>
                        <text x={xPos} y="490" textAnchor="middle" fontSize="12" fill="#9ca3af">
                          {period.year}
                        </text>
                      </g>
                    );
                  })}

                  {/* MJUKA KURVORNA */}
                  {chartLines.map(line => {
                    if (line.points.length < 1) return null;

                    const pathPoints = line.points.map((point, index) => {
                      const periodIndex = availablePeriods.findIndex(p => 
                        `${p.year}-${p.month.toString().padStart(2, '0')}` === point.periodKey
                      );
                      const x = 100 + (periodIndex / Math.max(1, availablePeriods.length - 1)) * 830;
                      const y = 450 - (point.value / yAxisConfig.max) * 380;
                      
                      return { x, y, point };
                    });

                    return (
                      <g key={line.accountId}>
                        {line.points.length > 1 && (
                          <path
                            d={createSmoothPath(pathPoints)}
                            fill="none"
                            stroke={line.color}
                            strokeWidth="4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        )}
                        
                        {pathPoints.map(({ x, y, point }, index) => (
                          <circle
                            key={index}
                            cx={x}
                            cy={y}
                            r="6"
                            fill={line.color}
                            stroke="white"
                            strokeWidth="3"
                            className="cursor-pointer"
                            onMouseEnter={(e) => handleMouseMove(e, point)}
                            onMouseLeave={() => setHoveredDataPoint(null)}
                          />
                        ))}
                      </g>
                    );
                  })}

                  {/* FÖRBÄTTRAD TOOLTIP */}
                  {hoveredDataPoint && (
                    <g>
                      {(() => {
                        const tooltipWidth = 200;
                        const tooltipHeight = 70;
                        let tooltipX = mousePosition.x + 15;
                        let tooltipY = mousePosition.y - 35;
                        
                        if (tooltipX + tooltipWidth > 980) {
                          tooltipX = mousePosition.x - tooltipWidth - 15;
                        }
                        
                        if (tooltipY < 15) {
                          tooltipY = mousePosition.y + 15;
                        }
                        
                        if (tooltipY + tooltipHeight > 480) {
                          tooltipY = mousePosition.y - tooltipHeight - 15;
                        }
                        
                        return (
                          <>
                            <rect
                              x={tooltipX} y={tooltipY} 
                              width={tooltipWidth} height={tooltipHeight}
                              fill="rgba(0,0,0,0.85)" rx="6"
                            />
                            <text x={tooltipX + 12} y={tooltipY + 20} fill="white" fontSize="13" fontWeight="bold">
                              {hoveredDataPoint.username}
                            </text>
                            <text x={tooltipX + 12} y={tooltipY + 38} fill="white" fontSize="12">
                              {hoveredDataPoint.period}
                            </text>
                            <text x={tooltipX + 12} y={tooltipY + 55} fill="white" fontSize="12">
                              {METRIC_DEFINITIONS[hoveredDataPoint.metric]?.displayName}: {hoveredDataPoint.value.toLocaleString()}
                            </text>
                          </>
                        );
                      })()}
                    </g>
                  )}
                </svg>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <LineChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">Välj konton och perioder för att visa diagram</p>
              <p className="text-sm">
                {selectedAccounts.length === 0 && selectedPeriods.length === 0 
                  ? "Markera minst ett Instagram-konto och en period"
                  : selectedAccounts.length === 0 
                  ? "Markera minst ett Instagram-konto i listan ovan"
                  : "Markera minst en period i listan ovan"
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TrendAnalysisView;
