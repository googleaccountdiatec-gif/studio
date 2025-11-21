"use client";

import React, { useState, useMemo } from 'react';
import { useData } from '@/contexts/data-context';
import { GlassCard } from '@/components/ui/glass-card';
import { parse, isValid, startOfDay, isAfter, format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import { DataTable, DataTableColumn } from './data-table';
import { Badge } from './ui/badge';
import { FileUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip as TooltipUI, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getProductionTeam } from '@/lib/teams';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from '@/components/ui/label';

interface TrainingData {
  'Record training ID': string;
  'Title': string;
  'Trainee': string;
  'Training category': string;
  'Pending Steps': string;
  'Deadline for completing training': string;
}

interface ProcessedTrainingRecord {
  id: string;
  title: string;
  trainee: string;
  category: string;
  deadline: Date;
  status: 'Completed' | 'Pending' | 'Overdue';
  pendingStep: string;
}

const parseTrainingData = (row: TrainingData): ProcessedTrainingRecord => {
  const today = startOfDay(new Date());
  let deadline = new Date('invalid');
  
  // Try parsing DD/MM/YYYY
  const dateParts = row['Deadline for completing training']?.split('/');
  if (dateParts && dateParts.length === 3) {
      deadline = new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`);
  }
  
  // Fallback if simple split fails or date is invalid
  if (!isValid(deadline)) {
      // Try standard parser just in case
      deadline = parse(row['Deadline for completing training'], 'dd/MM/yyyy', new Date());
  }

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
    pendingStep: pendingSteps || 'Unknown'
  };
};

export default function TrainingDashboard() {
  const { trainingData } = useData();
  const [teamFilter, setTeamFilter] = useState<'all' | 'production'>('all');
  const productionTeam = getProductionTeam();

  const processedData = useMemo(() => {
    let data = trainingData.map((row: any) => parseTrainingData(row));

    if (teamFilter === 'production') {
        data = data.filter(item => productionTeam.includes(item.trainee));
    }
    return data;
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

  // Use semantic CSS variables for theme-aware colors
  const PIE_COLORS = [
    'hsl(var(--chart-1))', 
    'hsl(var(--chart-2))', 
    'hsl(var(--chart-3))', 
    'hsl(var(--chart-4))', 
    'hsl(var(--chart-5))'
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

  // Dynamic height calculation: 50px per user + 50px buffer, with a minimum of 300px
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
        </GlassCard>
      </div>

      {/* Visuals */}
      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard className="p-6">
            <h3 className="text-lg font-semibold mb-4">Training Overview</h3>
            <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} interval={0} />
                    <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', backdropFilter: 'blur(4px)', border: '1px solid hsl(var(--border))' }} />
                    <Legend />
                    <Bar dataKey="completed" name="Completed" stackId="a" fill="hsl(var(--chart-5))" />
                    <Bar dataKey="pending" name="Pending" stackId="a" fill="hsl(var(--chart-2))" />
                    <Bar dataKey="overdue" name="Overdue" stackId="a" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
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
    </div>
  );
}
