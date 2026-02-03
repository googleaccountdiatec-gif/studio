"use client";

import React, { useMemo, useState } from 'react';
import { useData } from '@/contexts/data-context';
import { GlassCard } from '@/components/ui/glass-card';
import { parse, isValid, startOfDay, isAfter, getQuarter, subWeeks, isBefore, endOfDay } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, LineChart, Line, CartesianGrid, Cell } from 'recharts';
import { getProductionTeam } from '@/lib/teams';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from '@/components/ui/label';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

// --- Helper Functions ---

const parseDate = (dateString: any): Date => {
  if (!dateString) return new Date('invalid');
  const str = String(dateString).trim();
  
  // Try strictly formatted parses first
  const formats = [
    "dd.MM.yyyy HH:mm:ss", 
    "dd.MM.yyyy HH:mm",
    "dd.MM.yyyy",
    "dd/MM/yyyy hh:mm a",
    "dd/MM/yyyy HH:mm", 
    "dd/MM/yyyy",
    "yyyy-MM-dd",
  ];

  for (const fmt of formats) {
    const parsed = parse(str, fmt, new Date());
    if (isValid(parsed)) return parsed;
  }

  // Fallback to standard Date constructor (handles ISO etc)
  const isoParsed = new Date(str);
  if (isValid(isoParsed)) return isoParsed;
  
  return new Date('invalid');
};

/**
 * Determines if an item was overdue relative to a specific reference date.
 * * @param deadlineStr - The deadline string from the data.
 * @param completedDateStr - The completion date string from the data.
 * @param referenceDate - The date we are checking against (e.g., Today or 2 Weeks Ago).
 * @returns true if the task was Open AND Past Deadline at the reference moment.
 */
const isTaskOverdue = (deadlineStr: any, completedDateStr: any, referenceDate: Date): boolean => {
    const deadline = parseDate(deadlineStr);
    
    // If no valid deadline exists, it cannot be calculated as overdue
    if (!isValid(deadline)) return false;

    // 1. Check if the deadline had passed by the reference date
    // We strictly check if Deadline < ReferenceDate. 
    // (e.g. if Deadline is Today and Reference is Today, it is usually NOT overdue yet, depending on precision. 
    // We assume deadline is end of day, so strict comparison is safer).
    if (!isBefore(deadline, referenceDate)) return false;

    // 2. Check if it was completed *before* the reference date
    const completedAt = parseDate(completedDateStr);
    
    if (isValid(completedAt)) {
        // If it was completed, and the completion happened BEFORE or ON the reference date,
        // then it was NOT overdue at that time (it was already done).
        if (isBefore(completedAt, referenceDate) || completedAt.getTime() === referenceDate.getTime()) {
            return false;
        }
    }

    // If we are here:
    // a) Reference date is strictly AFTER the deadline
    // b) It wasn't completed yet (or completion date is in the future relative to ref date)
    return true;
};

export default function CompendiumDashboard() {
  const { capaData, changeActionData, nonConformanceData, trainingData, documentKpiData } = useData();
  const [teamFilter, setTeamFilter] = useState<'all' | 'production'>('all');
  const productionTeam = getProductionTeam();

  // --- Non-Conformance Chart Logic ---
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
       
       const pendingSteps = item['Pending Steps']?.trim() || "";
       const isEffectiveness = pendingSteps.toLowerCase().includes('effectiveness');
       
       // Use "Deadline for effectiveness check" if present, otherwise "Due Date"
       // This handles completed items correctly by checking the relevant deadline field.
       const deadlineStr = item['Deadline for effectiveness check'] || item['Due Date'];

       if (isTaskOverdue(deadlineStr, item['Completed On'], referenceDate)) {
           // We classify based on current pending step or default to Exec if unknown
           if (isEffectiveness) capaEffectiveness++;
           else capaExecution++;
       }
    });

    // Change Actions
    changeActionData.forEach(item => {
        if (teamFilter === 'production' && !productionTeam.includes(item['Responsible'])) return;
        
        if (isTaskOverdue(item['Deadline'], item['Completed On'], referenceDate)) {
            changeActions++;
        }
    });

    // Training
    trainingData.forEach(item => {
        if (teamFilter === 'production' && !productionTeam.includes(item['Trainee'])) return;
        
        if (isTaskOverdue(item['Deadline for completing training'], item['Completed On'], referenceDate)) {
            training++;
        }
    });

    // Non-Conformance
    // NC Data often lacks a specific "Due Date" column. We rely on Status for current snapshot.
    // We cannot accurately calculate historical overdue for NC without a deadline date.
    nonConformanceData.forEach(item => {
        if (teamFilter === 'production') {
            const worker = item["Case Worker"];
            const registeredBy = item["Registered By"];
            if (!productionTeam.includes(worker) && !productionTeam.includes(registeredBy)) {
                return;
            }
        }

        // Check if we are calculating "Current" (approx today)
        const isCurrentSnapshot = Math.abs(referenceDate.getTime() - new Date().getTime()) < 86400000;

        if (isCurrentSnapshot) {
            // For current status, we trust the system status
            if (item['Status'] === 'Deadline Exceeded') {
                nonConformance++;
            }
        } else {
            // For historical, without a Deadline column, we return 0 (or N/A) to avoid "wildly wrong" data.
            // If the data is updated with a 'Due Date' column later, we can use:
            // if (isTaskOverdue(item['Due Date'], item['Completed On'], referenceDate)) nonConformance++;
        }
    });

    return { nonConformance, capaExecution, capaEffectiveness, changeActions, training };
  };

  // --- Overdue Data (Current) ---
  const overdueData = useMemo(() => {
    const today = new Date();
    const counts = getOverdueSnapshot(today);

    return [
        { name: 'Non-Conformance', count: counts.nonConformance, fill: 'hsl(var(--chart-2))' },
        { name: 'CAPA (Exec)', count: counts.capaExecution, fill: 'hsl(var(--chart-1))' },
        { name: 'CAPA (Eff)', count: counts.capaEffectiveness, fill: 'hsl(var(--chart-3))' },
        { name: 'Change Actions', count: counts.changeActions, fill: 'hsl(var(--primary))' },
        { name: 'Training', count: counts.training, fill: 'hsl(var(--chart-4))' },
    ];
  }, [capaData, changeActionData, trainingData, nonConformanceData, teamFilter, productionTeam]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Bi-Weekly Changes ---
  const biWeeklyChanges = useMemo(() => {
    const today = new Date();
    const twoWeeksAgo = subWeeks(today, 2);
    
    const currentCounts = getOverdueSnapshot(today);
    const pastCounts = getOverdueSnapshot(twoWeeksAgo);

    return [
        { 
            label: 'Non-Conformance', 
            // Since we can't reliably calc history for NC, we show 0 change or handle strictly
            delta: currentCounts.nonConformance > 0 && pastCounts.nonConformance === 0 ? 0 : currentCounts.nonConformance - pastCounts.nonConformance, 
            fill: 'hsl(var(--chart-2))' 
        },
        { label: 'CAPA (Exec)', delta: currentCounts.capaExecution - pastCounts.capaExecution, fill: 'hsl(var(--chart-1))' },
        { label: 'CAPA (Eff)', delta: currentCounts.capaEffectiveness - pastCounts.capaEffectiveness, fill: 'hsl(var(--chart-3))' },
        { label: 'Change Actions', delta: currentCounts.changeActions - pastCounts.changeActions, fill: 'hsl(var(--primary))' },
        { label: 'Training', delta: currentCounts.training - pastCounts.training, fill: 'hsl(var(--chart-4))' },
    ];
  }, [capaData, changeActionData, trainingData, nonConformanceData, teamFilter, productionTeam]); // eslint-disable-line react-hooks/exhaustive-deps

    // --- Documents in Flow Summary ---
  const documentsInFlowSummary = useMemo(() => {
    const documentsInFlow = documentKpiData.filter(doc => doc['Pending Steps'] && doc['Pending Steps'].trim() !== '');
    
    let majorRevisions = 0;
    let minorRevisions = 0;
    let newDocuments = 0;

    documentsInFlow.forEach(doc => {
      const flow = (doc['Document Flow'] || '').toLowerCase();
      if (flow.includes('major')) {
        majorRevisions++;
      } else if (flow.includes('minor')) {
        minorRevisions++;
      } else if (flow.includes('create') || flow.includes('new')) {
        newDocuments++;
      }
    });

    return {
      total: documentsInFlow.length,
      majorRevisions,
      minorRevisions,
      newDocuments
    };
  }, [documentKpiData]);


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

      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold mb-4">Documents in Flow Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center items-center py-4">
             <div>
                <p className="text-4xl font-bold text-primary">{documentsInFlowSummary.total}</p>
                <p className="text-sm text-muted-foreground mt-1">Total In Flow</p>
            </div>
            <div>
                <p className="text-3xl font-bold">{documentsInFlowSummary.majorRevisions}</p>
                <p className="text-sm text-muted-foreground mt-1">Major Revisions</p>
            </div>
            <div>
                <p className="text-3xl font-bold">{documentsInFlowSummary.minorRevisions}</p>
                <p className="text-sm text-muted-foreground mt-1">Minor Revisions</p>
            </div>
            <div>
                <p className="text-3xl font-bold">{documentsInFlowSummary.newDocuments}</p>
                <p className="text-sm text-muted-foreground mt-1">New Documents</p>
            </div>
        </div>
      </GlassCard>

    </div>
  );
}
