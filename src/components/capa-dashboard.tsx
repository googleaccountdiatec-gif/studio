"use client";

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
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
import { getProductionTeam } from '@/lib/teams';
import { useData } from '@/contexts/data-context';


const DATE_FORMATS = [
  'dd/MM/yyyy', 
  'd/M/yyyy',
  'dd.MM.yyyy', 
  'd.M.yyyy',
  'yyyy-MM-dd',
  // US formats moved to the bottom as fallbacks
  'M/d/yyyy', 
  'MM/dd/yyyy', 
  'M-d-yyyy', 
  'MM-dd-yyyy',
];

const parseDate = (dateString: string): Date => {
  if (!dateString) return new Date('invalid');
  
  // Clean the string: remove invisible characters, trim whitespace
  const cleanString = dateString.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();

  // Specific handling for DD.MM.YYYY (very common in your files) to avoid ambiguity
  const ddMMyyyy = cleanString.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (ddMMyyyy) {
    const [, day, month, year] = ddMMyyyy;
    const parsed = new Date(`${year}-${month}-${day}T00:00:00`);
    if (isValid(parsed)) return parsed;
  }

  // Try parsing with date-fns
  for (const formatStr of DATE_FORMATS) {
    const parsedDate = parse(cleanString, formatStr, new Date());
    if (isValid(parsedDate)) {
      return parsedDate;
    }
  }

  // Fallback: Try native Date parsing (good for ISO strings)
  const nativeDate = new Date(cleanString);
  if (isValid(nativeDate)) return nativeDate;

  return new Date('invalid');
}

export default function CapaDashboard() {
  const { capaData } = useData();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [phaseFilter, setPhaseFilter] = useState<'all' | 'execution' | 'effectiveness'>('all');
  const [teamFilter, setTeamFilter] = useState<'all' | 'production'>('all');
  const [selectedAssignee, setSelectedAssignee] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const { toast } = useToast();
  const productionTeam = getProductionTeam();

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
    
    if (teamFilter === 'production') {
      baseData = baseData.filter(item => productionTeam.includes(item['Assigned To']));
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
  }, [capaData, showCompleted, phaseFilter, teamFilter, productionTeam]);

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

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center text-center py-20 px-4 rounded-lg border-2 border-dashed border-muted-foreground/30">
        <FileUp className="h-16 w-16 text-muted-foreground mb-4"/>
        <h2 className="text-2xl font-semibold mb-2">Upload Your CAPA Data</h2>
        <p className="text-muted-foreground mb-6 max-w-md">Please upload a "CAPA.csv" file to begin.</p>
    </div>
  );

  return (
    <div className="flex flex-col">
       <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
            <RadioGroup value={phaseFilter} onValueChange={(value) => setPhaseFilter(value as any)} className="flex items-center gap-4">
                <Label>Phase:</Label>
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="r1" />
                    <Label htmlFor="r1">All</Label>
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
            
            <RadioGroup value={teamFilter} onValueChange={(value) => setTeamFilter(value as any)} className="flex items-center gap-4">
                <Label>Team:</Label>
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="t1" />
                    <Label htmlFor="t1">All Operators</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="production" id="t2" />
                    <Label htmlFor="t2">Production Only</Label>
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
                <Button
                    variant="outline"
                    onClick={handleSummarize}
                    disabled={isSummarizing || capaData.length === 0}
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
        </div>
      <div className="flex-1 p-4 sm:p-6 space-y-6 pt-2">
        {capaData.length > 0 ? <MainContent /> : <EmptyState />}
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
