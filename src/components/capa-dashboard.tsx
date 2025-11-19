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
import { DataTable, DataTableColumn } from './data-table';
import { CapaChart } from './capa-chart';
import { Skeleton } from './ui/skeleton';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { summarizeCapas } from '@/ai/flows/summarize-capas-flow';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';

const EXPECTED_HEADERS = ['CAPA ID', 'Title', 'Due Date', 'Deadline for effectiveness check', 'Assigned To', 'Pending Steps'];
const DATE_FORMATS = ['M/d/yyyy', 'MM/dd/yyyy', 'M-d-yyyy', 'MM-dd-yyyy', 'dd.MM.yyyy'];

const parseDate = (dateString: string): Date => {
  if (!dateString) return new Date('invalid');
  const ddMMyyyy = dateString.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (ddMMyyyy) {
    const [, day, month, year] = ddMMyyyy;
    const parsed = new Date(`${year}-${month}-${day}T00:00:00`);
    if (isValid(parsed)) return parsed;
  }

  for (const format of DATE_FORMATS) {
    const parsedDate = parse(dateString.trim(), format, new Date());
    if (isValid(parsedDate)) {
      return parsedDate;
    }
  }
  return new Date('invalid');
}

const parseCustomCSV = (text: string): string[][] => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ';' && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (i > 0 && text[i - 1] !== '\n' && text[i-1] !== '\r') {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      }
       if (char === '\r' && text[i+1] === '\n') {
         i++;
       }
    } else {
      currentField += char;
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    rows.push(currentRow);
  }

  return rows.filter(row => row.length > 1 || (row.length === 1 && row[0] !== ''));
};


export default function CapaDashboard() {
  const [capaData, setCapaData] = useState<CapaData[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [phaseFilter, setPhaseFilter] = useState<'all' | 'execution' | 'effectiveness'>('all');
  const [selectedAssignee, setSelectedAssignee] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const { toast } = useToast();

  const [columnVisibility, setColumnVisibility] = useState({
    'Title': true,
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
        const rows = parseCustomCSV(text);

        if (rows.length < 2) {
          throw new Error("File must contain a header and at least one data row.");
        }
        
        const header = rows[0].map(h => h.trim().replace(/[\uFEFF]/g, ''));
  
        const missingHeaders = EXPECTED_HEADERS.filter(h => !header.includes(h));
        if (missingHeaders.length > 0) {
          throw new Error(`File is missing required columns: ${missingHeaders.join(', ')}`);
        }
  
        const headerMap = header.reduce((acc, h, i) => ({ ...acc, [h]: i }), {} as Record<string, number>);

        const data: CapaData[] = rows.slice(1).map(row => {
            const entry: CapaData = {} as CapaData;
            EXPECTED_HEADERS.forEach(h => {
                const index = headerMap[h];
                (entry as any)[h] = row[index]?.trim() || '';
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

    let baseData = showCompleted 
      ? capaData 
      : capaData.filter(item => item['Pending Steps'] && item['Pending Steps'].trim() !== '');

    if (phaseFilter !== 'all') {
      baseData = baseData.filter(item => {
        const isEffectiveness = item['Pending Steps']?.toLowerCase().includes('effectiveness');
        return phaseFilter === 'effectiveness' ? isEffectiveness : !isEffectiveness;
      });
    }

    return baseData.map(item => {
      const isEffectivenessStep = item['Pending Steps']?.toLowerCase().includes('effectiveness');
      const dateString = isEffectivenessStep ? item['Deadline for effectiveness check'] : item['Due Date'];
      
      const effectiveDueDate = parseDate(dateString);
      
      let isOverdue = false;
      if (isValid(effectiveDueDate)) {
        isOverdue = isAfter(today, effectiveDueDate);
      }
      
      return { ...item, isOverdue, effectiveDueDate };
    });
  }, [capaData, showCompleted, phaseFilter]);

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

  const assigneeCapas = useMemo(() => {
    if (!selectedAssignee) return [];
    return filteredData.filter(item => item['Assigned To'] === selectedAssignee);
  }, [filteredData, selectedAssignee]);

  const columns: DataTableColumn<CapaData>[] = [
    { accessorKey: 'CAPA ID', header: 'CAPA ID', cell: (row) => row['CAPA ID'] },
    { 
      accessorKey: 'Title', 
      header: 'Title', 
      cell: (row) => <span className="font-medium">{row['Title']}</span>,
      visible: columnVisibility['Title'],
    },
    { 
      accessorKey: 'effectiveDueDate', 
      header: 'Effective Due Date', 
      cell: (row) => row.effectiveDueDate && isValid(row.effectiveDueDate) ? format(row.effectiveDueDate!, 'PPP') : 'Invalid Date'
    },
    { 
      accessorKey: 'Assigned To', 
      header: 'Assigned To', 
      cell: (row) => row['Assigned To'],
      visible: columnVisibility['Assigned To'],
    },
    { 
      accessorKey: 'Pending Steps', 
      header: 'Pending Steps', 
      cell: (row) => <Badge variant="secondary">{row['Pending Steps']}</Badge>,
      visible: columnVisibility['Pending Steps'],
    },
    { 
      accessorKey: 'status', 
      header: 'Status', 
      cell: (row) => row.isOverdue 
          ? <Badge variant="destructive" className="bg-accent text-accent-foreground hover:bg-accent/80">Overdue</Badge> 
          : <Badge className="bg-green-500 hover:bg-green-600 text-white border-transparent">On Time</Badge>
    },
  ];
  
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
                <CapaChart 
                    data={chartDataByAssignee} 
                    title="CAPAs by Assignee (Top 10)" 
                    dataKey="total" 
                    onBarClick={setSelectedAssignee}
                />
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
                <DataTable 
                  columns={columns} 
                  data={filteredData}
                  getRowClassName={(row) => cn(row.isOverdue && "bg-accent/20 hover:bg-accent/30")} 
                />
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
    <div className="flex flex-col">
       <div className="flex items-center gap-4 sm:gap-6">
            <RadioGroup defaultValue="all" onValueChange={(value) => setPhaseFilter(value as any)} className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="r1" />
                    <Label htmlFor="r1">All Phases</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="execution" id="r2" />
                    <Label htmlFor="r2">Execution</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="effectiveness" id="r3" />
                    <Label htmlFor="r3">Effectiveness</Label>
                </div>
            </RadioGroup>

            <div className="flex items-center gap-2">
                <Switch 
                    id="show-completed" 
                    checked={showCompleted} 
                    onCheckedChange={setShowCompleted}
                />
                <Label htmlFor="show-completed">Show Completed</Label>
            </div>

            <div className='flex items-center gap-2 ml-auto'>
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
                      checked={columnVisibility['Title']}
                      onCheckedChange={(value) => setColumnVisibility(prev => ({...prev, 'Title': !!value}))}
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
      <div className="flex-1 p-4 sm:p-6 space-y-6 pt-2">
        {isLoading ? <LoadingState /> : (capaData.length > 0 ? <MainContent /> : <EmptyState />)}
      </div>

      <Dialog open={!!selectedAssignee} onOpenChange={(open) => !open && setSelectedAssignee(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>CAPAs Assigned to {selectedAssignee}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CAPA ID</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Due Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assigneeCapas.map((capa) => (
                  <TableRow key={capa['CAPA ID']}>
                    <TableCell>{capa['CAPA ID']}</TableCell>
                    <TableCell>{capa['Title']}</TableCell>
                    <TableCell>{isValid(capa.effectiveDueDate) ? format(capa.effectiveDueDate, 'PPP') : 'Invalid Date'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
