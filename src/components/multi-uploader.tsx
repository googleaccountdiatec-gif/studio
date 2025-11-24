"use client";

import React, { ChangeEvent } from 'react';
import { useData } from '@/contexts/data-context';
import { useToast } from "@/hooks/use-toast";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Re-using the parsers. Ideally, these would be in a central `lib/parsers.ts` file.
const parseCustomCSV = (text: string): string[][] => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') { currentField += '"'; i++; } else { inQuotes = !inQuotes; }
    } else if (char === ';' && !inQuotes) {
      currentRow.push(currentField.trim()); currentField = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (currentField || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0] !== '')) rows.push(currentRow);
        currentRow = []; currentField = '';
      }
      if (char === '\r' && text[i + 1] === '\n') i++;
    } else {
      currentField += char;
    }
  }
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0] !== '')) rows.push(currentRow);
  }
  return rows.filter(row => row.length > 1 || (row.length === 1 && row[0] !== ''));
};

const fileIdentifier = (filename: string): 'capa' | 'change-action' | 'non-conformance' | 'training' | 'batch-release' | 'unknown' => {
  const lowerFilename = filename.toLowerCase();
  if (lowerFilename.startsWith('capa')) return 'capa';
  if (lowerFilename.startsWith('change - actions required')) return 'change-action';
  if (lowerFilename.startsWith('non-conformance kpis')) return 'non-conformance';
  if (lowerFilename.startsWith('training kpi')) return 'training';
  if (lowerFilename.startsWith('batch release kpi')) return 'batch-release';
  return 'unknown';
}

export function MultiUploader() {
  const { setCapaData, setChangeActionData, setNonConformanceData, setTrainingData, setBatchReleaseData } = useData();
  const { toast } = useToast();

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    let successCount = 0;
    
    Array.from(files).forEach(file => {
      const type = fileIdentifier(file.name);
      if (type === 'unknown') {
        toast({ variant: "destructive", title: "Unknown File Type", description: `Could not identify the file "${file.name}".` });
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const rows = parseCustomCSV(text);
          if (rows.length < 2) throw new Error("File must have a header and at least one data row.");
          
          const header = rows[0].map(h => h.trim().replace(/"/g, ''));
          const data = rows.slice(1).map(row => {
            const entry: any = {};
            header.forEach((h, i) => { entry[h] = row[i]?.trim().replace(/"/g, '') || ''; });
            return entry;
          });

          switch (type) {
            case 'capa': setCapaData(data); break;
            case 'change-action': setChangeActionData(data); break;
            case 'non-conformance': setNonConformanceData(data); break;
            case 'training': setTrainingData(data); break;
            case 'batch-release': setBatchReleaseData(data); break;
          }
          successCount++;
          if(successCount === files.length) {
             toast({ title: "Upload Complete", description: `Successfully processed ${successCount} file(s).` });
          }

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
          toast({ variant: "destructive", title: `Error Parsing ${file.name}`, description: errorMessage });
        }
      };
      reader.readAsText(file, 'latin1');
    });

    event.target.value = '';
  };

  return (
    <div className='flex items-center gap-2 ml-auto'>
        <Label htmlFor="multi-csv-upload" className="sr-only">Upload Files</Label>
        <Input 
            id="multi-csv-upload" 
            type="file" 
            accept=".csv,.tsv,.txt" 
            onChange={handleFileUpload}
            multiple
            className="w-full max-w-[150px] sm:max-w-xs text-sm file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" 
        />
    </div>
  );
}
