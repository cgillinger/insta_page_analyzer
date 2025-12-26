import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Calendar,
  BarChart3,
  Loader2
} from 'lucide-react';
import Papa from 'papaparse';

// Förväntade kolumner för Instagram API CSV-filer
const EXPECTED_COLUMNS = [
  'Account', 'Account Name', 'IG ID', 'FB Page', 'Reach', 
  'Views', 'Followers', 'Status', 'Comment'
];

function TimeseriesUploader({ onDataUploaded, onCancel }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [processingStatus, setProcessingStatus] = useState({});
  const fileInputRef = useRef(null);

  // Validera filnamn enligt IG_YYYY_MM.csv format
  const validateFilename = (filename) => {
    const pattern = /^IG_(\d{4})_(\d{2})\.csv$/;
    const match = filename.match(pattern);
    
    if (!match) {
      return { 
        isValid: false, 
        error: 'Felaktigt filnamnsformat. Förväntat: IG_YYYY_MM.csv (t.ex. IG_2025_10.csv)' 
      };
    }

    const year = parseInt(match[1]);
    const month = parseInt(match[2]);

    if (month < 1 || month > 12) {
      return { 
        isValid: false, 
        error: 'Ogiltig månad. Måste vara mellan 01-12.' 
      };
    }

    if (year < 2020 || year > 2030) {
      return { 
        isValid: false, 
        error: 'Ogiltigt år. Måste vara mellan 2020-2030.' 
      };
    }

    return { 
      isValid: true, 
      year, 
      month,
      displayName: `${getMonthName(month)} ${year}`
    };
  };

  // Hjälpfunktion för månadsnamn på svenska
  const getMonthName = (month) => {
    const months = [
      'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
      'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
    ];
    return months[month - 1];
  };

  // Validera CSV-innehåll
  const validateCSVContent = (content, filename) => {
    return new Promise((resolve) => {
      Papa.parse(content, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            resolve({
              isValid: false,
              error: `CSV-parsningsfel: ${results.errors[0].message}`,
              data: null
            });
            return;
          }

          // Kontrollera kolumner
          const headers = results.meta.fields || [];
          const missingColumns = EXPECTED_COLUMNS.filter(col => !headers.includes(col));
          
          if (missingColumns.length > 0) {
            resolve({
              isValid: false,
              error: `Saknade kolumner: ${missingColumns.join(', ')}`,
              data: null
            });
            return;
          }

          // Kontrollera att det finns data
          if (results.data.length === 0) {
            resolve({
              isValid: false,
              error: 'CSV-filen innehåller ingen data',
              data: null
            });
            return;
          }

          resolve({
            isValid: true,
            data: results.data,
            accountCount: results.data.length,
            error: null
          });
        }
      });
    });
  };

  // Hantera fil-drop
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    const csvFiles = droppedFiles.filter(file => 
      file.name.toLowerCase().endsWith('.csv')
    );
    
    if (csvFiles.length !== droppedFiles.length) {
      setValidationErrors(prev => [...prev, 'Endast CSV-filer är tillåtna']);
    }
    
    if (csvFiles.length > 0) {
      addFiles(csvFiles);
    }
  };

  // Hantera fil-val
  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    addFiles(selectedFiles);
  };

  // Lägg till filer i listan
  const addFiles = (newFiles) => {
    const validatedFiles = newFiles.map(file => {
      const validation = validateFilename(file.name);
      return {
        file,
        id: Math.random().toString(36),
        name: file.name,
        size: file.size,
        validation,
        status: validation.isValid ? 'pending' : 'error'
      };
    });

    // Kontrollera dubletter
    const existingNames = files.map(f => f.name);
    const duplicates = validatedFiles.filter(f => existingNames.includes(f.name));
    
    if (duplicates.length > 0) {
      setValidationErrors(prev => [
        ...prev, 
        `Följande filer är redan valda: ${duplicates.map(d => d.name).join(', ')}`
      ]);
    }

    const uniqueFiles = validatedFiles.filter(f => !existingNames.includes(f.name));
    setFiles(prev => [...prev, ...uniqueFiles]);
  };

  // Ta bort fil från listan
  const removeFile = (fileId) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  // Behandla alla filer
  const processFiles = async () => {
    setUploading(true);
    setValidationErrors([]);
    setProcessingStatus({});

    const validFiles = files.filter(f => f.validation.isValid);
    const processedPeriods = [];

    for (const fileItem of validFiles) {
      setProcessingStatus(prev => ({ ...prev, [fileItem.id]: 'processing' }));

      try {
        // Läs filinnehåll
        const content = await readFileContent(fileItem.file);
        
        // Validera CSV-innehåll
        const validation = await validateCSVContent(content, fileItem.name);
        
        if (!validation.isValid) {
          setProcessingStatus(prev => ({ ...prev, [fileItem.id]: 'error' }));
          setValidationErrors(prev => [...prev, `${fileItem.name}: ${validation.error}`]);
          continue;
        }

        // Lägg till period-info
        const periodData = {
          ...fileItem.validation,
          data: validation.data,
          accountCount: validation.accountCount,
          filename: fileItem.name
        };

        processedPeriods.push(periodData);
        setProcessingStatus(prev => ({ ...prev, [fileItem.id]: 'success' }));

        // Simulera bearbetning (ta bort i produktion)
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        setProcessingStatus(prev => ({ ...prev, [fileItem.id]: 'error' }));
        setValidationErrors(prev => [...prev, `${fileItem.name}: ${error.message}`]);
      }
    }

    setUploading(false);

    // Om någon fil behandlades framgångsrikt, rapportera tillbaka
    if (processedPeriods.length > 0) {
      onDataUploaded(processedPeriods);
    }
  };

  // Läs fil-innehåll
  const readFileContent = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Kunde inte läsa fil'));
      reader.readAsText(file);
    });
  };

  // Hantera drag events
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  // Rensa fel
  const clearErrors = () => {
    setValidationErrors([]);
  };

  // Räkna giltiga filer
  const validFilesCount = files.filter(f => f.validation.isValid).length;
  const hasValidFiles = validFilesCount > 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-instagram-500" />
            Ladda upp Instagram CSV-filer
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Släpp dina IG_YYYY_MM.csv filer här eller klicka för att välja filer
          </p>
        </CardHeader>
        <CardContent>
          {/* Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              dragActive 
                ? 'border-instagram-400 bg-instagram-50' 
                : 'border-gray-300 hover:border-instagram-400 hover:bg-instagram-50'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              accept=".csv"
              className="hidden"
            />
            
            <Upload className="h-12 w-12 mx-auto mb-4 text-instagram-400" />
            <h3 className="text-lg font-semibold mb-2">
              {dragActive ? 'Släpp filerna här' : 'Ladda upp CSV-filer'}
            </h3>
            <p className="text-muted-foreground mb-4">
              Släpp dina IG_YYYY_MM.csv filer här eller klicka för att välja
            </p>
            
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Format:</strong> IG_YYYY_MM.csv (t.ex. IG_2025_10.csv)</p>
              <p><strong>Kolumner:</strong> {EXPECTED_COLUMNS.join(', ')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fel-meddelanden */}
      {validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Valideringsfel</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1">
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
            <Button variant="outline" size="sm" onClick={clearErrors} className="mt-2">
              Rensa fel
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Fil-lista */}
      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Valda filer ({files.length})</span>
              <div className="text-sm text-muted-foreground">
                {validFilesCount} giltiga filer
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {files.map((fileItem) => {
                const status = processingStatus[fileItem.id] || fileItem.status;
                
                return (
                  <div
                    key={fileItem.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      fileItem.validation.isValid 
                        ? 'border-green-200 bg-green-50' 
                        : 'border-red-200 bg-red-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4" />
                      <div>
                        <div className="font-medium">{fileItem.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {fileItem.validation.isValid ? (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {fileItem.validation.displayName}
                            </span>
                          ) : (
                            <span className="text-red-600">{fileItem.validation.error}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {status === 'processing' && (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                      )}
                      {status === 'success' && (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                      {status === 'error' && (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(fileItem.id)}
                        disabled={uploading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kontroll-knappar */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onCancel} disabled={uploading}>
          Avbryt
        </Button>
        
        <div className="flex gap-2">
          {files.length > 0 && (
            <Button 
              variant="outline" 
              onClick={() => setFiles([])}
              disabled={uploading}
            >
              Rensa alla
            </Button>
          )}
          
          <Button
            onClick={processFiles}
            disabled={!hasValidFiles || uploading}
            className="min-w-[120px]"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Bearbetar...
              </>
            ) : (
              <>
                <BarChart3 className="mr-2 h-4 w-4" />
                Analysera data ({validFilesCount})
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default TimeseriesUploader;
