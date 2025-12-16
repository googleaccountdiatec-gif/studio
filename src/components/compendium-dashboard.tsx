"use client";

import React, { useMemo, useState } from 'react';
import { useData } from '@/contexts/data-context';
import { GlassCard } from '@/components/ui/glass-card';
import { parse, isValid, startOfDay, isAfter, getQuarter, subWeeks } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, LineChart, Line, CartesianGrid, Cell } from 'recharts';
import { getProductionTeam } from '@/lib/teams';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from '@/components/ui/label';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

// Helper functions
const parseDate = (dateString: string): Date => {
  if (!dateString) return new Date('invalid');
  const formats = ["dd/MM/yyyy hh:mm a", "dd/MM/yyyy H:mm", "dd/MM/yyyy", 'M/d/yyyy', 'MM/dd/yyyy', 'dd.MM.yyyy'];
  for (const fmt of formats) {
    const parsed = parse(dateString.trim(), fmt, new Date());
    if (isValid(parsed)) return parsed;
  }
  const isoParsed = new Date(dateString);
  if (isValid(isoParsed)) return isoParsed;
  return new Date('invalid');
};

const parseTrainingDate = (row: any): Date => {
    let deadline = new Date('invalid');
    const dateParts = row['Deadline for completing training']?.split('/');
    if (dateParts && dateParts.length === 3) {
        deadline = new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`);
    }
    if (!isValid(deadline)) {
        deadline = parse(row['Deadline for completing training'], 'dd/MM/yyyy', new Date());
    }
    return deadline;
}

export default function CompendiumDashboard() {
  const { capaData, changeActionData, nonConformanceData, trainingData } = useData();
  const [teamFilter, setTeamFilter] = useState<'all' | 'production'>('all');
  const productionTeam = getProductionTeam();

  // --- Non-Conformance Logic ---
  const ncChartData = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;
    const years = [previousYear, currentYear];
    const quarters = [1, 2, 3, 4];

    const aggregated: { [key: string]: { lowRisk: number; highRisk: number; total: number; reoccurring: number } } = {};

    years.forEach(year => {
      quarters.forEach(q => {
        const key = `${year}-Q${q}`;
        aggregated[key] = { lowRisk: 0, highRisk: 0, total: 0, reoccurring: 0 };
      });
    });

    nonConformanceData.forEach(item => {
      if (teamFilter === 'production') {
          const worker = item["Case Worker"];
          const registeredBy = item["Registered By"];
          if (!productionTeam.includes(worker) && !productionTeam.includes(registeredBy)) {
              return;
          }
      }

      const date = parseDate(item["Registration Time"]);
      if (!isValid(date)) return;
      
      const year = date.getFullYear();
      if (!years.includes(year)) return;

      const quarter = getQuarter(date);
      const key = `${year}-Q${quarter}`;

      if (aggregated[key]) {
        aggregated[key].total++;
        if (item.Classification === 'Low risk') aggregated[key].lowRisk++;
        if (item.Classification === 'High risk') aggregated[key].highRisk++;
        if (item.Reoccurrence === 'YES') aggregated[key].reoccurring++;
      }
    });

    return Object.entries(aggregated).map(([key, value]) => ({ name: key, ...value }));
  }, [nonConformanceData, teamFilter, productionTeam]);


  // --- Helper: Calculate Overdue Counts ---
  const getOverdueSnapshot = (referenceDate: Date) => {
    let capaExecution = 0;
    let capaEffectiveness = 0;
    let changeActions = 0;
    let training = 0;
    let nonConformance = 0;

    // CAPA
    capaData.forEach(item => {
       if (teamFilter === 'production' && !productionTeam.includes(item['Assigned To'])) return;
       if (!item['Pending Steps'] || item['Pending Steps'].trim() === '') return;

       const isEffectiveness = item['Pending Steps']?.toLowerCase().includes('effectiveness');
       const dateString = isEffectiveness ? item['Deadline for effectiveness check'] : item['Due Date'];
       const dueDate = parseDate(dateString);

       if (isValid(dueDate) && isAfter(referenceDate, dueDate)) {
           if (isEffectiveness) capaEffectiveness++;
           else capaExecution++;
       }
    });

    // Change Actions
    changeActionData.forEach(item => {
        if (teamFilter === 'production' && !productionTeam.includes(item['Responsible'])) return;
        if (!item['Pending Steps'] || item['Pending Steps'].trim() === '') return;

        const deadline = parseDate(item.Deadline);
        if (isValid(deadline) && isAfter(referenceDate, deadline)) {
            changeActions++;
        }
    });

    // Training
    trainingData.forEach(item => {
        if (teamFilter === 'production' && !productionTeam.includes(item['Trainee'])) return;
        const pendingSteps = item['Pending Steps']?.trim();
        if (!pendingSteps) return;

        const deadline = parseTrainingDate(item);
        if (isValid(deadline) && isAfter(referenceDate, deadline)) {
            training++;
        }
    });

    // Non-Conformance
    nonConformanceData.forEach(item => {
        if (teamFilter === 'production') {
            const worker = item["Case Worker"];
            const registeredBy = item["Registered By"];
            if (!productionTeam.includes(worker) && !productionTeam.includes(registeredBy)) {
                return;
            }
        }
        if (item.Status === 'Deadline Exceeded') {
            nonConformance++;
        }
    });

    return { nonConformance, capaExecution, capaEffectiveness, changeActions, training };
  };

  // --- Overdue Data (Current) ---
  const overdueData = useMemo(() => {
    const today = startOfDay(new Date());
    const counts = getOverdueSnapshot(today);

    return [
        { name: 'Non-Conformance', count: counts.nonConformance, fill: 'hsl(var(--chart-2))' },
        { name: 'CAPA (Exec)', count: counts.capaExecution, fill: 'hsl(var(--chart-1))' },
        { name: 'CAPA (Eff)', count: counts.capaEffectiveness, fill: 'hsl(var(--chart-3))' },
        { name: 'Change Actions', count: counts.changeActions, fill: 'hsl(var(--primary))' },
        { name: 'Training', count: counts.training, fill: 'hsl(var(--chart-4))' },
    ];
  }, [capaData, changeActionData, trainingData, nonConformanceData, teamFilter, productionTeam]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Bi-Weekly Changes (Formatted with Colors) ---
  const biWeeklyChanges = useMemo(() => {
    const today = startOfDay(new Date());
    const twoWeeksAgo = subWeeks(today, 2);
    
    const currentCounts = getOverdueSnapshot(today);
    const pastCounts = getOverdueSnapshot(twoWeeksAgo);

    // We include the 'fill' color directly in this object so the text can match the graph
    return [
        { label: 'Non-Conformance', delta: currentCounts.nonConformance - pastCounts.nonConformance, fill: 'hsl(var(--chart-2))' },
        { label: 'CAPA (Exec)', delta: currentCounts.capaExecution - pastCounts.capaExecution, fill: 'hsl(var(--chart-1))' },
        { label: 'CAPA (Eff)', delta: currentCounts.capaEffectiveness - pastCounts.capaEffectiveness, fill: 'hsl(var(--chart-3))' },
        { label: 'Change Actions', delta: currentCounts.changeActions - pastCounts.changeActions, fill: 'hsl(var(--primary))' },
        { label: 'Training', delta: currentCounts.training - pastCounts.training, fill: 'hsl(var(--chart-4))' },
    ];
  }, [capaData, changeActionData, trainingData, nonConformanceData, teamFilter, productionTeam]); // eslint-disable-line react-hooks/exhaustive-deps


  return (
    <div className="space-y-6">
      
      {/* Top Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard className="p-6">
            <h3 className="text-lg font-semibold mb-4">NC Risk & Volume (Current & Prev. Year)</h3>
            <ResponsiveContainer width="100%" height={250}>
                <BarChart data={ncChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{fontSize: 10}} interval={0} angle={-45} textAnchor="end" height={60} />
                    <YAxis width={30} tick={{fontSize: 10}} />
                    <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', backdropFilter: 'blur(4px)', border: '1px solid hsl(var(--border))' }} />
                    <Legend wrapperStyle={{fontSize: '12px'}} />
                    <Bar dataKey="lowRisk" name="Low Risk" fill="hsl(var(--chart-4))"  />
                    <Bar dataKey="highRisk" name="High Risk" fill="hsl(var(--chart-2))"  />
                    <Bar dataKey="total" name="Total" fill="hsl(var(--chart-1))"  />
                </BarChart>
            </ResponsiveContainer>
        </GlassCard>

        <GlassCard className="p-6">
            <h3 className="text-lg font-semibold mb-4">NC Reoccurrence Trend (Current & Prev. Year)</h3>
            <ResponsiveContainer width="100%" height={250}>
                 <LineChart data={ncChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{fontSize: 10}} interval={0} angle={-45} textAnchor="end" height={60} />
                    <YAxis width={30} tick={{fontSize: 10}} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', backdropFilter: 'blur(4px)', border: '1px solid hsl(var(--border))' }} />
                    <Legend wrapperStyle={{fontSize: '12px'}} />
                    <Line type="monotone" dataKey="reoccurring" name="Reoccurring" stroke="hsl(var(--primary))" strokeWidth={2} dot={{r: 4}} />
                 </LineChart>
            </ResponsiveContainer>
        </GlassCard>
      </div>

      {/* Bottom Section: Overdue Metrics & Changes */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Total Overdue Overview</h3>
             <RadioGroup value={teamFilter} onValueChange={(value) => setTeamFilter(value as any)} className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="t1-comp" />
                    <Label htmlFor="t1-comp" className="text-sm">All Operators</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="production" id="t2-comp" />
                    <Label htmlFor="t2-comp" className="text-sm">Production Only</Label>
                </div>
            </RadioGroup>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Chart Area */}
            <div className="md:col-span-2 h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={overdueData} layout="vertical" margin={{ left: 20, right: 30 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12, fontWeight: 500 }} />
                        <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', backdropFilter: 'blur(4px)', border: '1px solid hsl(var(--border))' }} />
                        <Bar dataKey="count" name="Overdue Items" radius={[0, 4, 4, 0]} barSize={40} label={{ position: 'right', fill: 'hsl(var(--foreground))', fontSize: 12, offset: 5 }}>
                            {
                                overdueData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))
                            }
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Change List Area */}
            <div className="flex flex-col justify-center space-y-4 border-l pl-8 border-border/50">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Change Since Last Bi-Weekly</h4>
                {biWeeklyChanges.map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{item.label}</span>
                        {/* We apply the specific graph color to this text block */}
                        <div 
                            className="flex items-center gap-1 font-bold"
                            style={{ color: item.fill }}
                        >
                            {item.delta > 0 && <ArrowUp className="w-4 h-4" />}
                            {item.delta < 0 && <ArrowDown className="w-4 h-4" />}
                            {item.delta === 0 && <Minus className="w-4 h-4" />}
                            <span>{Math.abs(item.delta)}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </GlassCard>

    </div>
  );
}