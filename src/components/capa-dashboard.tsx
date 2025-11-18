"use client";

import React, { useState, useMemo, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar as CalendarIcon, FileUp, Users, AlertTriangle, CheckCircle, ListTodo, Columns, Sparkles } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { format, isAfter, parse, isValid, startOfDay } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import type { CapaData } from '@/lib/types';
import { KpiCard } from './kpi-card';
import { CapaDataTable } from './capa-data-table';
import { CapaChart } from './capa-chart';
import { Skeleton } from './ui/skeleton';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { summarizeCapas } from '@/ai/flows/summarize-capas-flow';

const EXPECTED_HEADERS = ['CAPA ID', 'Tittle', 'Due Date', 'Deadline for effectiveness check', 'Assigned To', 'Pending Steps'];
const DATE_FORMATS = ['M/d/yyyy', 'MM/dd/yyyy', 'M-d-yyyy', 'MM-dd-yyyy', 'dd.MM.yyyy'];

const parseDate = (dateString: string): Date => {
  if (!dateString) return new Date('invalid');
  for (const format of DATE_FORMATS) {
    const parsedDate = parse(dateString.trim(), format, new Date());
    if (isValid(parsedDate)) {
      return parsedDate;
    }
  }
  return new Date('invalid');
}

export default function CapaDashboard() {
  const [capaData, setCapaData] = useState<CapaData[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const { toast } = useToast();

  const [columnVisibility, setColumnVisibility] = useState({
    'Tittle': true,
    'Assigned To': true,
    'Pending Steps': true,
  });
  
  const handleSummarize = async () => {
    setIsSummarizing(true);
    setSummary(null);
    try {
      const result = await summarizeCapas(filteredData);
      setSummary(result.summary);
    } catch (error) {
      console.error("Error summarizing CAPA data:", error);
      toast({
        variant: "destructive",
        title: "AI Summarization Error",
        description: "There was an error generating the summary.",
      });
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setSummary(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        toast({
          variant: "destructive",
          title: "Error Reading File",
          description: "Could not read the uploaded file.",
        });
        setIsLoading(false);
        return;
      }
      
      try {
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        const header = rows[0].split('\t').map(h => h.trim());
  
        const missingHeaders = EXPECTED_HEADERS.filter(h => !header.includes(h));
        if (missingHeaders.length > 0) {
          throw new Error(`File is missing required columns: ${missingHeaders.join(', ')}`);
        }
  
        const data: CapaData[] = rows.slice(1).map(row => {
          const values = row.split('\t');
          const entry: CapaData = {} as CapaData;
          header.forEach((h, i) => {
            (entry as any)[h] = values[i]?.trim() || '';
          });
          return entry;
        });
  
        setCapaData(data);
        toast({
          title: "Success",
          description: `Successfully imported ${data.length} CAPA records.`,
        });
      } catch (error) {
        let errorMessage = "An unknown error occurred during parsing.";
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        toast({
          variant: "destructive",
          title: "File Parsing Error",
          description: errorMessage,
        });
        setCapaData([]);
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const processedData = useMemo(() => {
    const today = startOfDay(new Date());

    return capaData.map(item => {
      const isEffectivenessStep = item['Pending Steps']?.toLowerCase().includes('effectiveness');
      const dateString = isEffectivenessStep ? item['Deadline for effectiveness check'] : item['Due Date'];
      
      const effectiveDueDate = parseDate(dateString);
      
      let isOverdue = false;
      if (isValid(effectiveDueDate)) {
        isOverdue = isAfter(today, effectiveDueDate);
      }
      
      return { ...item, isOverdue, effectiveDueDate };
    });
  }, [capaData]);

  const filteredData = useMemo(() => {
    if (!dateRange?.from) {
      return processedData;
    }
    const fromDate = startOfDay(dateRange.from);
    const toDate = dateRange.to ? startOfDay(dateRange.to) : fromDate;
    
    return processedData.filter(item => {
      if (!item.effectiveDueDate || !isValid(item.effectiveDueDate)) return false;
      return item.effectiveDueDate >= fromDate && item.effectiveDueDate <= toDate;
    });
  }, [processedData, dateRange]);


  const kpiValues = useMemo(() => {
    const dataToUse = filteredData;
    const overdueCount = dataToUse.filter(item => item.isOverdue).length;
    const totalCount = dataToUse.length;
    const onTimePercentage = totalCount > 0 ? ((totalCount - overdueCount) / totalCount * 100).toFixed(1) : '0.0';
    return { overdueCount, totalCount, onTimePercentage };
  }, [filteredData]);
  
  const chartDataByStatus = useMemo(() => {
    const overdue = kpiValues.overdueCount;
    const onTime = kpiValues.totalCount - overdue;
    return [
      { name: "On Time", status: onTime },
      { name: "Overdue", status: overdue }
    ];
  }, [kpiValues]);

  const chartDataByAssignee = useMemo(() => {
    const assigneeCounts: { [key: string]: number } = {};
    filteredData.forEach(item => {
      const assignee = item['Assigned To'];
      if(assignee) {
        assigneeCounts[assignee] = (assigneeCounts[assignee] || 0) + 1;
      }
    });
    return Object.entries(assigneeCounts)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10); // Show top 10 assignees
  }, [filteredData]);
  
  const MainContent = () => (
    <>
        {(isSummarizing || summary) && (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Sparkles className="text-primary" />
                        AI Summary
                    </CardTitle>
                    <CardDescription>
                        An AI-generated overview of the current CAPA data.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isSummarizing ? (
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-3/4" />
                        </div>
                    ) : (
                        <p className="text-sm">{summary}</p>
                    )}
                </CardContent>
            </Card>
        )}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KpiCard title="Total CAPAs" value={kpiValues.totalCount} icon={ListTodo} description={dateRange?.from ? "In selected date range" : "From imported file"}/>
            <KpiCard title="Overdue CAPAs" value={kpiValues.overdueCount} icon={AlertTriangle} description={`${(kpiValues.totalCount > 0 ? (kpiValues.overdueCount / kpiValues.totalCount * 100).toFixed(1) : 0)}% of total`}/>
            <KpiCard title="On Time Rate" value={`${kpiValues.onTimePercentage}%`} icon={CheckCircle} description="CAPAs completed on schedule" />
            <KpiCard title="Unique Assignees" value={Object.keys(chartDataByAssignee.reduce((acc, item) => { if(item.name) acc[item.name] = true; return acc; }, {} as Record<string, boolean>)).length} icon={Users} description="People with assigned CAPAs"/>
        </div>

        <div className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
                <CapaChart data={chartDataByAssignee} title="CAPAs by Assignee (Top 10)" dataKey="total" />
            </div>
            <div className="lg:col-span-2">
                <CapaChart data={chartDataByStatus} title="CAPA Status Overview" dataKey="status" />
            </div>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>CAPA Details</CardTitle>
            </CardHeader>
            <CardContent>
                <CapaDataTable data={filteredData} columnVisibility={columnVisibility} />
            </CardContent>
        </Card>
    </>
  );

  const LoadingState = () => (
    <div className="space-y-6 animate-pulse">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
        </div>
        <div className="grid gap-4 lg:grid-cols-5">
            <Skeleton className="h-96 lg:col-span-3" />
            <Skeleton className="h-96 lg:col-span-2" />
        </div>
        <Skeleton className="h-96" />
    </div>
  );

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center text-center py-20 px-4 rounded-lg border-2 border-dashed border-muted-foreground/30">
        <FileUp className="h-16 w-16 text-muted-foreground mb-4"/>
        <h2 className="text-2xl font-semibold mb-2">Upload Your CAPA Data</h2>
        <p className="text-muted-foreground mb-6 max-w-md">Click the "Choose file" button to upload a .csv or .tsv file and start visualizing your Corrective and Preventive Actions.</p>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 sm:px-6">
        <h1 className="text-xl font-semibold tracking-tight text-primary">CAPA Insights</h1>
        <div className="ml-auto flex items-center gap-2 sm:gap-4">
            <div className='flex items-center gap-2'>
                <Label htmlFor="capa-csv" className="sr-only">Upload CSV</Label>
                <Input id="capa-csv" type="file" accept=".csv,.tsv,.txt" onChange={handleFileUpload} className="w-full max-w-[150px] sm:max-w-xs text-sm file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
            </div>
            
            <Button
                variant="outline"
                onClick={handleSummarize}
                disabled={isLoading || isSummarizing || capaData.length === 0}
            >
                <Sparkles className="mr-2 h-4 w-4" />
                {isSummarizing ? "Summarizing..." : "Summarize with AI"}
            </Button>

            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className="w-[200px] sm:w-[300px] justify-start text-left font-normal"
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (
                            dateRange.to ? (
                                <>
                                    {format(dateRange.from, "LLL dd, y")} -{" "}
                                    {format(dateRange.to, "LLL dd, y")}
                                </>
                            ) : (
                                format(dateRange.from, "LLL dd, y")
                            )
                        ) : (
                            <span>Filter by date...</span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange?.from}
                        selected={dateRange}
                        onSelect={setDateRange}
                        numberOfMonths={2}
                    />
                </PopoverContent>
            </Popover>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                  <Button variant="outline" className='hidden sm:inline-flex'><Columns className="mr-2 h-4 w-4" /> View</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                  <DropdownMenuCheckboxItem
                      checked={columnVisibility['Tittle']}
                      onCheckedChange={(value) => setColumnVisibility(prev => ({...prev, 'Tittle': !!value}))}
                  >
                      Title
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                      checked={columnVisibility['Assigned To']}
                      onCheckedChange={(value) => setColumnVisibility(prev => ({...prev, 'Assigned To': !!value}))}
                  >
                      Assigned To
                  </DropdownMenuCheckboxItem>
                   <DropdownMenuCheckboxItem
                      checked={columnVisibility['Pending Steps']}
                      onCheckedChange={(value) => setColumnVisibility(prev => ({...prev, 'Pending Steps': !!value}))}
                  >
                      Pending Steps
                  </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>

        </div>
      </header>
      <main className="flex-1 p-4 sm:p-6 space-y-6">
        {isLoading ? <LoadingState /> : (capaData.length > 0 ? <MainContent /> : <EmptyState />)}
      </main>
    </div>
  );
}

    