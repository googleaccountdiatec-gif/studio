"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { FileUp, ListTodo, AlertTriangle, CheckCircle, Layers } from 'lucide-react';
import { format, isValid } from 'date-fns';
import { parseDate } from '@/lib/date-utils';
import { CapaChart } from './capa-chart';
import { KpiCard } from './kpi-card';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { isQaStep, QA_GROUP_VALUE, NON_QA_GROUP_VALUE } from '@/lib/qa-steps';
import { useData } from '@/contexts/data-context';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { TOOLTIP_STYLE, STATUS_COLORS } from '@/lib/chart-utils';
import { DataTable, DataTableColumn } from './data-table';

import { DrillDownSheet, SummaryBar, ExpandableDataTable, DetailSection } from '@/components/drill-down';
import type { ExpandableColumn } from '@/components/drill-down';
import { exportToCsv } from '@/lib/csv-export';

interface ChangeKpiRecord {
  CMID: string;
  'Change Title': string;
  'Pending Steps': string;
  'Department Manager': string;
  Category: string;
  'Change from:': string;
  'Change to': string;
  'Justification for Change': string;
  'Impacted areas of the organization and risk assessment': string;
  'Planned implementation data - comment': string;
  'Planned Implementation Date': string;
  'Implementation Date': string;
  'Final Change Status': string;
  'Change Requestor': string;
  'Registered By': string;
  'Completed On': string;
  [key: string]: any;
}

const CATEGORY_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-3))'];
const STATUS_PIE_COLORS = ['hsl(142 76% 36%)', 'hsl(35 90% 60%)', 'hsl(0 84% 60%)', 'hsl(var(--primary))'];

export default function ChangesDashboard() {
  const { changeKpiData, changeActionData } = useData();
  const [showCompleted, setShowCompleted] = useState(false);
  const [pendingStepFilter, setPendingStepFilter] = useState<string>('all');
  const [selectedCmid, setSelectedCmid] = useState<string | null>(null);

  const allData = useMemo(() => {
    return changeKpiData.map(item => {
      const plannedDate = parseDate(item['Planned Implementation Date']);
      const implDate = parseDate(item['Implementation Date']);
      return { ...item, plannedDate, implDate } as ChangeKpiRecord & { plannedDate: Date; implDate: Date };
    });
  }, [changeKpiData]);

  const pendingStepOptions = useMemo(() => {
    const steps = new Set<string>();
    allData.forEach(item => {
      const step = item['Pending Steps']?.trim();
      if (step) steps.add(step);
    });
    return [...steps].sort();
  }, [allData]);

  const processedData = useMemo(() => {
    let baseData = showCompleted
      ? allData
      : allData.filter(item => item['Pending Steps'] && item['Pending Steps'].trim() !== '');

    if (pendingStepFilter !== 'all') {
      if (pendingStepFilter === QA_GROUP_VALUE) {
        baseData = baseData.filter(item => isQaStep(item['Pending Steps'] || '', 'change-kpi'));
      } else if (pendingStepFilter === NON_QA_GROUP_VALUE) {
        baseData = baseData.filter(item => {
          const step = item['Pending Steps']?.trim() || '';
          return step !== '' && !isQaStep(step, 'change-kpi');
        });
      } else {
        baseData = baseData.filter(item => (item['Pending Steps']?.trim() || '') === pendingStepFilter);
      }
    }

    return baseData;
  }, [allData, showCompleted, pendingStepFilter]);

  const kpiValues = useMemo(() => {
    const active = allData.filter(d => d['Pending Steps']?.trim()).length;
    const completed = allData.filter(d => !d['Pending Steps']?.trim()).length;
    const major = processedData.filter(d => d.Category === 'Major').length;
    const minor = processedData.filter(d => d.Category === 'Minor').length;
    return { active, completed, major, minor, total: processedData.length };
  }, [allData, processedData]);

  // --- Chart Data ---
  const stepChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    processedData.forEach(item => {
      const step = item['Pending Steps']?.trim();
      if (step) counts[step] = (counts[step] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => {
        const numA = parseInt(a.name);
        const numB = parseInt(b.name);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.name.localeCompare(b.name);
      });
  }, [processedData]);

  const categoryChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    processedData.forEach(item => {
      const cat = item.Category || 'Unknown';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [processedData]);

  const managerChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    processedData.forEach(item => {
      const mgr = item['Department Manager']?.trim();
      if (mgr) counts[mgr] = (counts[mgr] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [processedData]);

  const statusChartData = useMemo(() => {
    const completed = allData.filter(d => !d['Pending Steps']?.trim());
    const counts: Record<string, number> = {};
    completed.forEach(item => {
      const status = item['Final Change Status'] || 'Unknown';
      counts[status] = (counts[status] || 0) + 1;
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [allData]);

  // --- Selected Change + Linked Actions ---
  const selectedChange = useMemo(() => {
    if (!selectedCmid) return null;
    return allData.find(d => d.CMID === selectedCmid) ?? null;
  }, [allData, selectedCmid]);

  const linkedActions = useMemo(() => {
    if (!selectedCmid) return [];
    return (changeActionData as any[]).filter(a => String(a['Change ID (CMID)']).trim() === String(selectedCmid).trim());
  }, [changeActionData, selectedCmid]);

  const linkedSummary = useMemo(() => {
    const total = linkedActions.length;
    const completed = linkedActions.filter(a => !a['Pending Steps']?.trim()).length;
    const overdue = linkedActions.filter(a => {
      const deadline = parseDate(a.Deadline);
      return isValid(deadline) && deadline < new Date() && a['Pending Steps']?.trim();
    }).length;
    return { total, completed, overdue };
  }, [linkedActions]);

  // --- Table Columns ---
  const columns: DataTableColumn<any>[] = [
    { accessorKey: 'CMID', header: 'CMID', cell: (row) => <span className="font-mono font-medium cursor-pointer text-primary hover:underline" onClick={() => setSelectedCmid(row.CMID)}>CMID{row.CMID}</span> },
    { accessorKey: 'Change Title', header: 'Change Title', cell: (row) => row['Change Title'] },
    { accessorKey: 'Category', header: 'Category', cell: (row) => <Badge variant="outline">{row.Category || 'N/A'}</Badge> },
    {
      accessorKey: 'Pending Steps',
      header: 'Pending Step',
      cell: (row) => {
        const step = row['Pending Steps']?.trim();
        if (!step) return <Badge className="bg-teal-500 hover:bg-teal-600 text-white">Completed</Badge>;
        return <Badge variant="outline">{step}</Badge>;
      }
    },
    { accessorKey: 'Department Manager', header: 'Dept Manager', cell: (row) => row['Department Manager'] },
    {
      accessorKey: 'plannedDate',
      header: 'Planned Date',
      cell: (row) => isValid(row.plannedDate) ? format(row.plannedDate, 'dd/MM/yyyy') : 'N/A'
    },
  ];

  // --- Linked Actions columns ---
  const actionColumns: ExpandableColumn<any>[] = [
    { key: 'Change_ActionID', header: 'ID', sortable: true },
    {
      key: 'Action required prior to change',
      header: 'Action Required',
      cell: (row: any) => {
        const text = row['Action required prior to change'] || '';
        return <span className="truncate max-w-[200px] block">{text.length > 60 ? text.substring(0, 60) + '...' : text}</span>;
      }
    },
    { key: 'Responsible', header: 'Responsible', sortable: true },
    { key: 'Deadline', header: 'Deadline' },
    {
      key: 'status',
      header: 'Status',
      cell: (row: any) => {
        const pending = row['Pending Steps']?.trim();
        if (!pending) return <Badge className="bg-teal-500 hover:bg-teal-600 text-white">Completed</Badge>;
        const deadline = parseDate(row.Deadline);
        const overdue = isValid(deadline) && deadline < new Date();
        return overdue
          ? <Badge variant="destructive">Overdue</Badge>
          : <Badge className="bg-green-500 hover:bg-green-600 text-white border-transparent">On Time</Badge>;
      }
    },
  ];

  const MainContent = () => (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Active Changes" value={kpiValues.active} icon={ListTodo} description="Changes with pending steps" />
        <KpiCard title="Completed" value={kpiValues.completed} icon={CheckCircle} description="Changes fully completed" />
        <KpiCard title="Major" value={kpiValues.major} icon={AlertTriangle} description="Major category changes" />
        <KpiCard title="Minor" value={kpiValues.minor} icon={Layers} description="Minor category changes" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <div className="h-[280px] w-full">
              <CapaChart data={stepChartData} title="Changes by Pending Step" dataKey="total" scrollable />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="h-[280px] w-full">
              <CapaChart data={managerChartData} title="Changes by Department Manager" dataKey="total" scrollable />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Category Breakdown</h3>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryChartData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" nameKey="name">
                    {categoryChartData.map((_, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        {statusChartData.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">Completed Changes by Final Status</h3>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusChartData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" nameKey="name">
                      {statusChartData.map((_, i) => (
                        <Cell key={i} fill={STATUS_PIE_COLORS[i % STATUS_PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Changes</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={processedData}
          />
        </CardContent>
      </Card>
    </div>
  );

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center text-center py-20 px-4 rounded-lg border-2 border-dashed border-muted-foreground/30">
      <FileUp className="h-16 w-16 text-muted-foreground mb-4" />
      <h2 className="text-2xl font-semibold mb-2">Upload Your Change KPI Data</h2>
      <p className="text-muted-foreground mb-6 max-w-md">Use the uploader in the header to import your "Change KPI.csv" file.</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Switch id="show-completed-ck" checked={showCompleted} onCheckedChange={setShowCompleted} />
          <Label htmlFor="show-completed-ck">Show Completed</Label>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm">Step:</Label>
          <Select value={pendingStepFilter} onValueChange={setPendingStepFilter}>
            <SelectTrigger className="h-8 w-[200px]">
              <SelectValue placeholder="All Steps" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Steps</SelectItem>
              <SelectItem value={QA_GROUP_VALUE}>QA Steps</SelectItem>
              <SelectItem value={NON_QA_GROUP_VALUE}>Non-QA Steps</SelectItem>
              <Separator className="my-1" />
              {pendingStepOptions.map(step => (
                <SelectItem key={step} value={step}>{step}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {changeKpiData.length > 0 ? <MainContent /> : <EmptyState />}

      {/* Drill-Down Sheet */}
      <DrillDownSheet
        open={!!selectedCmid}
        onOpenChange={(open) => { if (!open) setSelectedCmid(null); }}
        title={selectedChange ? `CMID${selectedChange.CMID}: ${selectedChange['Change Title']}` : ''}
        onExportCsv={() => {
          if (!selectedChange) return;
          exportToCsv(
            [selectedChange],
            [
              { key: 'CMID', header: 'CMID' },
              { key: 'Change Title', header: 'Title' },
              { key: 'Category', header: 'Category' },
              { key: 'Pending Steps', header: 'Pending Steps' },
              { key: 'Department Manager', header: 'Dept Manager' },
              { key: 'Planned Implementation Date', header: 'Planned Date' },
              { key: 'Implementation Date', header: 'Impl Date' },
              { key: 'Final Change Status', header: 'Final Status' },
            ],
            `change-${selectedCmid}.csv`
          );
        }}
      >
        {selectedChange && (
          <>
            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{selectedChange.Category || 'N/A'}</Badge>
              {(() => {
                const step = selectedChange['Pending Steps']?.trim();
                if (!step) return <Badge className="bg-teal-500 hover:bg-teal-600 text-white">Completed</Badge>;
                return <Badge variant="secondary">{step}</Badge>;
              })()}
              {selectedChange['Final Change Status'] && (
                <Badge className={cn(
                  selectedChange['Final Change Status'] === 'Approved' && "bg-green-500 hover:bg-green-600 text-white border-transparent",
                  selectedChange['Final Change Status'] === 'Rejected' && "bg-red-500 hover:bg-red-600 text-white border-transparent"
                )} variant={selectedChange['Final Change Status'] === 'Approved' || selectedChange['Final Change Status'] === 'Rejected' ? undefined : "outline"}>
                  {selectedChange['Final Change Status']}
                </Badge>
              )}
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-4 rounded-lg border p-4">
              <div>
                <p className="text-xs text-muted-foreground">Department Manager</p>
                <p className="text-sm font-medium">{selectedChange['Department Manager'] || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Change Requestor</p>
                <p className="text-sm font-medium">{selectedChange['Change Requestor'] || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Registered By</p>
                <p className="text-sm font-medium">{selectedChange['Registered By'] || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Planned Implementation Date</p>
                <p className="text-sm font-medium">
                  {isValid(selectedChange.plannedDate) ? format(selectedChange.plannedDate, 'dd/MM/yyyy') : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Implementation Date</p>
                <p className="text-sm font-medium">
                  {isValid(selectedChange.implDate) ? format(selectedChange.implDate, 'dd/MM/yyyy') : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Completed On</p>
                <p className="text-sm font-medium">{selectedChange['Completed On'] || 'N/A'}</p>
              </div>
            </div>

            {/* Detail Sections */}
            <DetailSection title="Change From" content={selectedChange['Change from:']} />
            <DetailSection title="Change To" content={selectedChange['Change to']} />
            <DetailSection title="Justification for Change" content={selectedChange['Justification for Change']} />
            <DetailSection title="Impacted Areas & Risk Assessment" content={selectedChange['Impacted areas of the organization and risk assessment']} />
            {selectedChange['Planned implementation data - comment'] && (
              <DetailSection title="Implementation Plan Comments" content={selectedChange['Planned implementation data - comment']} />
            )}

            {/* Linked Change Actions */}
            {linkedActions.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground">Linked Change Actions</h4>
                <SummaryBar
                  metrics={[
                    { label: 'Total Actions', value: linkedSummary.total, icon: ListTodo },
                    { label: 'Completed', value: linkedSummary.completed, color: 'success' as const, icon: CheckCircle },
                    { label: 'Overdue', value: linkedSummary.overdue, color: linkedSummary.overdue > 0 ? 'danger' as const : 'default' as const, icon: AlertTriangle },
                  ]}
                />
                <ExpandableDataTable
                  columns={actionColumns}
                  data={linkedActions}
                  getRowId={(row: any) => String(row['Change_ActionID'] || Math.random())}
                  expandedContent={(row: any) => (
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium text-muted-foreground">Full Action: </span>
                        {row['Action required prior to change'] || 'N/A'}
                      </div>
                      {row['Pending Steps']?.trim() && (
                        <div>
                          <span className="font-medium text-muted-foreground">Pending Step: </span>
                          <Badge variant="outline">{row['Pending Steps']}</Badge>
                        </div>
                      )}
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        {row['Registration Time'] && <span>Registered: {row['Registration Time']}</span>}
                        {row['Completed On'] && <span>Completed: {row['Completed On']}</span>}
                      </div>
                    </div>
                  )}
                />
              </div>
            )}
            {changeActionData.length === 0 && (
              <p className="text-sm text-muted-foreground italic">Upload Change Actions CSV to see linked actions for this change.</p>
            )}
          </>
        )}
      </DrillDownSheet>
    </div>
  );
}
