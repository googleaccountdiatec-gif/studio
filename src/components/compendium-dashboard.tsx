"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { useData } from '@/contexts/data-context';
import { GlassCard } from '@/components/ui/glass-card';
import { isValid, startOfDay, isAfter, getQuarter, subWeeks, isBefore, endOfDay, format, differenceInDays, getISOWeek } from 'date-fns';
import { parseDate } from '@/lib/date-utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, LineChart, Line, CartesianGrid, Cell } from 'recharts';
import { getProductionTeam } from '@/lib/teams';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from '@/components/ui/label';
import { ArrowUp, ArrowDown, Minus, Save, History } from 'lucide-react';
import type { DocumentsInFlowMetrics } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { DrillDownSheet, SummaryBar, ExpandableDataTable } from '@/components/drill-down';
import { Badge } from '@/components/ui/badge';
import { exportToCsv } from '@/lib/csv-export';

// --- Helper Functions ---


/**
 * Determines if an item was overdue relative to a specific reference date.
 */
const formatSnapshotLabel = (timestamp: any): string => {
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  if (!isValid(date)) return 'Saved Data';
  const week = getISOWeek(date);
  return `Wk ${week} — ${format(date, 'dd.MM.yy')}`;
};

const isTaskOverdue = (deadlineStr: any, completedDateStr: any, referenceDate: Date): boolean => {
    const deadline = parseDate(deadlineStr);
    if (!isValid(deadline)) return false;
    if (!isBefore(deadline, referenceDate)) return false;

    const completedAt = parseDate(completedDateStr);
    if (isValid(completedAt)) {
        if (isBefore(completedAt, referenceDate) || completedAt.getTime() === referenceDate.getTime()) {
            return false;
        }
    }
    return true;
};

export default function CompendiumDashboard() {
  const { capaData, changeActionData, nonConformanceData, trainingData, documentKpiData, snapshots, saveSnapshot } = useData();
  const [teamFilter, setTeamFilter] = useState<'all' | 'production'>('all');
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>('auto-2-weeks');
  const [isSaving, setIsSaving] = useState(false);
  const [drillThroughData, setDrillThroughData] = useState<{ title: string; items: any[]; category: string } | null>(null);
  const [ncYearRange, setNcYearRange] = useState<string>('current-prev');
  const { toast } = useToast();
  const productionTeam = getProductionTeam();

  // Auto-select the snapshot closest to 2 weeks ago (by ISO week number)
  useEffect(() => {
    if (snapshots.length === 0) return;
    const targetWeek = getISOWeek(subWeeks(new Date(), 2));
    const targetYear = subWeeks(new Date(), 2).getFullYear();

    let bestSnap: typeof snapshots[0] | null = null;
    let bestDiff = Infinity;

    for (const snap of snapshots) {
      const date = snap.timestamp?.toDate ? snap.timestamp.toDate() : new Date(snap.timestamp);
      if (!isValid(date)) continue;
      const snapWeek = getISOWeek(date);
      const snapYear = date.getFullYear();
      // Compare by week distance, weighting year difference by 52
      const diff = Math.abs((snapYear - targetYear) * 52 + (snapWeek - targetWeek));
      if (diff < bestDiff) {
        bestDiff = diff;
        bestSnap = snap;
      }
    }

    if (bestSnap?.id) {
      setSelectedSnapshotId(bestSnap.id);
    }
  }, [snapshots]);

  // --- Non-Conformance Chart Logic ---
  const ncAvailableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    nonConformanceData.forEach(item => {
      const date = parseDate(item["Registration Time"]);
      if (isValid(date)) yearsSet.add(date.getFullYear());
    });
    const currentYear = new Date().getFullYear();
    yearsSet.add(currentYear);
    return [...yearsSet].sort((a, b) => b - a);
  }, [nonConformanceData]);

  const ncSelectedYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    if (ncYearRange === 'current-prev') return [currentYear - 1, currentYear];
    if (ncYearRange === 'last-3') return [currentYear - 2, currentYear - 1, currentYear];
    if (ncYearRange === 'all') return ncAvailableYears;
    // Individual year
    const parsed = parseInt(ncYearRange);
    if (!isNaN(parsed)) return [parsed];
    return [currentYear - 1, currentYear];
  }, [ncYearRange, ncAvailableYears]);

  const ncChartData = useMemo(() => {
    const years = [...ncSelectedYears].sort((a, b) => a - b);
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
  }, [nonConformanceData, teamFilter, productionTeam, ncSelectedYears]);


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
       const deadlineStr = item['Deadline for effectiveness check'] || item['Due Date'];

       if (isTaskOverdue(deadlineStr, item['Completed On'], referenceDate)) {
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
    nonConformanceData.forEach(item => {
        if (teamFilter === 'production') {
            const worker = item["Case Worker"];
            const registeredBy = item["Registered By"];
            if (!productionTeam.includes(worker) && !productionTeam.includes(registeredBy)) return;
        }

        const isCurrentSnapshot = Math.abs(referenceDate.getTime() - new Date().getTime()) < 86400000;
        if (isCurrentSnapshot) {
            if (item['Status'] === 'Deadline Exceeded') nonConformance++;
        }
    });

    return { nonConformance, capaExecution, capaEffectiveness, changeActions, training };
  };

  // --- Documents in Flow Metrics ---
  const getDocumentsInFlowMetrics = (): DocumentsInFlowMetrics => {
    const documentsInFlow = documentKpiData.filter(doc => {
        if (teamFilter === 'production' && !productionTeam.includes(doc['Responsible'])) {
            return false;
        }
        return doc['Pending Steps'] && doc['Pending Steps'].trim() !== '';
    });

    let majorRevisions = 0;
    let minorRevisions = 0;
    let newDocuments = 0;

    documentsInFlow.forEach(doc => {
      const flow = (doc['Document Flow'] || '').toLowerCase();
      if (flow.includes('major')) majorRevisions++;
      else if (flow.includes('minor')) minorRevisions++;
      else if (flow.includes('create') || flow.includes('new')) newDocuments++;
    });

    return { total: documentsInFlow.length, majorRevisions, minorRevisions, newDocuments };
  };

  // --- Current Snapshot Metrics ---
  const currentMetrics = useMemo(() => ({
    ...getOverdueSnapshot(new Date()),
    documentsInFlow: getDocumentsInFlowMetrics(),
  }), [capaData, changeActionData, trainingData, nonConformanceData, documentKpiData, teamFilter, productionTeam]);

  // --- Overdue Data (Current) for Chart ---
  const overdueData = useMemo(() => {
    return [
        { name: 'Non-Conformance', count: currentMetrics.nonConformance, fill: 'hsl(var(--chart-2))' },
        { name: 'CAPA (Exec)', count: currentMetrics.capaExecution, fill: 'hsl(var(--chart-1))' },
        { name: 'CAPA (Eff)', count: currentMetrics.capaEffectiveness, fill: 'hsl(var(--chart-3))' },
        { name: 'Change Actions', count: currentMetrics.changeActions, fill: 'hsl(var(--primary))' },
        { name: 'Training', count: currentMetrics.training, fill: 'hsl(var(--chart-4))' },
    ];
  }, [currentMetrics]);

  // --- Helper: find closest snapshot to a target date ---
  const findClosestSnapshot = (targetDate: Date) => {
    if (snapshots.length === 0) return null;
    let best: typeof snapshots[0] | null = null;
    let bestDiff = Infinity;
    for (const snap of snapshots) {
      const date = snap.timestamp?.toDate ? snap.timestamp.toDate() : new Date(snap.timestamp);
      if (!isValid(date)) continue;
      const diff = Math.abs(differenceInDays(date, targetDate));
      if (diff < bestDiff) { bestDiff = diff; best = snap; }
    }
    return best;
  };

  // --- Bi-Weekly Changes Logic ---
  const { comparisonData, comparisonLabel, docFlowDeltas } = useMemo(() => {
    let pastCounts: any;
    let label = "since last bi-weekly";
    let comparisonDate: Date;
    let pastDocFlow: DocumentsInFlowMetrics | undefined;

    if (selectedSnapshotId === 'auto-2-weeks') {
        comparisonDate = subWeeks(new Date(), 2);
        pastCounts = getOverdueSnapshot(comparisonDate);
        // Use closest saved snapshot for document flow deltas
        const closestSnap = findClosestSnapshot(comparisonDate);
        if (closestSnap?.metrics.documentsInFlow) {
            pastDocFlow = closestSnap.metrics.documentsInFlow;
        }
    } else if (selectedSnapshotId === 'auto-1-week') {
        comparisonDate = subWeeks(new Date(), 1);
        pastCounts = getOverdueSnapshot(comparisonDate);
        label = "since last week";
        const closestSnap = findClosestSnapshot(comparisonDate);
        if (closestSnap?.metrics.documentsInFlow) {
            pastDocFlow = closestSnap.metrics.documentsInFlow;
        }
    } else {
        const snap = snapshots.find(s => s.id === selectedSnapshotId);
        if (snap) {
            pastCounts = snap.metrics;
            pastDocFlow = snap.metrics.documentsInFlow;
            comparisonDate = snap.timestamp?.toDate ? snap.timestamp.toDate() : new Date(snap.timestamp);
            const daysDiff = differenceInDays(new Date(), comparisonDate);

            if (daysDiff === 7) label = "since last week";
            else if (daysDiff === 14) label = "since last bi-weekly";
            else label = `since Wk ${getISOWeek(comparisonDate)} — ${format(comparisonDate, 'dd.MM.yy')}`;
        } else {
            comparisonDate = subWeeks(new Date(), 2);
            pastCounts = getOverdueSnapshot(comparisonDate);
        }
    }

    const deltas = [
        { label: 'Non-Conformance', delta: currentMetrics.nonConformance - pastCounts.nonConformance, fill: 'hsl(var(--chart-2))' },
        { label: 'CAPA (Exec)', delta: currentMetrics.capaExecution - pastCounts.capaExecution, fill: 'hsl(var(--chart-1))' },
        { label: 'CAPA (Eff)', delta: currentMetrics.capaEffectiveness - pastCounts.capaEffectiveness, fill: 'hsl(var(--chart-3))' },
        { label: 'Change Actions', delta: currentMetrics.changeActions - pastCounts.changeActions, fill: 'hsl(var(--primary))' },
        { label: 'Training', delta: currentMetrics.training - pastCounts.training, fill: 'hsl(var(--chart-4))' },
    ];

    const docDeltas = pastDocFlow ? {
        total: currentMetrics.documentsInFlow.total - pastDocFlow.total,
        majorRevisions: currentMetrics.documentsInFlow.majorRevisions - pastDocFlow.majorRevisions,
        minorRevisions: currentMetrics.documentsInFlow.minorRevisions - pastDocFlow.minorRevisions,
        newDocuments: currentMetrics.documentsInFlow.newDocuments - pastDocFlow.newDocuments,
    } : null;

    return { comparisonData: deltas, comparisonLabel: label, docFlowDeltas: docDeltas };
  }, [selectedSnapshotId, snapshots, currentMetrics, capaData, changeActionData, trainingData, nonConformanceData, documentKpiData, teamFilter, productionTeam]);

  const handleSaveSnapshot = async () => {
    setIsSaving(true);
    try {
        await saveSnapshot(currentMetrics);
        toast({
            title: "Snapshot Saved",
            description: "Current metrics have been saved to the database.",
        });
    } catch (error) {
        toast({
            title: "Error",
            description: "Failed to save snapshot.",
            variant: "destructive",
        });
    } finally {
        setIsSaving(false);
    }
  };

  const documentsInFlowSummary = currentMetrics.documentsInFlow;


  return (
    <div className="space-y-6">
      
      {/* Top Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">NC Risk & Volume</h3>
                <Select value={ncYearRange} onValueChange={setNcYearRange}>
                    <SelectTrigger className="h-7 w-[180px] text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="end">
                        <SelectItem value="current-prev">Current & Prev. Year</SelectItem>
                        <SelectItem value="last-3">Last 3 Years</SelectItem>
                        <SelectItem value="all">All Years</SelectItem>
                        {ncAvailableYears.map(year => (
                            <SelectItem key={year} value={String(year)}>{year} Only</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
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
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">NC Reoccurrence Trend</h3>
                <Select value={ncYearRange} onValueChange={setNcYearRange}>
                    <SelectTrigger className="h-7 w-[180px] text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="end">
                        <SelectItem value="current-prev">Current & Prev. Year</SelectItem>
                        <SelectItem value="last-3">Last 3 Years</SelectItem>
                        <SelectItem value="all">All Years</SelectItem>
                        {ncAvailableYears.map(year => (
                            <SelectItem key={year} value={String(year)}>{year} Only</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
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
            <div className="flex items-center gap-4">
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleSaveSnapshot} 
                    disabled={isSaving}
                    className="h-8 gap-2"
                >
                    <Save className="w-4 h-4" />
                    {isSaving ? "Saving..." : "Save Snapshot"}
                </Button>
                <RadioGroup value={teamFilter} onValueChange={(value) => setTeamFilter(value as any)} className="flex items-center gap-4">
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="all" id="t1-comp" />
                        <Label htmlFor="t1-comp" className="text-sm font-normal">All Operators</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="production" id="t2-comp" />
                        <Label htmlFor="t2-comp" className="text-sm font-normal">Production Only</Label>
                    </div>
                </RadioGroup>
            </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Chart Area */}
            <div className="md:col-span-2 h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={overdueData} layout="vertical" margin={{ left: 20, right: 30 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12, fontWeight: 500 }} />
                        <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', backdropFilter: 'blur(4px)', border: '1px solid hsl(var(--border))' }} />
                        <Bar dataKey="count" name="Overdue Items" radius={[0, 4, 4, 0]} barSize={40} label={{ position: 'right', fill: 'hsl(var(--foreground))', fontSize: 12, offset: 5 }} cursor="pointer" onClick={(data: any) => {
                            if (!data || !data.name) return
                            const name = data.name as string
                            const now = new Date()
                            let items: any[] = []
                            if (name.includes('Non-Conformance')) {
                              items = (nonConformanceData as any[]).filter(d => {
                                if (teamFilter === 'production') {
                                  if (!productionTeam.includes(d['Case Worker']) && !productionTeam.includes(d['Registered By'])) return false
                                }
                                return d['Status'] === 'Deadline Exceeded'
                              })
                            } else if (name.includes('CAPA') && name.includes('Exec')) {
                              items = (capaData as any[]).filter(d => {
                                if (teamFilter === 'production' && !productionTeam.includes(d['Assigned To'])) return false
                                const pendingSteps = (d['Pending Steps']?.trim() || '').toLowerCase()
                                if (pendingSteps.includes('effectiveness')) return false
                                const deadlineStr = d['Deadline for effectiveness check'] || d['Due Date']
                                return isTaskOverdue(deadlineStr, d['Completed On'], now)
                              })
                            } else if (name.includes('CAPA') && name.includes('Eff')) {
                              items = (capaData as any[]).filter(d => {
                                if (teamFilter === 'production' && !productionTeam.includes(d['Assigned To'])) return false
                                const pendingSteps = (d['Pending Steps'] || '').trim()
                                if (!pendingSteps.toLowerCase().includes('effectiveness')) return false
                                const deadlineStr = d['Deadline for effectiveness check'] || d['Due Date']
                                return isTaskOverdue(deadlineStr, d['Completed On'], now)
                              })
                            } else if (name.includes('Change')) {
                              items = (changeActionData as any[]).filter(d => {
                                if (teamFilter === 'production' && !productionTeam.includes(d['Responsible'])) return false
                                return isTaskOverdue(d['Deadline'], d['Completed On'], now)
                              })
                            } else if (name.includes('Training')) {
                              items = (trainingData as any[]).filter(d => {
                                if (teamFilter === 'production' && !productionTeam.includes(d['Trainee'])) return false
                                return isTaskOverdue(d['Deadline for completing training'], d['Completed On'], now)
                              })
                            }
                            const category = name.includes('Non-Conformance') ? 'nc'
                              : name.includes('CAPA') ? 'capa'
                              : name.includes('Change') ? 'change-action'
                              : name.includes('Training') ? 'training' : 'unknown'
                            if (items.length > 0) {
                              setDrillThroughData({ title: `Overdue: ${name}`, items, category })
                            }
                          }}>
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
                <div className="flex flex-col gap-1 mb-2">
                    <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Change</h4>
                        <Select value={selectedSnapshotId} onValueChange={setSelectedSnapshotId}>
                            <SelectTrigger className="h-6 w-[150px] text-[10px] bg-transparent border-none shadow-none focus:ring-0 px-0 justify-end gap-1">
                                <History className="w-3 h-3" />
                                <SelectValue placeholder="Select period" />
                            </SelectTrigger>
                            <SelectContent align="end" className="text-xs">
                                <SelectItem value="auto-1-week">Last 7 Days (Auto)</SelectItem>
                                <SelectItem value="auto-2-weeks">Last 14 Days (Auto)</SelectItem>
                                {snapshots.map((snap) => (
                                    <SelectItem key={snap.id} value={snap.id!}>
                                        {formatSnapshotLabel(snap.timestamp)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <p className="text-sm font-semibold capitalize">{comparisonLabel}</p>
                </div>

                {comparisonData.map((item) => (
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
                {docFlowDeltas && (
                  <div className="flex items-center justify-center gap-1 mt-2 text-xs font-semibold text-muted-foreground">
                    <span>Change:</span>
                    {docFlowDeltas.total > 0 && <ArrowUp className="w-3 h-3 text-destructive" />}
                    {docFlowDeltas.total < 0 && <ArrowDown className="w-3 h-3 text-green-500" />}
                    {docFlowDeltas.total === 0 && <Minus className="w-3 h-3" />}
                    <span className={docFlowDeltas.total > 0 ? 'text-destructive' : docFlowDeltas.total < 0 ? 'text-green-500' : ''}>{Math.abs(docFlowDeltas.total)}</span>
                  </div>
                )}
            </div>
            <div>
                <p className="text-3xl font-bold">{documentsInFlowSummary.majorRevisions}</p>
                <p className="text-sm text-muted-foreground mt-1">Major Revisions</p>
                {docFlowDeltas && (
                  <div className="flex items-center justify-center gap-1 mt-2 text-xs font-semibold text-muted-foreground">
                    <span>Change:</span>
                    {docFlowDeltas.majorRevisions > 0 && <ArrowUp className="w-3 h-3 text-destructive" />}
                    {docFlowDeltas.majorRevisions < 0 && <ArrowDown className="w-3 h-3 text-green-500" />}
                    {docFlowDeltas.majorRevisions === 0 && <Minus className="w-3 h-3" />}
                    <span className={docFlowDeltas.majorRevisions > 0 ? 'text-destructive' : docFlowDeltas.majorRevisions < 0 ? 'text-green-500' : ''}>{Math.abs(docFlowDeltas.majorRevisions)}</span>
                  </div>
                )}
            </div>
            <div>
                <p className="text-3xl font-bold">{documentsInFlowSummary.minorRevisions}</p>
                <p className="text-sm text-muted-foreground mt-1">Minor Revisions</p>
                {docFlowDeltas && (
                  <div className="flex items-center justify-center gap-1 mt-2 text-xs font-semibold text-muted-foreground">
                    <span>Change:</span>
                    {docFlowDeltas.minorRevisions > 0 && <ArrowUp className="w-3 h-3 text-destructive" />}
                    {docFlowDeltas.minorRevisions < 0 && <ArrowDown className="w-3 h-3 text-green-500" />}
                    {docFlowDeltas.minorRevisions === 0 && <Minus className="w-3 h-3" />}
                    <span className={docFlowDeltas.minorRevisions > 0 ? 'text-destructive' : docFlowDeltas.minorRevisions < 0 ? 'text-green-500' : ''}>{Math.abs(docFlowDeltas.minorRevisions)}</span>
                  </div>
                )}
            </div>
            <div>
                <p className="text-3xl font-bold">{documentsInFlowSummary.newDocuments}</p>
                <p className="text-sm text-muted-foreground mt-1">New Documents</p>
                {docFlowDeltas && (
                  <div className="flex items-center justify-center gap-1 mt-2 text-xs font-semibold text-muted-foreground">
                    <span>Change:</span>
                    {docFlowDeltas.newDocuments > 0 && <ArrowUp className="w-3 h-3 text-destructive" />}
                    {docFlowDeltas.newDocuments < 0 && <ArrowDown className="w-3 h-3 text-green-500" />}
                    {docFlowDeltas.newDocuments === 0 && <Minus className="w-3 h-3" />}
                    <span className={docFlowDeltas.newDocuments > 0 ? 'text-destructive' : docFlowDeltas.newDocuments < 0 ? 'text-green-500' : ''}>{Math.abs(docFlowDeltas.newDocuments)}</span>
                  </div>
                )}
            </div>
        </div>
        {!docFlowDeltas && (
          <p className="text-xs text-muted-foreground text-center mt-3">Save a snapshot and select it from the history dropdown to track changes.</p>
        )}
      </GlassCard>

      <DrillDownSheet
        open={!!drillThroughData}
        onOpenChange={(open) => !open && setDrillThroughData(null)}
        title={drillThroughData?.title ?? ''}
        onExportCsv={() => {
          if (!drillThroughData) return;
          const cat = drillThroughData.category;
          const cols = cat === 'capa'
            ? [{ key: 'CAPA ID', header: 'ID' }, { key: 'Title', header: 'Title' }, { key: 'Priority', header: 'Priority' }, { key: 'Assigned To', header: 'Assigned To' }, { key: 'Pending Steps', header: 'Phase' }]
            : cat === 'nc'
            ? [{ key: 'Id', header: 'ID' }, { key: 'Non Conformance Title', header: 'Title' }, { key: 'Classification', header: 'Classification' }, { key: 'Case Worker', header: 'Case Worker' }, { key: 'Status', header: 'Status' }]
            : cat === 'change-action'
            ? [{ key: 'Change_ActionID', header: 'ID' }, { key: 'Title', header: 'Title' }, { key: 'Responsible', header: 'Responsible' }, { key: 'Deadline', header: 'Deadline' }, { key: 'Approve', header: 'Approval' }]
            : [{ key: 'Record training ID', header: 'ID' }, { key: 'Title', header: 'Title' }, { key: 'Trainee', header: 'Trainee' }, { key: 'Deadline for completing training', header: 'Deadline' }, { key: 'Training category', header: 'Category' }];
          exportToCsv(drillThroughData.items, cols, `overdue-${cat}_${new Date().toISOString().slice(0, 10)}.csv`);
        }}
      >
        <SummaryBar metrics={(() => {
          const items = drillThroughData?.items ?? [];
          const cat = drillThroughData?.category;
          const base = [{ label: 'Overdue Items', value: items.length, color: 'danger' as const }];
          if (cat === 'capa') {
            const highPrio = items.filter((r: any) => r['Priority']?.toLowerCase() === 'high').length;
            if (highPrio > 0) base.push({ label: 'High Priority', value: highPrio, color: 'danger' as const });
          } else if (cat === 'nc') {
            const highRisk = items.filter((r: any) => r['Classification'] === 'High risk').length;
            if (highRisk > 0) base.push({ label: 'High Risk', value: highRisk, color: 'danger' as const });
          }
          return base;
        })()} />
        <ExpandableDataTable
          columns={(() => {
            const cat = drillThroughData?.category;
            if (cat === 'capa') return [
              { key: 'id', header: 'CAPA ID', cell: (row: any) => row['CAPA ID'] || '' },
              { key: 'title', header: 'Title', cell: (row: any) => <span className="max-w-[200px] truncate block">{row['Title'] || ''}</span> },
              { key: 'priority', header: 'Priority', cell: (row: any) => {
                const p = row['Priority']?.toLowerCase();
                return <Badge variant={p === 'high' ? 'destructive' : 'secondary'}>{row['Priority'] || 'N/A'}</Badge>;
              }},
              { key: 'assignee', header: 'Assigned To', cell: (row: any) => row['Assigned To'] || '' },
              { key: 'phase', header: 'Phase', cell: (row: any) => {
                const steps = (row['Pending Steps'] || '').toLowerCase();
                return <Badge variant="outline">{steps.includes('effectiveness') ? 'Effectiveness' : 'Execution'}</Badge>;
              }},
              { key: 'deadline', header: 'Deadline', cell: (row: any) => {
                const steps = (row['Pending Steps'] || '').toLowerCase();
                return steps.includes('effectiveness')
                  ? (row['Deadline for effectiveness check'] || row['Due Date'] || '')
                  : (row['Due Date'] || '');
              }},
            ];
            if (cat === 'nc') return [
              { key: 'id', header: 'NC ID', cell: (row: any) => row['Id'] || '' },
              { key: 'title', header: 'Title', cell: (row: any) => <span className="max-w-[200px] truncate block">{row['Non Conformance Title'] || row['Title'] || ''}</span> },
              { key: 'classification', header: 'Risk', cell: (row: any) => {
                const cls = row['Classification'];
                return <Badge variant={cls === 'High risk' ? 'destructive' : 'secondary'}>{cls || 'Unknown'}</Badge>;
              }},
              { key: 'worker', header: 'Case Worker', cell: (row: any) => row['Case Worker'] || '' },
              { key: 'reoccurrence', header: 'Reoccurrence', cell: (row: any) => {
                const r = row['Reoccurrence']?.toUpperCase();
                return <Badge variant={r === 'YES' ? 'destructive' : 'outline'}>{r || 'NO'}</Badge>;
              }},
              { key: 'status', header: 'Status', cell: (row: any) => <Badge variant="destructive">{row['Status'] || ''}</Badge> },
            ];
            if (cat === 'change-action') return [
              { key: 'id', header: 'Action ID', cell: (row: any) => row['Change_ActionID'] || '' },
              { key: 'title', header: 'Title', cell: (row: any) => <span className="max-w-[200px] truncate block">{row['Title'] || ''}</span> },
              { key: 'responsible', header: 'Responsible', cell: (row: any) => row['Responsible'] || '' },
              { key: 'deadline', header: 'Deadline', cell: (row: any) => row['Deadline'] || '' },
              { key: 'approval', header: 'Approval', cell: (row: any) => {
                const a = row['Approve']?.trim().toLowerCase();
                if (a === 'approved') return <Badge className="bg-green-500 hover:bg-green-600 text-white border-transparent">Approved</Badge>;
                if (a) return <Badge variant="secondary">{row['Approve']}</Badge>;
                return <Badge variant="outline">Pending</Badge>;
              }},
            ];
            // training
            return [
              { key: 'id', header: 'Training ID', cell: (row: any) => row['Record training ID'] || '' },
              { key: 'title', header: 'Title', cell: (row: any) => <span className="max-w-[200px] truncate block">{row['Title'] || ''}</span> },
              { key: 'trainee', header: 'Trainee', cell: (row: any) => row['Trainee'] || '' },
              { key: 'category', header: 'Category', cell: (row: any) => row['Training category'] || '' },
              { key: 'deadline', header: 'Deadline', cell: (row: any) => row['Deadline for completing training'] || '' },
              { key: 'approval', header: 'Approval', cell: (row: any) => {
                const a = row['Final training approval']?.trim();
                if (a) return <Badge className="bg-green-500 hover:bg-green-600 text-white border-transparent">{a}</Badge>;
                return <Badge variant="outline">Pending</Badge>;
              }},
            ];
          })()}
          data={drillThroughData?.items ?? []}
          getRowId={(row: any) => String(row['CAPA ID'] || row['Id'] || row['Change_ActionID'] || row['Record training ID'] || Math.random())}
        />
      </DrillDownSheet>

    </div>
  );
}
