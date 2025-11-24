"use client";

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar as CalendarIcon, FileUp, Users, AlertTriangle, CheckCircle, ListTodo, Columns } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { format, isAfter, parse, isValid, startOfDay } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import type { CapaData } from '@/lib/types';
// BESTIE NOTE: We aren't using KpiCard anymore, she was too bloated.
import { DataTable, DataTableColumn } from './data-table';
import { CapaChart } from './capa-chart';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import { getProductionTeam } from '@/lib/teams';
import { useData } from '@/contexts/data-context';
import { GlassCard } from '@/components/ui/glass-card'; // Make sure this is imported!

// ... [Keep your DATE_FORMATS and parseDate function exactly as they are] ...
// ... [I'm skipping them here to save space, but keep them in your file!] ...
const DATE_FORMATS = [
  'dd/MM/yyyy', 'd/M/yyyy', 'dd.MM.yyyy', 'd.M.yyyy', 'yyyy-MM-dd',
  'M/d/yyyy', 'MM/dd/yyyy', 'M-d-yyyy', 'MM-dd-yyyy',
];

const parseDate = (dateString: string): Date => {
  if (!dateString) return new Date('invalid');
  const cleanString = dateString.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  const ddMMyyyy = cleanString.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (ddMMyyyy) {
    const [, day, month, year] = ddMMyyyy;
    const parsed = new Date(`${year}-${month}-${day}T00:00:00`);
    if (isValid(parsed)) return parsed;
  }
  for (const formatStr of DATE_FORMATS) {
    const parsedDate = parse(cleanString, formatStr, new Date());
    if (isValid(parsedDate)) return parsedDate;
  }
  const nativeDate = new Date(cleanString);
  if (isValid(nativeDate)) return nativeDate;
  return new Date('invalid');
}

export default function CapaDashboard() {
  const { capaData } = useData();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [showCompleted, setShowCompleted] = useState(false);
  const [phaseFilter, setPhaseFilter] = useState<'all' | 'execution' | 'effectiveness'>('all');
  const [teamFilter, setTeamFilter] = useState<'all' | 'production'>('all');
  const [selectedAssignee, setSelectedAssignee] = useState<string | null>(null);
  const { toast } = useToast();
  const productionTeam = getProductionTeam();

  const [columnVisibility, setColumnVisibility] = useState({
    'Title': true,
    'Assigned To': true,
    'Pending Steps': true,
  });
  
  // ... [Keep processedData, filteredData, kpiValues, chartDataByStatus, chartDataByAssignee, assigneeCapas, and columns exactly as they are] ...
  const processedData = useMemo(() => {
    const today = startOfDay(new Date());
    let baseData = showCompleted ? capaData : capaData.filter(item => item['Pending Steps'] && item['Pending Steps'].trim() !== '');
    if (phaseFilter !== 'all') {
      baseData = baseData.filter(item => {
        const isEffectiveness = item['Pending Steps']?.toLowerCase().includes('effectiveness');
        return phaseFilter === 'effectiveness' ? isEffectiveness : !isEffectiveness;
      });
    }
    if (teamFilter === 'production') baseData = baseData.filter(item => productionTeam.includes(item['Assigned To']));
    return baseData.map(item => {
      const isEffectivenessStep = item['Pending Steps']?.toLowerCase().includes('effectiveness');
      const dateString = isEffectivenessStep ? item['Deadline for effectiveness check'] : item['Due Date'];
      const effectiveDueDate = parseDate(dateString);
      let isOverdue = false;
      if (isValid(effectiveDueDate)) isOverdue = isAfter(today, effectiveDueDate);
      return { ...item, isOverdue, effectiveDueDate };
    });
  }, [capaData, showCompleted, phaseFilter, teamFilter, productionTeam]);

  const filteredData = useMemo(() => {
    if (!dateRange?.from) return processedData;
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
    return [{ name: "On Time", status: onTime }, { name: "Overdue", status: overdue }];
  }, [kpiValues]);

  const chartDataByAssignee = useMemo(() => {
    const assigneeCounts: { [key: string]: number } = {};
    filteredData.forEach(item => {
      const assignee = item['Assigned To'];
      if(assignee) assigneeCounts[assignee] = (assigneeCounts[assignee] || 0) + 1;
    });
    return Object.entries(assigneeCounts)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [filteredData]);

  const assigneeCapas = useMemo(() => {
    if (!selectedAssignee) return [];
    return filteredData.filter(item => item['Assigned To'] === selectedAssignee);
  }, [filteredData, selectedAssignee]);

  const columns: DataTableColumn<CapaData>[] = [
    { accessorKey: 'CAPA ID', header: 'CAPA ID', cell: (row) => row['CAPA ID'] },
    { accessorKey: 'Title', header: 'Title', cell: (row) => <span className="font-medium">{row['Title']}</span>, visible: columnVisibility['Title'] },
    { accessorKey: 'effectiveDueDate', header: 'Effective Due Date', cell: (row) => row.effectiveDueDate && isValid(row.effectiveDueDate) ? format(row.effectiveDueDate!, 'PPP') : 'Invalid Date' },
    { accessorKey: 'Assigned To', header: 'Assigned To', cell: (row) => row['Assigned To'], visible: columnVisibility['Assigned To'] },
    { accessorKey: 'Pending Steps', header: 'Pending Steps', cell: (row) => <Badge variant="secondary">{row['Pending Steps']}</Badge>, visible: columnVisibility['Pending Steps'] },
    { accessorKey: 'status', header: 'Status', cell: (row) => row.isOverdue ? <Badge variant="destructive" className="bg-accent text-accent-foreground hover:bg-accent/80">Overdue</Badge> : <Badge className="bg-green-500 hover:bg-green-600 text-white border-transparent">On Time</Badge> },
  ];
  
  // BESTIE: Here is the renovated MainContent! 💅
  const MainContent = () => (
    <div className="space-y-6">
        {/* ROW 1: Consolidated KPI Card + Status Chart (Small & Cute) */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* KPI Card - Merged for slimness */}
            <GlassCard className="p-6 flex flex-col justify-between h-fit lg:col-span-1">
                 <h3 className="text-lg font-semibold mb-4">Performance Overview</h3>
                 <div className="space-y-6">
                    {/* Stat 1 */}
                    <div className="flex justify-between items-center border-b pb-2 border-border/50">
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-muted-foreground flex items-center gap-2"><ListTodo className="h-3 w-3"/> Total CAPAs</span>
                        </div>
                        <span className="text-2xl font-bold text-primary">{kpiValues.totalCount}</span>
                    </div>
                    {/* Stat 2 */}
                    <div className="flex justify-between items-center border-b pb-2 border-border/50">
                         <div className="flex flex-col">
                            <span className="text-sm font-medium text-muted-foreground flex items-center gap-2"><AlertTriangle className="h-3 w-3"/> Overdue</span>
                        </div>
                        <span className={cn("text-2xl font-bold", kpiValues.overdueCount > 0 ? "text-destructive" : "text-emerald-500")}>
                            {kpiValues.overdueCount}
                        </span>
                    </div>
                     {/* Stat 3 */}
                    <div className="flex justify-between items-center">
                         <div className="flex flex-col">
                            <span className="text-sm font-medium text-muted-foreground flex items-center gap-2"><CheckCircle className="h-3 w-3"/> On Time Rate</span>
                        </div>
                         <span className="text-2xl font-bold text-foreground">{kpiValues.onTimePercentage}%</span>
                    </div>
                 </div>
            </GlassCard>

            {/* Status Chart - Petite Size */}
            <GlassCard className="lg:col-span-2 p-6 flex flex-col">
                <h3 className="text-base font-semibold mb-4">CAPA Status Overview</h3>
                <div className="h-[220px] w-full">
                    <CapaChart data={chartDataByStatus} title="" dataKey="status" />
                </div>
            </GlassCard>
        </div>

        {/* ROW 2: Assignee Chart - Panoramic View */}
        <div className="grid gap-6 lg:grid-cols-1">
            <GlassCard className="p-6 flex flex-col">
                <h3 className="text-base font-semibold mb-4">Top 10 Assignees</h3>
                <div className="h-[250px] w-full">
                    <CapaChart 
                        data={chartDataByAssignee} 
                        title="" 
                        dataKey="total" 
                        onBarClick={setSelectedAssignee}
                    />
                </div>
            </GlassCard>
        </div>

        {/* ROW 3: Data Table */}
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
    </div>
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
        {/* Filters Header - I kept this as is, but you can wrap it in a glass card if you want to be extra fancy! */}
       <div className="flex items-center gap-4 sm:gap-6 flex-wrap mb-4">
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
      <div className="flex-1 space-y-6 pt-2">
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