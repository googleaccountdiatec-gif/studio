"use client";

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar as CalendarIcon, FileUp, Users, AlertTriangle, CheckCircle, ListTodo, Columns } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { format, isAfter, isValid, startOfDay, subDays } from 'date-fns';
import { parseDate } from '@/lib/date-utils';
import { useToast } from "@/hooks/use-toast";
import type { CapaData } from '@/lib/types';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip } from 'recharts';
import { STATUS_COLORS, TOOLTIP_STYLE } from '@/lib/chart-utils';
import { KpiCard } from './kpi-card';
import { DataTable, DataTableColumn } from './data-table';
import { CapaChart } from './capa-chart';
import { Skeleton } from './ui/skeleton';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import { getProductionTeam } from '@/lib/teams';
import { useData } from '@/contexts/data-context';
import { DrillDownSheet, SummaryBar, InsightPanel, InsightCard, ExpandableDataTable, DetailSection, CrossLinkBadge } from '@/components/drill-down';
import type { ExpandableColumn } from '@/components/drill-down';
import { exportToCsv } from '@/lib/csv-export';
import { findLinkedDocuments } from '@/lib/cross-references';

const PRIORITY_COLORS = ['hsl(142 76% 36%)', 'hsl(35 90% 60%)', 'hsl(0 84% 60%)', 'hsl(var(--primary))'];

export default function CapaDashboard() {
  const { capaData, documentKpiData } = useData();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [showCompleted, setShowCompleted] = useState(false);
  const [phaseFilter, setPhaseFilter] = useState<'all' | 'execution' | 'effectiveness'>('all');
  const [teamFilter, setTeamFilter] = useState<'all' | 'production'>('all');
  const [selectedAssignee, setSelectedAssignee] = useState<string | null>(null);
  const [selectedCapaId, setSelectedCapaId] = useState<string | null>(null);
  const [navigationLevel, setNavigationLevel] = useState<'list' | 'detail'>('list');
  const { toast } = useToast();
  const productionTeam = getProductionTeam();

  const [columnVisibility, setColumnVisibility] = useState({
    'Title': true,
    'Assigned To': true,
    'Pending Steps': true,
  });


  const processedData = useMemo(() => {
    const today = startOfDay(new Date());

    let baseData = showCompleted
      ? capaData
      : capaData.filter(item => item['Pending Steps'] && item['Pending Steps'].trim() !== '');

    if (phaseFilter !== 'all') {
      baseData = baseData.filter(item => {
        // Prefer the API's structured Phase; fall back to substring match for legacy data shape
        const phase = item.Phase as string | undefined;
        const isEffectiveness = phase
          ? phase === 'effectiveness'
          : item['Pending Steps']?.toLowerCase().includes('effectiveness');
        return phaseFilter === 'effectiveness' ? isEffectiveness : !isEffectiveness;
      });
    }

    if (teamFilter === 'production') {
      baseData = baseData.filter(item => productionTeam.includes(item['Assigned To']));
    }

    return baseData.map(item => {
      // Prefer the API's pre-computed Effective Deadline; fall back to legacy derivation
      const phase = item.Phase as string | undefined;
      const isEffectivenessStep = phase
        ? phase === 'effectiveness'
        : item['Pending Steps']?.toLowerCase().includes('effectiveness');
      const dateString =
        item['Effective Deadline']
        || (isEffectivenessStep ? item['Deadline for effectiveness check'] : item['Due Date']);

      const effectiveDueDate = parseDate(dateString);

      let isOverdue = false;
      if (isValid(effectiveDueDate)) {
        isOverdue = isAfter(today, effectiveDueDate);
      }

      return { ...item, isOverdue, effectiveDueDate } as CapaData;
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

  // Bi-weekly trend: compare overdue count now vs 2 weeks ago
  // Uses Completed On date (not Pending Steps) to align with compendium's isTaskOverdue logic
  const biWeeklyTrend = useMemo(() => {
    const today = startOfDay(new Date());
    const twoWeeksAgo = subDays(today, 14);

    let overdueNow = 0;
    let overdueTwoWeeksAgo = 0;

    let trendData = capaData;
    if (teamFilter === 'production') {
        trendData = trendData.filter(item => productionTeam.includes(item['Assigned To']));
    }

    trendData.forEach(item => {
        // Prefer API's pre-computed Effective Deadline; fall back to derivation from Phase / Pending Steps
        const phase = item.Phase as string | undefined;
        const isEffPhase = phase
          ? phase === 'effectiveness'
          : (item['Pending Steps'] || '').trim().toLowerCase().includes('effectiveness');

        const effectiveDeadlineStr =
          item['Effective Deadline']
          || (isEffPhase
            ? (item['Deadline for effectiveness check'] || item['Due Date'])
            : item['Due Date']);
        const effectiveDeadline = parseDate(effectiveDeadlineStr);
        const completedOn = parseDate(item['Completed On']);

        if (!isValid(effectiveDeadline)) return;

        // Overdue NOW: deadline is past AND not completed before now
        if (effectiveDeadline < today) {
            const completedBeforeNow = isValid(completedOn) && completedOn <= today;
            if (!completedBeforeNow) overdueNow++;
        }

        // Overdue 2 WEEKS AGO: deadline was past AND not completed before then
        if (effectiveDeadline < twoWeeksAgo) {
            const completedBeforeThen = isValid(completedOn) && completedOn <= twoWeeksAgo;
            if (!completedBeforeThen) overdueTwoWeeksAgo++;
        }
    });

    return overdueNow - overdueTwoWeeksAgo;
  }, [capaData, teamFilter, productionTeam]);

  const chartDataByStatus = useMemo(() => {
    const overdue = kpiValues.overdueCount;
    const onTime = kpiValues.totalCount - overdue;
    return [
      { name: "On Time", status: onTime },
      { name: "Overdue", status: overdue }
    ];
  }, [kpiValues]);

  const chartDataByAssignee = useMemo(() => {
    const assigneeCounts: { [key: string]: { onTime: number; overdue: number } } = {};
    filteredData.forEach(item => {
      const assignee = item['Assigned To'];
      if (assignee) {
        if (!assigneeCounts[assignee]) assigneeCounts[assignee] = { onTime: 0, overdue: 0 };
        if (item.isOverdue) assigneeCounts[assignee].overdue++;
        else assigneeCounts[assignee].onTime++;
      }
    });
    return Object.entries(assigneeCounts)
      .map(([name, counts]) => ({ name, ...counts, total: counts.onTime + counts.overdue }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [filteredData]);

  const assigneeCapas = useMemo(() => {
    if (!selectedAssignee) return [];
    return filteredData.filter(item => item['Assigned To'] === selectedAssignee);
  }, [filteredData, selectedAssignee]);

  const assigneeSummary = useMemo(() => {
    if (!selectedAssignee) return { total: 0, overdue: 0, completed: 0, onTimeRate: '0.0' };
    const capas = assigneeCapas;
    const total = capas.length;
    const overdue = capas.filter(c => c.isOverdue).length;
    const completed = capas.filter(c => !c['Pending Steps'] || c['Pending Steps'].trim() === '').length;
    const onTimeRate = total > 0 ? ((total - overdue) / total * 100).toFixed(1) : '0.0';
    return { total, overdue, completed, onTimeRate };
  }, [selectedAssignee, assigneeCapas]);

  const selectedCapa = useMemo(() => {
    if (!selectedCapaId) return null;
    return assigneeCapas.find(c => c['CAPA ID'] === selectedCapaId) ?? null;
  }, [assigneeCapas, selectedCapaId]);

  const linkedDocuments = useMemo(() => {
    if (!selectedCapa) return [];
    const capaId = selectedCapa['CAPA ID']?.replace(/[^0-9]/g, '');
    if (!capaId) return [];
    return findLinkedDocuments(documentKpiData, 'capa', capaId);
  }, [selectedCapa, documentKpiData]);

  const categoryChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(item => {
      const cat = item['Category of Corrective Action'] || 'Uncategorized';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [filteredData]);

  const priorityChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(item => {
      const priority = item['Priority'] || 'Unspecified';
      counts[priority] = (counts[priority] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [filteredData]);

  const drillDownColumns: ExpandableColumn<CapaData>[] = [
    { key: 'CAPA ID', header: 'CAPA ID', sortable: true },
    { key: 'Title', header: 'Title' },
    {
      key: 'Priority',
      header: 'Priority',
      cell: (row) => (
        <Badge variant={row['Priority']?.toLowerCase() === 'high' ? 'destructive' : 'secondary'}>
          {row['Priority'] || 'N/A'}
        </Badge>
      ),
    },
    {
      key: 'Category of Corrective Action',
      header: 'Category',
      cell: (row) => row['Category of Corrective Action'] || 'N/A',
    },
    {
      key: 'effectiveDueDate',
      header: 'Due Date',
      sortable: true,
      cell: (row) => row.effectiveDueDate && isValid(row.effectiveDueDate)
        ? format(row.effectiveDueDate, 'PPP')
        : 'Invalid Date',
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => row.isOverdue
        ? <Badge variant="destructive" className="bg-accent text-accent-foreground hover:bg-accent/80">Overdue</Badge>
        : <Badge className="bg-green-500 hover:bg-green-600 text-white border-transparent">On Time</Badge>,
    },
  ];

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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KpiCard title="Total CAPAs" value={kpiValues.totalCount} icon={ListTodo} description={dateRange?.from ? "In selected date range" : "From imported file"}/>
            <KpiCard
                title="Overdue CAPAs"
                value={kpiValues.overdueCount}
                icon={AlertTriangle}
                description={`${(kpiValues.totalCount > 0 ? (kpiValues.overdueCount / kpiValues.totalCount * 100).toFixed(1) : 0)}% of total`}
                trend={biWeeklyTrend}
                trendLabel="since last bi-weekly"
            />
            <KpiCard title="On Time Rate" value={`${kpiValues.onTimePercentage}%`} icon={CheckCircle} description="CAPAs not past deadline" />
            <KpiCard title="Unique Assignees" value={Object.keys(chartDataByAssignee.reduce((acc, item) => { if(item.name) acc[item.name] = true; return acc; }, {} as Record<string, boolean>)).length} icon={Users} description="People with assigned CAPAs"/>
        </div>

        <div className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardContent className="pt-6">
                <div className="h-[280px] w-full">
                  <h3 className="text-lg font-semibold mb-4">CAPAs by Assignee (Top 10)</h3>
                  <ResponsiveContainer width="100%" height="85%">
                    <BarChart data={chartDataByAssignee} onClick={(e) => e && e.activeLabel && setSelectedAssignee(e.activeLabel)} margin={{ top: 5, right: 10, left: -20, bottom: 60 }}>
                      <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} interval={0} angle={-45} textAnchor="end" />
                      <YAxis fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'transparent' }} />
                      <Legend />
                      <Bar dataKey="onTime" name="On Time" stackId="a" fill={STATUS_COLORS.onTime} radius={[0, 0, 0, 0]} cursor="pointer" />
                      <Bar dataKey="overdue" name="Overdue" stackId="a" fill={STATUS_COLORS.overdue} radius={[4, 4, 0, 0]} cursor="pointer" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardContent className="pt-6">
                <div className="h-[280px] w-full">
                  <h3 className="text-lg font-semibold mb-4">CAPA Status Overview</h3>
                  <ResponsiveContainer width="100%" height="85%">
                    <PieChart>
                      <Pie data={chartDataByStatus} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="status">
                        <Cell fill={STATUS_COLORS.onTime} />
                        <Cell fill={STATUS_COLORS.overdue} />
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="pt-6">
                <div className="h-[250px] w-full">
                  <CapaChart data={categoryChartData} title="CAPAs by Category" dataKey="total" scrollable />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="h-[250px] w-full">
                  <h3 className="text-lg font-semibold mb-4">CAPAs by Priority</h3>
                  <ResponsiveContainer width="100%" height="85%">
                    <PieChart>
                      <Pie data={priorityChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="total" nameKey="name">
                        {priorityChartData.map((entry, index) => (
                          <Cell key={entry.name} fill={PRIORITY_COLORS[index % PRIORITY_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
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

      <DrillDownSheet
        open={!!selectedAssignee}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedAssignee(null);
            setSelectedCapaId(null);
            setNavigationLevel('list');
          }
        }}
        title={
          navigationLevel === 'detail' && selectedCapa
            ? `${selectedCapa['CAPA ID']} — ${selectedCapa['Title']}`
            : `CAPAs Assigned to ${selectedAssignee}`
        }
        breadcrumbs={
          navigationLevel === 'detail'
            ? [{ label: `${selectedAssignee}'s CAPAs`, onClick: () => { setSelectedCapaId(null); setNavigationLevel('list'); } }]
            : []
        }
        onExportCsv={() => {
          exportToCsv(
            assigneeCapas,
            [
              { key: 'CAPA ID', header: 'CAPA ID' },
              { key: 'Title', header: 'Title' },
              { key: 'Priority', header: 'Priority' },
              { key: 'Category of Corrective Action', header: 'Category' },
              { key: 'Assigned To', header: 'Assigned To' },
              { key: 'Pending Steps', header: 'Pending Steps' },
            ],
            `capas-${selectedAssignee?.replace(/\s+/g, '-').toLowerCase() ?? 'export'}.csv`
          );
        }}
      >
        {navigationLevel === 'list' ? (
          <>
            <SummaryBar
              metrics={[
                { label: 'Total CAPAs', value: assigneeSummary.total, icon: ListTodo },
                { label: 'Overdue', value: assigneeSummary.overdue, color: assigneeSummary.overdue > 0 ? 'danger' : 'default', icon: AlertTriangle },
                { label: 'On-Time Rate', value: `${assigneeSummary.onTimeRate}%`, color: parseFloat(assigneeSummary.onTimeRate) >= 80 ? 'success' : 'warning', icon: CheckCircle },
                { label: 'Completed', value: assigneeSummary.completed, color: 'success' },
              ]}
            />

            <InsightPanel>
              <InsightCard title="Priority Breakdown">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(
                    assigneeCapas.reduce<Record<string, number>>((acc, c) => {
                      const p = c['Priority'] || 'Unspecified';
                      acc[p] = (acc[p] || 0) + 1;
                      return acc;
                    }, {})
                  ).map(([priority, count]) => (
                    <Badge key={priority} variant="outline">{priority}: {count}</Badge>
                  ))}
                </div>
              </InsightCard>
              <InsightCard title="Category Breakdown">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(
                    assigneeCapas.reduce<Record<string, number>>((acc, c) => {
                      const cat = c['Category of Corrective Action'] || 'Uncategorized';
                      acc[cat] = (acc[cat] || 0) + 1;
                      return acc;
                    }, {})
                  ).map(([category, count]) => (
                    <Badge key={category} variant="outline">{category}: {count}</Badge>
                  ))}
                </div>
              </InsightCard>
            </InsightPanel>

            <ExpandableDataTable<CapaData>
              columns={drillDownColumns}
              data={assigneeCapas}
              getRowId={(row) => row['CAPA ID']}
              getRowClassName={(row) => cn(row.isOverdue && "bg-accent/20")}
              onRowClick={(row) => {
                setSelectedCapaId(row['CAPA ID']);
                setNavigationLevel('detail');
              }}
              expandedContent={(row) => (
                <div className="space-y-2 text-sm">
                  {row['Description'] && (
                    <div>
                      <span className="font-medium text-muted-foreground">Description: </span>
                      {row['Description'].length > 200
                        ? `${row['Description'].substring(0, 200)}...`
                        : row['Description']}
                    </div>
                  )}
                  {row['Action plan'] && (
                    <div>
                      <span className="font-medium text-muted-foreground">Action Plan: </span>
                      {row['Action plan'].length > 200
                        ? `${row['Action plan'].substring(0, 200)}...`
                        : row['Action plan']}
                    </div>
                  )}
                </div>
              )}
            />
          </>
        ) : selectedCapa ? (
          <>
            {/* Header badges */}
            <div className="flex flex-wrap gap-2">
              {selectedCapa['Priority'] && (
                <Badge variant={selectedCapa['Priority'].toLowerCase() === 'high' ? 'destructive' : 'secondary'}>
                  {selectedCapa['Priority']}
                </Badge>
              )}
              {selectedCapa['Category of Corrective Action'] && (
                <Badge variant="outline">{selectedCapa['Category of Corrective Action']}</Badge>
              )}
              {selectedCapa.isOverdue
                ? <Badge variant="destructive" className="bg-accent text-accent-foreground hover:bg-accent/80">Overdue</Badge>
                : <Badge className="bg-green-500 hover:bg-green-600 text-white border-transparent">On Time</Badge>
              }
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-4 rounded-lg border p-4">
              <div>
                <p className="text-xs text-muted-foreground">Assigned To</p>
                <p className="text-sm font-medium">{selectedCapa['Assigned To'] || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Proposed Responsible</p>
                <p className="text-sm font-medium">{selectedCapa['Proposed responsible'] || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Due Date</p>
                <p className="text-sm font-medium">
                  {selectedCapa['Due Date'] || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Effectiveness Deadline</p>
                <p className="text-sm font-medium">
                  {selectedCapa['Deadline for effectiveness check'] || 'N/A'}
                </p>
              </div>
            </div>

            {/* Detail sections */}
            <DetailSection title="Description" content={selectedCapa['Description']} />
            <DetailSection title="Action Plan" content={selectedCapa['Action plan']} />
            <DetailSection title="Expected Results" content={selectedCapa['Expected results of Action']} />
            <DetailSection title="Action Taken" content={selectedCapa['Action taken']} />

            {/* Cross-linked documents */}
            {linkedDocuments.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Linked Documents</h4>
                <div className="flex flex-wrap gap-2">
                  {linkedDocuments.map((doc) => (
                    <CrossLinkBadge
                      key={`${doc['Doc Prefix']}-${doc['Doc Number']}`}
                      domain="document"
                      id={doc['Doc Number']}
                      label={`${doc['Doc Prefix']}-${doc['Doc Number']} ${doc['Title']}`}
                      onClick={() => {
                        /* Navigation to document detail could be added later */
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </DrillDownSheet>
    </div>
  );
}
