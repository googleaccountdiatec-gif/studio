"use client";

import React, { useState, useMemo } from 'react';
import { useData } from '@/contexts/data-context';
import { GlassCard } from '@/components/ui/glass-card';
import { isValid, startOfDay, isAfter, format, subDays } from 'date-fns';
import { parseDate } from '@/lib/date-utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import { DataTable, DataTableColumn } from './data-table';
import { Badge } from './ui/badge';
import { FileUp, ArrowUpIcon, ArrowDownIcon, ListTodo, AlertTriangle, CheckCircle, ShieldCheck, Users } from 'lucide-react';
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

  const processedData = useMemo(() => {
    let data = trainingData.map((row: any) => parseTrainingData(row));

    if (teamFilter === 'production') {
        data = data.filter(item => productionTeam.includes(item.trainee));
    }
    return data;
  }, [trainingData, teamFilter, productionTeam]);

  // NEW: Trend Logic
  const biWeeklyTrend = useMemo(() => {
      const today = startOfDay(new Date());
      const twoWeeksAgo = subDays(today, 14);

      let newOverdue = 0;
      let resolvedOverdue = 0;

      // Use raw parsed data but apply team filter if needed
      let trendData = trainingData.map((row: any) => parseTrainingData(row));
      if (teamFilter === 'production') {
          trendData = trendData.filter(item => productionTeam.includes(item.trainee));
      }

      trendData.forEach(item => {
          // +1: Became overdue in last 14 days
          if (item.status === 'Overdue' && item.deadline >= twoWeeksAgo && item.deadline < today) {
              newOverdue++;
          }

          // -1: Was overdue 14 days ago, but is now Completed
          if (item.status === 'Completed' && item.deadline < twoWeeksAgo) {
              resolvedOverdue++;
          }
      });

      return newOverdue - resolvedOverdue;
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

      {/* Top-Level Stats */}
      <div className="grid gap-6 md:grid-cols-3">
        <GlassCard className="flex flex-col justify-center items-center p-6">
            <h3 className="text-muted-foreground text-sm uppercase tracking-wider font-semibold">Total Assignments</h3>
            <p className="text-5xl font-bold mt-2">{stats.total}</p>
        </GlassCard>

        <GlassCard className="flex flex-col justify-center items-center p-6">
             <h3 className="text-muted-foreground text-sm uppercase tracking-wider font-semibold mb-4">Completion Rate</h3>
             <div className="h-[120px] w-[120px] relative">
                <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                        innerRadius="80%"
                        outerRadius="100%"
                        data={[{ name: 'completion', value: stats.completionRate, fill: 'hsl(var(--primary))' }]}
                        startAngle={90}
                        endAngle={-270}
                    >
                        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                        <RadialBar background dataKey="value" cornerRadius={10} />
                    </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-2xl font-bold">{Math.round(stats.completionRate)}%</span>
                </div>
             </div>
        </GlassCard>

        <GlassCard className="flex flex-col justify-center items-center p-6">
            <h3 className="text-muted-foreground text-sm uppercase tracking-wider font-semibold">Overdue List</h3>
            <p className={cn("text-5xl font-bold mt-2", stats.overdue > 0 ? "text-destructive" : "text-emerald-500")}>
                {stats.overdue}
            </p>
             <p className="text-xs text-muted-foreground mt-1">{stats.overdue > 0 ? "Action Required!" : "All Clear"}</p>
             {/* Manually inserted trend since GlassCard is used */}
             {biWeeklyTrend !== 0 && (
                <div className="flex items-center text-xs mt-2">
                    {biWeeklyTrend > 0 ? (
                        <span className="text-destructive flex items-center font-medium">
                        <ArrowUpIcon className="mr-1 h-3 w-3" /> +{biWeeklyTrend}
                        </span>
                    ) : (
                        <span className="text-emerald-500 flex items-center font-medium">
                        <ArrowDownIcon className="mr-1 h-3 w-3" /> {biWeeklyTrend}
                        </span>
                    )}
                    <span className="text-muted-foreground ml-1">since last bi-weekly</span>
                </div>
             )}
        </GlassCard>
      </div>

      {/* Visuals */}
      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard className="p-6">
            <h3 className="text-lg font-semibold mb-4">Training Overview</h3>
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
                    {/* 1. Completed: The success state  */}
                    <Bar dataKey="completed" name="Completed" stackId="a" fill="hsl(var(--chart-4))" cursor="pointer" />

                    {/* 2. Pending: Soft, light pink (The "Curida" secondary color) */}
                    <Bar dataKey="pending" name="Pending" stackId="a" fill="hsl(var(--chart-2))" cursor="pointer" />

                    {/* 3. Overdue: Heavy, dominant Red (The "Curida" primary/chart-1) */}
                    <Bar dataKey="overdue" name="Overdue" stackId="a" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} cursor="pointer" />
                </BarChart>
            </ResponsiveContainer>
        </GlassCard>

        <GlassCard className="p-6">
            <h3 className="text-lg font-semibold mb-4">Process Overview</h3>
            <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                    <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        onClick={(data) => {
                          if (data && data.name) {
                            setSelectedCategory(data.name);
                          }
                        }}
                        cursor="pointer"
                    >
                        {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', backdropFilter: 'blur(4px)', border: '1px solid hsl(var(--border))' }} />
                    <Legend layout="vertical" verticalAlign="middle" align="right" />
                </PieChart>
            </ResponsiveContainer>
        </GlassCard>
      </div>

      {/* Detailed View */}
      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold mb-4">The Call Out List</h3>
        <DataTable
            columns={columns}
            data={processedData}
            getRowClassName={(row) => cn(row.status === 'Overdue' && "bg-destructive/10 hover:bg-destructive/20")}
        />
      </GlassCard>

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
