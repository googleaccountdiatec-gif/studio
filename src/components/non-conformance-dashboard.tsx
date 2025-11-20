"use client";

import React, { useState, useMemo, ChangeEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileUp } from 'lucide-react';
import { format, parse, isValid, getQuarter } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from './ui/skeleton';
import { DataTable, DataTableColumn } from './data-table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

const EXPECTED_HEADERS = ["Id", "Non Conformance Title", "Classification", "Pending Steps", "Case Worker", "Deadline for Investigation and Action Plan", "Registration Time", "Registered By", "Reoccurrence"];

interface NonConformanceData {
  Id: string;
  "Non Conformance Title": string;
  Classification: "Low risk" | "High risk" | string;
  "Pending Steps": string;
  "Case Worker": string;
  "Deadline for Investigation and Action Plan": string;
  "Registration Time": string;
  "Registered By": string;
  Reoccurrence: "YES" | "NO" | string;
  registrationDate: Date;
}

const parseDate = (dateString: string): Date => {
  if (!dateString) return new Date('invalid');
  const formats = ["dd/MM/yyyy hh:mm a", "dd/MM/yyyy H:mm", "dd/MM/yyyy"];
  for (const fmt of formats) {
    const parsed = parse(dateString.trim(), fmt, new Date());
    if (isValid(parsed)) return parsed;
  }
  const isoParsed = new Date(dateString);
  if (isValid(isoParsed)) return isoParsed;

  return new Date('invalid');
};

const parseCustomCSV = (text: string): string[][] => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        currentField += '"'; i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ';' && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (currentField || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0] !== '')) {
            rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      }
      if (char === '\r' && text[i + 1] === '\n') i++;
    } else {
      currentField += char;
    }
  }
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0] !== '')) {
        rows.push(currentRow);
      }
  }
  return rows.filter(row => row.length > 1 || (row.length === 1 && row[0] !== ''));
};

export default function NonConformanceDashboard() {
  const [data, setData] = useState<NonConformanceData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [yearFilter, setYearFilter] = useState<'all' | 'current' | 'previous'>('all');
  const [dialogData, setDialogData] = useState<{ title: string; data: NonConformanceData[] } | null>(null);
  const { toast } = useToast();

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        toast({ variant: "destructive", title: "Error Reading File", description: "Could not read the uploaded file." });
        setIsLoading(false);
        return;
      }

      try {
        const rows = parseCustomCSV(text);
        if (rows.length < 2) throw new Error("File must have a header and at least one data row.");
        
        const header = rows[0].map(h => h.trim().replace(/"/g, ''));
        const missingHeaders = EXPECTED_HEADERS.filter(h => !header.includes(h));
        if (missingHeaders.length > 0) throw new Error(`File is missing required columns: ${missingHeaders.join(', ')}`);
        
        const headerMap = header.reduce((acc, h, i) => ({ ...acc, [h]: i }), {} as Record<string, number>);

        const parsedData: NonConformanceData[] = rows.slice(1).map(row => {
          const entry: any = {};
          EXPECTED_HEADERS.forEach(h => {
              const index = headerMap[h];
              entry[h] = row[index]?.trim().replace(/"/g, '') || '';
          });
          return entry;
        });

        setData(parsedData as any[]);
        toast({ title: "Success", description: `Successfully imported ${parsedData.length} records.` });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        toast({ variant: "destructive", title: "File Parsing Error", description: errorMessage });
        setData([]);
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsText(file, 'latin1');
    event.target.value = '';
  };


  const allDataWithDates = useMemo(() => data.map(item => ({
    ...item,
    registrationDate: parseDate(item["Registration Time"]),
  })), [data]);

  const quarterlyData = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;
    const years = [previousYear, currentYear];
    const quarters = [1, 2, 3, 4];

    const aggregated: { [key: string]: { lowRisk: number; highRisk: number; total: number; reoccurring: number; records: NonConformanceData[] } } = {};

    years.forEach(year => {
      quarters.forEach(q => {
        const key = `${year}-Q${q}`;
        aggregated[key] = { lowRisk: 0, highRisk: 0, total: 0, reoccurring: 0, records: [] };
      });
    });
    
    allDataWithDates.forEach(item => {
      if (!isValid(item.registrationDate)) return;
      const year = item.registrationDate.getFullYear();
      const quarter = getQuarter(item.registrationDate);
      const key = `${year}-Q${quarter}`;
      
      if (aggregated[key]) {
        aggregated[key].total++;
        aggregated[key].records.push(item);
        if (item.Classification === 'Low risk') aggregated[key].lowRisk++;
        if (item.Classification === 'High risk') aggregated[key].highRisk++;
        if (item.Reoccurrence === 'YES') aggregated[key].reoccurring++;
      }
    });

    return Object.entries(aggregated).map(([key, value]) => ({ name: key, ...value }));
  }, [allDataWithDates]);
  
  const filteredChartData = useMemo(() => {
    if (yearFilter === 'all') return quarterlyData;
    const targetYear = yearFilter === 'current' ? new Date().getFullYear() : new Date().getFullYear() - 1;
    return quarterlyData.filter(q => q.name.startsWith(String(targetYear)));
  }, [quarterlyData, yearFilter]);


  const handleBarClick = (payload: any) => {
    if (!payload || !payload.activePayload || !payload.activePayload[0]) return;
    const quarterName = payload.activePayload[0].payload.name;
    const seriesName = payload.activePayload[0].name;
    
    const quarterInfo = quarterlyData.find(q => q.name === quarterName);
    if (!quarterInfo) return;

    let recordsToShow = quarterInfo.records;
    let title = `${seriesName} NCs for ${quarterName}`;

    if (seriesName === "Low Risk") {
      recordsToShow = quarterInfo.records.filter(r => r.Classification === "Low risk");
    } else if (seriesName === "High Risk") {
       recordsToShow = quarterInfo.records.filter(r => r.Classification === "High risk");
    } else if (seriesName === "Reoccurring") {
       recordsToShow = quarterInfo.records.filter(r => r.Reoccurrence === "YES");
       title = `Reoccurring NCs for ${quarterName}`;
    }
    
    setDialogData({ title, data: recordsToShow });
  };
  
  const detailColumns: DataTableColumn<NonConformanceData>[] = [
    { accessorKey: 'Id', header: 'ID', cell: (row) => row.Id },
    { accessorKey: 'Non Conformance Title', header: 'Title', cell: (row) => row["Non Conformance Title"] },
    { accessorKey: 'Registered By', header: 'Registered By', cell: (row) => row["Registered By"] },
    { accessorKey: 'Registration Time', header: 'Registration Time', cell: (row) => row["Registration Time"] },
    { accessorKey: 'Classification', header: 'Classification', cell: (row) => row.Classification },
    { accessorKey: 'Reoccurrence', header: 'Reoccurrence', cell: (row) => row.Reoccurrence },
  ];

  const MainContent = () => (
    <div className="space-y-6">
       <Card>
        <CardHeader>
          <CardTitle>Risk & Total Volume Overview</CardTitle>
          <CardDescription>Low risk, high risk, and total non-conformances per quarter.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={filteredChartData} onClick={handleBarClick}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="lowRisk" name="Low Risk" fill="hsl(var(--chart-2))" cursor="pointer" />
              <Bar dataKey="highRisk" name="High Risk" fill="hsl(var(--chart-5))" cursor="pointer" />
              <Bar dataKey="total" name="Total NCs" fill="hsl(var(--chart-1))" cursor="pointer" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
          <CardHeader>
            <CardTitle>Reoccurrence Trend</CardTitle>
             <CardDescription>Count of reoccurring non-conformances per quarter.</CardDescription>
          </CardHeader>
          <CardContent>
             <ResponsiveContainer width="100%" height={350}>
                 <LineChart data={filteredChartData} onClick={handleBarClick}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="reoccurring" name="Reoccurring" stroke="hsl(var(--chart-1))" strokeWidth={2} cursor="pointer" />
                 </LineChart>
            </ResponsiveContainer>
          </CardContent>
      </Card>
    </div>
  );

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center text-center py-20 px-4 rounded-lg border-2 border-dashed border-muted-foreground/30">
      <FileUp className="h-16 w-16 text-muted-foreground mb-4"/>
      <h2 className="text-2xl font-semibold mb-2">Upload Your Non-Conformance Data</h2>
      <p className="text-muted-foreground mb-6 max-w-md">Click the "Choose file" button to upload a .csv file to visualize your Non-Conformances.</p>
    </div>
  );
  
   const LoadingState = () => (
    <div className="space-y-6 animate-pulse">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <RadioGroup value={yearFilter} onValueChange={(value) => setYearFilter(value as any)} className="flex items-center gap-4">
            <Label>Year:</Label>
             <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="year-all" />
                <Label htmlFor="year-all">All Years</Label>
            </div>
            <div className="flex items-center space-x-2">
                <RadioGroupItem value="current" id="year-current" />
                <Label htmlFor="year-current">Current Year</Label>
            </div>
            <div className="flex items-center space-x-2">
                <RadioGroupItem value="previous" id="year-previous" />
                <Label htmlFor="year-previous">Previous Year</Label>
            </div>
        </RadioGroup>
        <div className='flex items-center gap-2 ml-auto'>
            <Label htmlFor="nc-csv" className="sr-only">Upload CSV</Label>
            <Input id="nc-csv" type="file" accept=".csv,.tsv,.txt" onChange={handleFileUpload} className="w-full max-w-[150px] sm:max-w-xs text-sm file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
        </div>
      </div>
      {isLoading ? <LoadingState /> : (data.length > 0 ? <MainContent /> : <EmptyState />)}

      <Dialog open={!!dialogData} onOpenChange={(open) => !open && setDialogData(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{dialogData?.title}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <DataTable
              columns={detailColumns}
              data={dialogData?.data || []}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
