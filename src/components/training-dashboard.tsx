"use client";

import React, { useState, useMemo } from 'react';
import { useData } from '@/contexts/data-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isValid, startOfDay, isAfter, format, subDays } from 'date-fns';
import { parseDate } from '@/lib/date-utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DataTable, DataTableColumn } from './data-table';
import { KpiCard } from './kpi-card';
import { Badge } from './ui/badge';
import { FileUp, ListTodo, AlertTriangle, CheckCircle, ShieldCheck, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip as TooltipUI, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getProductionTeam } from '@/lib/teams';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from '@/components/ui/label';
import { DrillDownSheet, SummaryBar, ExpandableDataTable, DetailSection } from '@/components/drill-down';
import type { ExpandableColumn } from '@/components/drill-down';
import { exportToCsv } from '@/lib/csv-export';

interface TrainingData {
  'Record training ID': string;
  'Title': string;
  'Trainee': string;
  'Training category': string;
  'Deadline for completing training': string;
  'Final training approval'?: string;
  'Pending Steps': string;
  'Completed On'?: string;
  [key: string]: any;
}

interface ProcessedTrainingRecord {
  id: string;
  title: string;
  trainee: string;
  category: string;
  deadline: Date;
  status: 'Completed' | 'Pending' | 'Overdue';
  pendingStep: string;
  approval: string;
  completedOn: string;
  raw: TrainingData;
}


const parseTrainingData = (row: TrainingData): ProcessedTrainingRecord => {
  const today = startOfDay(new Date());

  const deadline = parseDate(row['Deadline for completing training']);

  const pendingSteps = row['Pending Steps']?.trim();
  let status: ProcessedTrainingRecord['status'] = 'Pending';

  if (!pendingSteps) {
    status = 'Completed';
  } else if (isValid(deadline) && isAfter(today, deadline)) {
    status = 'Overdue';
  }

  return {
    id: row['Record training ID'],
    title: row['Title'],
    trainee: row['Trainee'],
    category: row['Training category'],
    deadline: deadline,
    status: status,
    pendingStep: pendingSteps || 'Unknown',
    approval: row['Final training approval']?.trim() || '',
    completedOn: row['Completed On']?.trim() || '',
    raw: row,
  };
};

export default function TrainingDashboard() {
  const { trainingData } = useData();
  const [teamFilter, setTeamFilter] = useState<'all' | 'production'>('all');
  const productionTeam = getProductionTeam();

  // Drill-down state
  const [selectedTrainee, setSelectedTrainee] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTrainingId, setSelectedTrainingId] = useState<string | null>(null);
  const [navigationLevel, setNavigationLevel] = useState<'list' | 'detail'>('list');

  // Category filter for main view
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const allProcessedData = useMemo(() => {
    let data = trainingData.map((row: any) => parseTrainingData(row));
    if (teamFilter === 'production') {
        data = data.filter(item => productionTeam.includes(item.trainee));
    }
    return data;
  }, [trainingData, teamFilter, productionTeam]);

  // Category counts for filter chips (computed from unfiltered data)
  const categoryCounts = useMemo(() => {
    const counts: Record<string, { total: number; overdue: number }> = {};
    allProcessedData.forEach(r => {
      const cat = r.category || 'Uncategorized';
      if (!counts[cat]) counts[cat] = { total: 0, overdue: 0 };
      counts[cat].total++;
      if (r.status === 'Overdue') counts[cat].overdue++;
    });
    return Object.entries(counts)
      .map(([name, c]) => ({ name, ...c }))
      .sort((a, b) => b.total - a.total);
  }, [allProcessedData]);

  // Filtered by category selection
  const processedData = useMemo(() => {
    if (!categoryFilter) return allProcessedData;
    return allProcessedData.filter(r => r.category === categoryFilter);
  }, [allProcessedData, categoryFilter]);

  // Bi-weekly trend: compare overdue count now vs 2 weeks ago
  // Uses Completed On date (not Pending Steps) to align with compendium's isTaskOverdue logic
  const biWeeklyTrend = useMemo(() => {
      const today = startOfDay(new Date());
      const twoWeeksAgo = subDays(today, 14);

      let overdueNow = 0;
      let overdueTwoWeeksAgo = 0;

      let trendData = trainingData.map((row: any) => parseTrainingData(row));
      if (teamFilter === 'production') {
          trendData = trendData.filter(item => productionTeam.includes(item.trainee));
      }

      trendData.forEach(item => {
          if (!isValid(item.deadline)) return;
          const completedOn = parseDate(item.completedOn);

          // Overdue NOW: deadline is past AND not completed before now
          if (item.deadline < today) {
              const completedBeforeNow = isValid(completedOn) && completedOn <= today;
              if (!completedBeforeNow) overdueNow++;
          }

          // Overdue 2 WEEKS AGO: deadline was past AND not completed before then
          if (item.deadline < twoWeeksAgo) {
              const completedBeforeThen = isValid(completedOn) && completedOn <= twoWeeksAgo;
              if (!completedBeforeThen) overdueTwoWeeksAgo++;
          }
      });

      return overdueNow - overdueTwoWeeksAgo;
  }, [trainingData, teamFilter, productionTeam]);

  const stats = useMemo(() => {
    const total = processedData.length;
    const completed = processedData.filter(r => r.status === 'Completed').length;
    const overdue = processedData.filter(r => r.status === 'Overdue').length;
    const completionRate = total > 0 ? (completed / total) * 100 : 0;

    return { total, completed, overdue, completionRate };
  }, [processedData]);

  const chartData = useMemo(() => {
    const traineeStats: { [key: string]: { name: string; completed: number; pending: number; overdue: number } } = {};
    processedData.forEach(record => {
      if (!traineeStats[record.trainee]) {
        traineeStats[record.trainee] = { name: record.trainee, completed: 0, pending: 0, overdue: 0 };
      }
      if (record.status === 'Completed') {
        traineeStats[record.trainee].completed++;
      } else if (record.status === 'Overdue') {
        traineeStats[record.trainee].overdue++;
      } else {
        traineeStats[record.trainee].pending++;
      }
    });
    // Sort by total (completed + pending + overdue)
    return Object.values(traineeStats).sort((a, b) => (b.completed + b.pending + b.overdue) - (a.completed + a.pending + a.overdue));
  }, [processedData]);

  const pieData = useMemo(() => {
    const categoryCounts: { [key: string]: number } = {};
    processedData.forEach(record => {
      const cat = record.category || 'Uncategorized';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
    return Object.entries(categoryCounts).map(([name, value]) => ({ name, value }));
  }, [processedData]);

  const PIE_COLORS = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))'
  ];

  // Trainee drill-down data
  const traineeRecords = useMemo(() => {
    if (!selectedTrainee) return [];
    return processedData.filter(r => r.trainee === selectedTrainee);
  }, [processedData, selectedTrainee]);

  const traineeSummary = useMemo(() => {
    const total = traineeRecords.length;
    const completed = traineeRecords.filter(r => r.status === 'Completed').length;
    const overdue = traineeRecords.filter(r => r.status === 'Overdue').length;
    const approved = traineeRecords.filter(r => r.approval.toLowerCase() === 'approved').length;
    return { total, completed, overdue, approved };
  }, [traineeRecords]);

  // Selected training record for detail view
  const selectedTraining = useMemo(() => {
    if (!selectedTrainingId) return null;
    return traineeRecords.find(r => r.id === selectedTrainingId) ?? null;
  }, [traineeRecords, selectedTrainingId]);

  // Category drill-down data
  const categoryRecords = useMemo(() => {
    if (!selectedCategory) return [];
    return processedData.filter(r => r.category === selectedCategory);
  }, [processedData, selectedCategory]);

  const categorySummary = useMemo(() => {
    const total = categoryRecords.length;
    const completed = categoryRecords.filter(r => r.status === 'Completed').length;
    const overdue = categoryRecords.filter(r => r.status === 'Overdue').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const uniqueTrainees = new Set(categoryRecords.map(r => r.trainee)).size;
    return { total, completed, overdue, completionRate, uniqueTrainees };
  }, [categoryRecords]);

  // Compute timeliness for detail view
  const computeTimeliness = (record: ProcessedTrainingRecord): string => {
    if (record.status !== 'Completed' || !record.completedOn) return 'N/A';
    const completedDate = parseDate(record.completedOn);
    if (!isValid(completedDate) || !isValid(record.deadline)) return 'N/A';
    const diffMs = completedDate.getTime() - record.deadline.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'Early';
    if (diffDays === 0) return 'On time';
    return 'Late';
  };

  // Drill-down columns for trainee/category sheets
  const drillDownColumns: ExpandableColumn<ProcessedTrainingRecord>[] = [
    { key: 'title', header: 'Title', cell: (row) => <span className="font-medium">{row.title}</span> },
    {
      key: 'category',
      header: 'Category',
      cell: (row) => <Badge variant="outline">{row.category}</Badge>
    },
    {
      key: 'deadline',
      header: 'Deadline',
      sortable: true,
      cell: (row) => isValid(row.deadline) ? format(row.deadline, 'dd/MM/yyyy') : 'N/A'
    },
    {
      key: 'completedOn',
      header: 'Completed On',
      cell: (row) => row.completedOn || 'N/A'
    },
    {
      key: 'approval',
      header: 'Approval',
      cell: (row) => {
        const a = row.approval.toLowerCase();
        if (a === 'approved') return <Badge className="bg-green-500 hover:bg-green-600 text-white border-transparent">Approved</Badge>;
        if (row.approval) return <Badge variant="secondary">{row.approval}</Badge>;
        return <Badge variant="outline">Pending</Badge>;
      }
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => {
        if (row.status === 'Completed') return <Badge className="bg-teal-500 hover:bg-teal-600 text-white">Completed</Badge>;
        if (row.status === 'Overdue') return <Badge variant="destructive">Late!</Badge>;
        return <Badge className="bg-amber-400 hover:bg-amber-500 text-black">WIP</Badge>;
      }
    },
  ];

  const columns: DataTableColumn<ProcessedTrainingRecord>[] = [
    { accessorKey: 'title', header: 'Title', cell: (row) => <span className="font-medium">{row.title}</span> },
    { accessorKey: 'trainee', header: 'Trainee', cell: (row) => row.trainee },
    { accessorKey: 'category', header: 'Category', cell: (row) => <Badge variant="outline">{row.category}</Badge> },
    { accessorKey: 'deadline', header: 'Deadline', cell: (row) => isValid(row.deadline) ? format(row.deadline, 'dd/MM/yyyy') : 'N/A' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: (row) => {
        if (row.status === 'Completed') return <Badge className="bg-teal-500 hover:bg-teal-600 text-white">Completed</Badge>;
        if (row.status === 'Overdue') return <Badge variant="destructive">Late!</Badge>;

        return (
            <TooltipProvider>
                <TooltipUI>
                    <TooltipTrigger>
                        <Badge className="bg-amber-400 hover:bg-amber-500 text-black">WIP</Badge>
                    </TooltipTrigger>
                    <TooltipContent className="bg-card/80 backdrop-blur-md border-border/50">
                        <p>{row.pendingStep}</p>
                    </TooltipContent>
                </TooltipUI>
            </TooltipProvider>
        );
      }
    },
  ];

  if (trainingData.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center text-center py-20 px-4 rounded-lg border-2 border-dashed border-muted-foreground/30">
            <FileUp className="h-16 w-16 text-muted-foreground mb-4"/>
            <h2 className="text-2xl font-semibold mb-2">Upload Your Training Data</h2>
            <p className="text-muted-foreground mb-6 max-w-md">Use the uploader in the header to import your "Training KPI.csv" file.</p>
        </div>
    );
  }

  const chartHeight = Math.max(chartData.length * 50 + 50, 300);

  return (
    <div className="space-y-6">
        <div className="flex items-center gap-4">
             <RadioGroup value={teamFilter} onValueChange={(value) => setTeamFilter(value as any)} className="flex items-center gap-4">
                <Label>Team:</Label>
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="t1-tr" />
                    <Label htmlFor="t1-tr">All Operators</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="production" id="t2-tr" />
                    <Label htmlFor="t2-tr">Production Only</Label>
                </div>
            </RadioGroup>
        </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Total Assignments" value={stats.total} icon={ListTodo} description={categoryFilter ? `In: ${categoryFilter}` : "From imported file"} />
        <KpiCard
          title="Overdue"
          value={stats.overdue}
          icon={AlertTriangle}
          description={stats.overdue > 0 ? "Action required" : "All clear"}
          trend={biWeeklyTrend}
          trendLabel="since last bi-weekly"
        />
        <KpiCard title="Completion Rate" value={`${Math.round(stats.completionRate)}%`} icon={CheckCircle} description={`${stats.completed} of ${stats.total} completed`} />
        <KpiCard title="Unique Trainees" value={new Set(processedData.map(r => r.trainee)).size} icon={Users} description="People with training records" />
      </div>

      {/* Category Filter Chips */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground mr-1">Category:</span>
            <Badge
              variant={categoryFilter === null ? 'default' : 'outline'}
              className={cn("cursor-pointer transition-all", categoryFilter === null && "ring-2 ring-primary/20")}
              onClick={() => setCategoryFilter(null)}
            >
              All ({allProcessedData.length})
            </Badge>
            {categoryCounts.map(cat => (
              <Badge
                key={cat.name}
                variant={categoryFilter === cat.name ? 'default' : 'outline'}
                className={cn(
                  "cursor-pointer transition-all",
                  categoryFilter === cat.name && "ring-2 ring-primary/20",
                  cat.overdue > 0 && categoryFilter !== cat.name && "border-destructive/40"
                )}
                onClick={() => setCategoryFilter(categoryFilter === cat.name ? null : cat.name)}
              >
                {cat.name} ({cat.total}){cat.overdue > 0 && <span className="ml-1 text-destructive">!</span>}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Trainee Chart */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4">
            Training by Trainee
            {categoryFilter && <span className="text-sm font-normal text-muted-foreground ml-2">({categoryFilter})</span>}
          </h3>
          <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ left: 0, right: 20 }}
                onClick={(e) => {
                  if (e && e.activeLabel) {
                    setSelectedTrainee(e.activeLabel as string);
                    setSelectedTrainingId(null);
                    setNavigationLevel('list');
                  }
                }}
              >
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} interval={0} />
                  <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', backdropFilter: 'blur(4px)', border: '1px solid hsl(var(--border))' }} />
                  <Legend />
                  <Bar dataKey="completed" name="Completed" stackId="a" fill="hsl(var(--chart-4))" cursor="pointer" />
                  <Bar dataKey="pending" name="Pending" stackId="a" fill="hsl(var(--chart-2))" cursor="pointer" />
                  <Bar dataKey="overdue" name="Overdue" stackId="a" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} cursor="pointer" />
              </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Training Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
              columns={columns}
              data={processedData}
              getRowClassName={(row) => cn(row.status === 'Overdue' && "bg-destructive/10 hover:bg-destructive/20")}
          />
        </CardContent>
      </Card>

      {/* Trainee Drill-Down Sheet */}
      <DrillDownSheet
        open={!!selectedTrainee}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTrainee(null);
            setSelectedTrainingId(null);
            setNavigationLevel('list');
          }
        }}
        title={
          navigationLevel === 'detail' && selectedTraining
            ? `${selectedTraining.id} — ${selectedTraining.title}`
            : `Training for ${selectedTrainee}`
        }
        breadcrumbs={
          navigationLevel === 'detail'
            ? [{ label: `${selectedTrainee}'s Training`, onClick: () => { setSelectedTrainingId(null); setNavigationLevel('list'); } }]
            : []
        }
        onExportCsv={() => {
          exportToCsv(
            traineeRecords.map(r => r.raw),
            [
              { key: 'Record training ID', header: 'Training ID' },
              { key: 'Title', header: 'Title' },
              { key: 'Training category', header: 'Category' },
              { key: 'Deadline for completing training', header: 'Deadline' },
              { key: 'Final training approval', header: 'Approval' },
              { key: 'Completed On', header: 'Completed On' },
              { key: 'Pending Steps', header: 'Pending Steps' },
            ],
            `training-${selectedTrainee?.replace(/\s+/g, '-').toLowerCase() ?? 'export'}.csv`
          );
        }}
      >
        {navigationLevel === 'list' ? (
          <>
            <SummaryBar
              metrics={[
                { label: 'Total', value: traineeSummary.total, icon: ListTodo },
                { label: 'Completed', value: traineeSummary.completed, color: 'success', icon: CheckCircle },
                { label: 'Overdue', value: traineeSummary.overdue, color: traineeSummary.overdue > 0 ? 'danger' : 'default', icon: AlertTriangle },
                { label: 'Approved', value: traineeSummary.approved, color: traineeSummary.approved > 0 ? 'success' : 'default', icon: ShieldCheck },
              ]}
            />

            <ExpandableDataTable<ProcessedTrainingRecord>
              columns={drillDownColumns}
              data={traineeRecords}
              getRowId={(row) => row.id}
              getRowClassName={(row) => cn(row.status === 'Overdue' && "bg-destructive/10")}
              onRowClick={(row) => {
                setSelectedTrainingId(row.id);
                setNavigationLevel('detail');
              }}
              expandedContent={(row) => (
                <div className="space-y-2 text-sm">
                  {row.pendingStep && row.pendingStep !== 'Unknown' && (
                    <div>
                      <span className="font-medium text-muted-foreground">Pending Steps: </span>
                      {row.pendingStep}
                    </div>
                  )}
                  <div>
                    <span className="font-medium text-muted-foreground">Training ID: </span>
                    {row.id}
                  </div>
                </div>
              )}
            />
          </>
        ) : selectedTraining ? (
          <>
            {/* Header */}
            <div>
              <h3 className="text-lg font-semibold">{selectedTraining.title}</h3>
              <p className="text-sm text-muted-foreground">{selectedTraining.id}</p>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{selectedTraining.category}</Badge>
              {selectedTraining.status === 'Completed'
                ? <Badge className="bg-teal-500 hover:bg-teal-600 text-white">Completed</Badge>
                : selectedTraining.status === 'Overdue'
                  ? <Badge variant="destructive">Late!</Badge>
                  : <Badge className="bg-amber-400 hover:bg-amber-500 text-black">WIP</Badge>
              }
              {(() => {
                const a = selectedTraining.approval.toLowerCase();
                if (a === 'approved') return <Badge className="bg-green-500 hover:bg-green-600 text-white border-transparent">Approved</Badge>;
                if (selectedTraining.approval) return <Badge variant="secondary">{selectedTraining.approval}</Badge>;
                return <Badge variant="outline">Approval Pending</Badge>;
              })()}
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-4 rounded-lg border p-4">
              <div>
                <p className="text-xs text-muted-foreground">Trainee</p>
                <p className="text-sm font-medium">{selectedTraining.trainee}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Deadline</p>
                <p className="text-sm font-medium">
                  {isValid(selectedTraining.deadline) ? format(selectedTraining.deadline, 'PPP') : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Completed On</p>
                <p className="text-sm font-medium">{selectedTraining.completedOn || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Timeliness</p>
                <p className="text-sm font-medium">{computeTimeliness(selectedTraining)}</p>
              </div>
            </div>

            {/* Detail sections */}
            {selectedTraining.pendingStep && selectedTraining.pendingStep !== 'Unknown' && selectedTraining.status !== 'Completed' && (
              <DetailSection
                title="Pending Steps"
                content={selectedTraining.pendingStep}
              />
            )}
          </>
        ) : null}
      </DrillDownSheet>

      {/* Category Drill-Down Sheet (Level 1 only) */}
      <DrillDownSheet
        open={!!selectedCategory}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedCategory(null);
          }
        }}
        title={`Category: ${selectedCategory}`}
        onExportCsv={() => {
          exportToCsv(
            categoryRecords.map(r => r.raw),
            [
              { key: 'Record training ID', header: 'Training ID' },
              { key: 'Title', header: 'Title' },
              { key: 'Trainee', header: 'Trainee' },
              { key: 'Deadline for completing training', header: 'Deadline' },
              { key: 'Final training approval', header: 'Approval' },
              { key: 'Completed On', header: 'Completed On' },
              { key: 'Pending Steps', header: 'Pending Steps' },
            ],
            `training-category-${selectedCategory?.replace(/\s+/g, '-').toLowerCase() ?? 'export'}.csv`
          );
        }}
      >
        <SummaryBar
          metrics={[
            { label: 'Total in Category', value: categorySummary.total, icon: ListTodo },
            { label: 'Completion Rate', value: `${categorySummary.completionRate}%`, color: categorySummary.completionRate >= 80 ? 'success' : 'warning', icon: CheckCircle },
            { label: 'Overdue', value: categorySummary.overdue, color: categorySummary.overdue > 0 ? 'danger' : 'default', icon: AlertTriangle },
            { label: 'Unique Trainees', value: categorySummary.uniqueTrainees, icon: Users },
          ]}
        />

        <ExpandableDataTable<ProcessedTrainingRecord>
          columns={[
            ...drillDownColumns.slice(0, 1), // Title
            { key: 'trainee', header: 'Trainee', sortable: true }, // Add trainee column for category view
            ...drillDownColumns.slice(1),  // remaining columns
          ]}
          data={categoryRecords}
          getRowId={(row) => row.id}
          getRowClassName={(row) => cn(row.status === 'Overdue' && "bg-destructive/10")}
          expandedContent={(row) => (
            <div className="space-y-2 text-sm">
              {row.pendingStep && row.pendingStep !== 'Unknown' && (
                <div>
                  <span className="font-medium text-muted-foreground">Pending Steps: </span>
                  {row.pendingStep}
                </div>
              )}
              <div>
                <span className="font-medium text-muted-foreground">Training ID: </span>
                {row.id}
              </div>
            </div>
          )}
        />
      </DrillDownSheet>
    </div>
  );
}
