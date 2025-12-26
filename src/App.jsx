import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from './components/ui/alert';
import { UploadCloud, BarChart3, TrendingUp, Calendar, Info, ArrowLeft, Trash2 } from 'lucide-react';
import TimeseriesUploader from './components/TimeseriesUploader';
import AccountTimeseriesView from './components/AccountTimeseriesView';
import MonthlyComparisonView from './components/MonthlyComparisonView';
import TrendAnalysisView from './components/TrendAnalysisView';
import { getAllPeriods, getPeriodData, clearAllData } from './utils/timeseries_storage';

function App() {
  const [hasData, setHasData] = useState(false);
  const [showUploader, setShowUploader] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');
  const [uploadedPeriods, setUploadedPeriods] = useState([]);
  const [loadingExistingData, setLoadingExistingData] = useState(true);
  const [clearingData, setClearingData] = useState(false);

  // Ladda befintlig data vid app-start
  useEffect(() => {
    loadExistingData();
  }, []);

  const loadExistingData = async () => {
    try {
      setLoadingExistingData(true);
      console.log('Laddar befintlig data från storage...');
      
      const periods = await getAllPeriods();
      console.log('Hittade perioder i storage:', periods);
      
      if (periods.length > 0) {
        // Konvertera storage-format till uploadedPeriods-format
        const periodsWithData = await Promise.all(
          periods.map(async (period) => {
            const storageData = await getPeriodData(period.year, period.month);
            
            // Konvertera från storage-format till CSV-format som komponenterna förväntar
            const csvFormatData = storageData.map(storageItem => ({
              "Account": storageItem.pageName,
              "Account ID": storageItem.pageId,
              "Reach": storageItem.metrics.reach || 0,
              "Engaged Users": storageItem.metrics.engagedUsers || 0,
              "Engagements": storageItem.metrics.engagements || 0,
              "Reactions": storageItem.metrics.reactions || 0,
              "Publications": storageItem.metrics.publications || 0,
              "Status": storageItem.metrics.status || 0,
              "Comment": storageItem.metrics.comment || 0
            }));
            
            return {
              year: period.year,
              month: period.month,
              data: csvFormatData,
              filename: `IG_${period.year}_${String(period.month).padStart(2, '0')}.csv`
            };
          })
        );
        
        console.log('Konverterade periodsWithData:', periodsWithData);
        setUploadedPeriods(periodsWithData);
        setHasData(true);
        setActiveTab('monthly');
      } else {
        console.log('Ingen befintlig data hittades');
      }
    } catch (error) {
      console.error('Kunde inte ladda befintlig data:', error);
    } finally {
      setLoadingExistingData(false);
    }
  };

  // Handler för när data har laddats upp framgångsrikt
  const handleDataUploaded = async (periodsArray) => {
    console.log('Data uploaded successfully:', periodsArray);
    
    const newPeriods = Array.isArray(periodsArray) ? periodsArray : [];
    
    // Merge med befintliga uploadedPeriods, undvik dubbletter
    const mergedPeriods = [...uploadedPeriods];
    newPeriods.forEach(newPeriod => {
      const exists = mergedPeriods.some(existing => 
        existing.year === newPeriod.year && existing.month === newPeriod.month
      );
      if (!exists) {
        mergedPeriods.push(newPeriod);
      } else {
        console.log(`Period ${newPeriod.year}-${newPeriod.month} finns redan, hoppar över dubblett`);
      }
    });
    
    console.log('Merged periods:', mergedPeriods);
    setUploadedPeriods(mergedPeriods);
    setHasData(true);
    setShowUploader(false);
    setActiveTab('monthly');
  };

  // Handler för att rensa all data
  const handleClearData = async () => {
    if (!window.confirm('Är du säker på att du vill rensa all data? Detta kan inte ångras.')) {
      return;
    }

    try {
      setClearingData(true);
      console.log('Rensar all data...');
      
      await clearAllData();
      
      setUploadedPeriods([]);
      setHasData(false); 
      setActiveTab('upload');
      
      console.log('✅ All data rensad framgångsrikt');
      
    } catch (error) {
      console.error('❌ Fel vid rensning av data:', error);
      alert(`Fel vid rensning av data: ${error.message}`);
    } finally {
      setClearingData(false);
    }
  };

  // Handler för att avbryta upload och gå tillbaka
  const handleCancelUpload = () => {
    setShowUploader(false);
  };

  if (loadingExistingData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-primary animate-pulse" />
          <h2 className="text-xl font-semibold mb-2">Instagram Page Analyzer</h2>
          <p className="text-muted-foreground">Laddar befintlig data...</p>
        </div>
      </div>
    );
  }

  if (showUploader) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border">
          <div className="container py-4">
            <div className="flex items-center justify-between">
              <div className="instagram-brand flex items-center gap-3">
                <BarChart3 className="h-8 w-8" />
                <h1 className="text-2xl font-bold text-foreground">
                  Instagram Page Analyzer
                </h1>
              </div>
              <Button variant="outline" onClick={handleCancelUpload}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Tillbaka
              </Button>
            </div>
          </div>
        </header>

        <main className="container py-6">
          <TimeseriesUploader 
            onDataUploaded={handleDataUploaded}
            onCancel={handleCancelUpload}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container py-4">
          <div className="instagram-brand flex items-center gap-3">
            <BarChart3 className="h-8 w-8" />
            <h1 className="text-2xl font-bold text-foreground">
              Instagram Page Analyzer
            </h1>
          </div>
        </div>
      </header>

      <main className="container py-6">
        <div className="space-y-6">
          {!hasData ? (
            <div className="text-center py-12">
              <UploadCloud className="mx-auto h-24 w-24 text-muted-foreground mb-6" />
              <h2 className="text-3xl font-bold tracking-tight mb-4">
                Välkommen till Instagram Page Analyzer
              </h2>
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                Analysera och visualisera dina Instagram-konton över tid. 
                Ladda upp månadsdata för att komma igång med tidserie-analys.
              </p>
              
              <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-12">
                <Card className="text-center p-6">
                  <Calendar className="mx-auto h-12 w-12 text-primary mb-4" />
                  <h3 className="font-semibold mb-2">Månadsanalys</h3>
                  <p className="text-sm text-muted-foreground">
                    Jämför prestanda mellan Instagram-konton för specifika månader
                  </p>
                </Card>
                
                <Card className="text-center p-6">
                  <TrendingUp className="mx-auto h-12 w-12 text-primary mb-4" />
                  <h3 className="font-semibold mb-2">Tidserie-analys</h3>
                  <p className="text-sm text-muted-foreground">
                    Följ utvecklingen av enskilda konton över tid
                  </p>
                </Card>
                
                <Card className="text-center p-6">
                  <BarChart3 className="mx-auto h-12 w-12 text-primary mb-4" />
                  <h3 className="font-semibold mb-2">Trend-upptäckt</h3>
                  <p className="text-sm text-muted-foreground">
                    Upptäck mönster och trender i dina Instagram-data
                  </p>
                </Card>
              </div>
              
              <Button onClick={() => setShowUploader(true)} size="lg">
                <UploadCloud className="mr-2 h-5 w-5" />
                Ladda upp Instagram-data
              </Button>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Analysera Instagram-data</h2>
                  <p className="text-muted-foreground">
                    {uploadedPeriods.length} period{uploadedPeriods.length !== 1 ? 'er' : ''} tillgänglig{uploadedPeriods.length !== 1 ? 'a' : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowUploader(true)}>
                    <UploadCloud className="mr-2 h-4 w-4" />
                    Ladda upp mer data
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={handleClearData}
                    disabled={clearingData}
                  >
                    {clearingData ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Rensar...
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Rensa data
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="upload" className="flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Info
                  </TabsTrigger>
                  <TabsTrigger value="monthly" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Månadsanalys
                  </TabsTrigger>
                  <TabsTrigger value="accounts" className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Konton över tid
                  </TabsTrigger>
                  <TabsTrigger value="trends" className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Trendanalys
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="upload" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Info className="h-5 w-5" />
                        Dataöversikt
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>Data laddad och redo</AlertTitle>
                        <AlertDescription>
                          Du har {uploadedPeriods.length} period{uploadedPeriods.length !== 1 ? 'er' : ''} av Instagram-data tillgänglig för analys. 
                          Använd flikarna ovan för att utforska dina data eller ladda upp mer data.
                        </AlertDescription>
                      </Alert>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                          <Calendar className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                          <div className="font-bold text-2xl text-blue-900">{uploadedPeriods.length}</div>
                          <div className="text-sm text-blue-700">Månader data</div>
                        </div>
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                          <BarChart3 className="w-8 h-8 mx-auto mb-2 text-green-600" />
                          <div className="font-bold text-2xl text-green-900">
                            {uploadedPeriods.reduce((total, period) => total + (period.data?.length || 0), 0)}
                          </div>
                          <div className="text-sm text-green-700">Totalt dataposter</div>
                        </div>
                        <div className="text-center p-4 bg-purple-50 rounded-lg">
                          <TrendingUp className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                          <div className="font-bold text-2xl text-purple-900">
                            {[...new Set(uploadedPeriods.flatMap(p => p.data?.map(d => d.Account || d.account) || []))].length}
                          </div>
                          <div className="text-sm text-purple-700">Unika Instagram-konton</div>
                        </div>
                      </div>

                      <p className="text-sm text-muted-foreground">
                        Data sparas automatiskt i webbläsaren och kommer att finnas kvar när du laddar om sidan.
                      </p>
                      <Button onClick={() => setShowUploader(true)}>
                        <UploadCloud className="mr-2 h-4 w-4" />
                        Ladda upp mer data
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="monthly" className="mt-6">
                  <MonthlyComparisonView uploadedPeriods={uploadedPeriods} />
                </TabsContent>

                <TabsContent value="accounts" className="mt-6">
                  <AccountTimeseriesView uploadedPeriods={uploadedPeriods} />
                </TabsContent>

                <TabsContent value="trends" className="mt-6">
                  <TrendAnalysisView uploadedPeriods={uploadedPeriods} />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-border mt-12">
        <div className="container py-4 text-center text-sm text-muted-foreground">
          <p>Instagram Page Analyzer © {new Date().getFullYear()}</p>
          <p className="mt-1">
            Tidserie-baserad analys av månadsstatistik
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
