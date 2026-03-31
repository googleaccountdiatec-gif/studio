"use client";

import React, { ChangeEvent, useState, DragEvent } from 'react';
import { useData } from '@/contexts/data-context';
import { useToast } from "@/hooks/use-toast";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';

// Robust CSV Parser with Auto-Detection and Quoted Field Support
const parseCustomCSV = (text: string): string[][] => {
  // Strip UTF-8 BOM (appears as ï»¿ when read with latin1 encoding, or \uFEFF with utf-8)
  text = text.replace(/^\uFEFF/, '').replace(/^\xEF\xBB\xBF/, '');

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  // 1. Auto-detect delimiter based on the first line
  const firstLine = text.split('\n')[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  
  let delimiter = ';'; // Default
  if (commaCount > semicolonCount && commaCount > tabCount) delimiter = ',';
  else if (tabCount > semicolonCount && tabCount > commaCount) delimiter = '\t';

  // 2. State Machine Parser
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Handle escaped quotes ("") -> become a single quote (")
        currentField += '"';
        i++; // Skip the next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      // Field separator (only if NOT in quotes)
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      // Row separator (only if NOT in quotes)
      if (currentField.length > 0 || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        if (currentRow.length > 0) { // Only add non-empty rows
             rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      }
      // Handle CRLF (\r\n) by skipping the next char if it's \n
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
    } else {
      // Regular character
      currentField += char;
    }
  }

  // Add the very last field/row if the file doesn't end with a newline
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.length > 0) {
        rows.push(currentRow);
    }
  }

  return rows;
};

// Improved file identification using 'includes'
const fileIdentifier = (filename: string): 'capa' | 'change-action' | 'non-conformance' | 'training' | 'batch-release' | 'document-kpi' | 'unknown' => {
  const name = filename.trim().toLowerCase();
  
  if (name.includes('document') && name.includes('kpi')) return 'document-kpi';
  if (name.includes('capa')) return 'capa';
  if (name.includes('change') && name.includes('action')) return 'change-action';
  if (name.includes('non-conformance')) return 'non-conformance';
  if (name.includes('training')) return 'training';
  if (name.includes('batch') && name.includes('release')) return 'batch-release';
  
  return 'unknown';
}

export function MultiUploader() {
  const { setCapaData, setChangeActionData, setNonConformanceData, setTrainingData, setBatchReleaseData, setDocumentKpiData } = useData();
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);

  const processFiles = (files: FileList) => {
    if (!files || files.length === 0) return;

    let processedCount = 0;
    let errors = 0;
    const totalFiles = files.length;
    
    Array.from(files).forEach(file => {
      const type = fileIdentifier(file.name);
      
      if (type === 'unknown') {
        toast({ variant: "destructive", title: "Unknown File Type", description: `Could not identify the file "${file.name}". Please check the filename.` });
        processedCount++;
        errors++;
        return;
      }
      
      const reader = new FileReader();
      
      reader.onload = (e) => {
        processedCount++;
        try {
          const text = e.target?.result as string;
          const rows = parseCustomCSV(text);
          
          if (rows.length < 2) {
             throw new Error("File appears empty or missing a header row.");
          }
          
          const header = rows[0].map(h => h.trim()); 
          const data = rows.slice(1).map(row => {
            const entry: Record<string, string> = {};
            header.forEach((h, i) => { 
                // Robustly handle potential undefined columns if row length < header length
                const val = row[i];
                entry[h] = val ? val.trim() : ''; 
            });
            return entry;
          });

          if (data.length === 0) {
             throw new Error("No valid data rows found after parsing.");
          }

          switch (type) {
            case 'capa': setCapaData(data); break;
            case 'change-action': setChangeActionData(data); break;
            case 'non-conformance': setNonConformanceData(data); break;
            case 'training': setTrainingData(data); break;
            case 'batch-release': setBatchReleaseData(data); break;
            case 'document-kpi': setDocumentKpiData(data); break;
          }

        } catch (error) {
          errors++;
          const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
          console.error(`Error parsing ${file.name}:`, error);
          toast({ variant: "destructive", title: `Error Parsing ${file.name}`, description: errorMessage });
        } finally {
             if (processedCount === totalFiles) {
                 if (errors === 0) {
                     toast({ title: "Upload Complete", description: `Successfully processed ${totalFiles} file(s).` });
                 } else if (errors < totalFiles) {
                     toast({ title: "Upload Completed with Errors", description: `Processed ${totalFiles - errors} files. ${errors} failed.` });
                 }
             }
        }
      };
      
      reader.onerror = () => {
          processedCount++;
          errors++;
          toast({ variant: "destructive", title: "Read Error", description: `Failed to read file "${file.name}".` });
      };

      reader.readAsText(file, 'utf-8');
    });
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      processFiles(event.target.files);
      event.target.value = '';
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
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
