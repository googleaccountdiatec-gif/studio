"use client";

import React, { ChangeEvent, useState, DragEvent } from 'react';
import { useData } from '@/contexts/data-context';
import { useToast } from "@/hooks/use-toast";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const [isDragging, setIsDragging] = useState(false);

  const processFiles = (files: FileList) => {
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
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      processFiles(event.target.files);
      event.target.value = '';
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  };

  return (
    <div 
        className={cn(
            "flex items-center gap-2 ml-auto relative transition-all duration-200",
            isDragging && "scale-105"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
    >
        <Label 
            htmlFor="multi-csv-upload" 
            className={cn(
                "flex items-center justify-center gap-2 px-4 py-2 rounded-lg border cursor-pointer text-sm font-medium transition-colors",
                "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20",
                isDragging && "bg-primary/30 border-primary ring-2 ring-primary/50"
            )}
        >
            <UploadCloud className="h-4 w-4" />
            {isDragging ? "Drop files here!" : "Upload Files"}
        </Label>
        <Input 
            id="multi-csv-upload" 
            type="file" 
            accept=".csv,.tsv,.txt" 
            onChange={handleFileChange}
            multiple
            className="hidden" 
        />
    </div>
  );
}
