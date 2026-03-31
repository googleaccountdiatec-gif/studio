"use client";

import React, { useState, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileUp, AlertTriangle, ListTodo, ArrowUpIcon, ArrowDownIcon, CheckCircle, ShieldCheck } from 'lucide-react';
import { format, isAfter, isValid, startOfDay, startOfMonth, subDays } from 'date-fns';
import { parseDate } from '@/lib/date-utils';
import { CapaChart } from './capa-chart';
import { Skeleton } from './ui/skeleton';
import { DataTable, DataTableColumn } from './data-table';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { getProductionTeam } from '@/lib/teams';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useData } from '@/contexts/data-context';
import { GlassCard } from '@/components/ui/glass-card';
import { DrillDownSheet, SummaryBar, ExpandableDataTable, DetailSection, CrossLinkBadge } from '@/components/drill-down';
import type { ExpandableColumn } from '@/components/drill-down';
import { exportToCsv } from '@/lib/csv-export';
import { findLinkedDocuments } from '@/lib/cross-references';

interface ChangeActionData {
  'Change_ActionID': string;
  'Action required prior to change': string;
  'Responsible': string;
  'Pending Steps': string;
  'Deadline': string;
  'Change Title': string;
  'Change ID (CMID)': string;
  'Approve'?: string;
  'Registration Time': string;
  'Completed On'?: string;
  isOverdue: boolean;
  deadlineDate: Date;
  registrationDate: Date;
  [key: string]: any;
}


export default function ChangeActionDashboard() {
  const { changeActionData, documentKpiData } = useData();
  const [showCompleted, setShowCompleted] = useState(false);
  const [teamFilter, setTeamFilter] = useState<'all' | 'production'>('all');
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [navigationLevel, setNavigationLevel] = useState<'list' | 'detail'>('list');
  const productionTeam = getProductionTeam();

  const allDataWithDates = useMemo(() => {
    const today = startOfDay(new Date());
    return changeActionData.map(item => {
        const deadlineDate = parseDate(item.Deadline);
        const registrationDate = parseDate(item['Registration Time']);
        const isOverdue = isValid(deadlineDate) && isAfter(today, deadlineDate);
        return { ...item, deadlineDate, registrationDate, isOverdue } as ChangeActionData;
      });
  }, [changeActionData]);


  const processedData = useMemo(() => {
    let baseData = showCompleted
      ? allDataWithDates
      : allDataWithDates.filter(item => item['Pending Steps'] && item['Pending Steps'].trim() !== '');

    if (teamFilter === 'production') {
        baseData = baseData.filter(item => productionTeam.includes(item['Responsible']));
    }

    return baseData;
  }, [allDataWithDates, showCompleted, teamFilter, productionTeam]);

  const kpiValues = useMemo(() => {
    const totalCount = processedData.length;
    const overdueCount = processedData.filter(item => item.isOverdue).length;
    return { totalCount, overdueCount };
  }, [processedData]);

  // NEW: Trend Logic
  const biWeeklyTrend = useMemo(() => {
    const today = startOfDay(new Date());
    const twoWeeksAgo = subDays(today, 14);

    let newOverdue = 0;
    let resolvedOverdue = 0;

    let trendData = allDataWithDates;

    if (teamFilter === 'production') {
        trendData = trendData.filter(item => productionTeam.includes(item['Responsible']));
    }

    trendData.forEach(item => {
        const pending = item['Pending Steps'] ? item['Pending Steps'].trim() : '';
        const isCompleted = pending === '';

        // +1: Became overdue in last 14 days
        if (isValid(item.deadlineDate) && !isCompleted && item.deadlineDate >= twoWeeksAgo && item.deadlineDate < today) {
            newOverdue++;
        }

        // -1: Was overdue 14 days ago, but is now Completed
        if (isValid(item.deadlineDate) && item.deadlineDate < twoWeeksAgo && isCompleted) {
             resolvedOverdue++;
        }
    });

    return newOverdue - resolvedOverdue;
  }, [allDataWithDates, teamFilter, productionTeam]);

  const monthlyRegistrationData = useMemo(() => {
    const monthCounts: { [key: string]: number } = {};
    allDataWithDates.forEach(item => {
      if (isValid(item.registrationDate)) {
        const month = format(startOfMonth(item.registrationDate), 'yyyy-MM');
        monthCounts[month] = (monthCounts[month] || 0) + 1;
      }
    });

    return Object.entries(monthCounts)
      .map(([name, total]) => ({ name: format(new Date(name), 'MMM yyyy'), total }))
      .sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
  }, [allDataWithDates]);

  const actionsByChangeIdData = useMemo(() => {
    const changeIdCounts: { [key: string]: number } = {};
    processedData.forEach(item => {
      const changeId = item['Change ID (CMID)'];
      if (changeId) {
        changeIdCounts[changeId] = (changeIdCounts[changeId] || 0) + 1;
      }
    });

    return Object.entries(changeIdCounts)
      .map(([id, count]) => ({ name: id, total: count }))
      .sort((a, b) => b.total - a.total);
  }, [processedData]);

  // Actions by Responsible chart data
  const responsibleChartData = useMemo(() => {
    const responsibleCounts: { [key: string]: number } = {};
    processedData.forEach(item => {
      const responsible = item['Responsible'];
      if (responsible) {
        responsibleCounts[responsible] = (responsibleCounts[responsible] || 0) + 1;
      }
    });

    return Object.entries(responsibleCounts)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [processedData]);

  const selectedChangeIdActions = useMemo(() => {
    if (!selectedChangeId) return [];
    return allDataWithDates.filter(item => item['Change ID (CMID)'] === selectedChangeId);
  }, [allDataWithDates, selectedChangeId]);

  const selectedChangeTitle = useMemo(() => {
    if (!selectedChangeIdActions || selectedChangeIdActions.length === 0) return '';
    return selectedChangeIdActions[0]['Change Title'];
  }, [selectedChangeIdActions]);

  // Selected action for detail view
  const selectedAction = useMemo(() => {
    if (!selectedActionId) return null;
    return selectedChangeIdActions.find(a => a['Change_ActionID'] === selectedActionId) ?? null;
  }, [selectedChangeIdActions, selectedActionId]);

  // Linked documents for the selected action's Change ID
  const linkedDocuments = useMemo(() => {
    if (!selectedAction) return [];
    const cmid = selectedAction['Change ID (CMID)'];
    if (!cmid) return [];
    // Extract numeric part from CMID (e.g., "CMID15" -> "15")
    const idMatch = cmid.match(/\d+/);
    if (!idMatch) return [];
    return findLinkedDocuments(documentKpiData, 'change-action', idMatch[0]);
  }, [selectedAction, documentKpiData]);

  // Summary metrics for the drill-down sheet
  const sheetSummary = useMemo(() => {
    const total = selectedChangeIdActions.length;
    const completed = selectedChangeIdActions.filter(a => !a['Pending Steps'] || a['Pending Steps'].trim() === '').length;
    const approved = selectedChangeIdActions.filter(a => a['Approve'] && a['Approve'].trim().toLowerCase() === 'approved').length;
    const overdue = selectedChangeIdActions.filter(a => a.isOverdue).length;
    return { total, completed, approved, overdue };
  }, [selectedChangeIdActions]);

  // Drill-down table columns
  const drillDownColumns: ExpandableColumn<ChangeActionData>[] = [
    { key: 'Change_ActionID', header: 'Action ID', sortable: true },
    {
      key: 'Action required prior to change',
      header: 'Action Required',
      cell: (row) => {
        const text = row['Action required prior to change'] || '';
        return <span className="truncate max-w-[200px] block">{text.length > 60 ? text.substring(0, 60) + '...' : text}</span>;
      }
    },
    { key: 'Responsible', header: 'Responsible', sortable: true },
    {
      key: 'deadlineDate',
      header: 'Deadline',
      sortable: true,
      cell: (row) => isValid(row.deadlineDate) ? format(row.deadlineDate, 'PPP') : 'N/A'
    },
    {
      key: 'Approve',
      header: 'Approval',
      cell: (row) => {
        const approve = row['Approve']?.trim().toLowerCase();
        if (approve === 'approved') return <Badge className="bg-green-500 hover:bg-green-600 text-white border-transparent">Approved</Badge>;
        if (approve) return <Badge variant="secondary">{row['Approve']}</Badge>;
        return <Badge variant="outline">Pending</Badge>;
      }
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => {
        const pending = row['Pending Steps']?.trim();
        if (!pending) return <Badge className="bg-teal-500 hover:bg-teal-600 text-white">Completed</Badge>;
        return row.isOverdue
          ? <Badge variant="destructive" className="bg-accent text-accent-foreground hover:bg-accent/80">Overdue</Badge>
          : <Badge className="bg-green-500 hover:bg-green-600 text-white border-transparent">On Time</Badge>;
      }
    },
  ];

  const columns: DataTableColumn<ChangeActionData>[] = [
    { accessorKey: 'Change_ActionID', header: 'ID', cell: (row) => row['Change_ActionID'] },
    { accessorKey: 'Change Title', header: 'Title', cell: (row) => row['Change Title'] },
    { accessorKey: 'Action required prior to change', header: 'Action Required', cell: (row) => row['Action required prior to change'] },
    { accessorKey: 'Responsible', header: 'Responsible', cell: (row) => row['Responsible'] },
    {
      accessorKey: 'deadlineDate',
      header: 'Deadline',
      cell: (row) => isValid(row.deadlineDate) ? format(row.deadlineDate, 'PPP') : 'Invalid Date'
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
    <div className="space-y-6">
      {/* Consolidated KPI Card */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <GlassCard className="p-6 flex flex-col justify-center lg:col-span-1">
            <h3 className="text-lg font-semibold mb-6">Change Action Stats</h3>
            <div className="space-y-6">
                <div className="flex justify-between items-center border-b pb-4 border-border/50">
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-muted-foreground">Active Actions</span>
                        <span className="text-xs text-muted-foreground">Total count</span>
                    </div>
                    <span className="text-3xl font-bold text-primary">{kpiValues.totalCount}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">Overdue Actions</span>
                        <span className="text-xs text-muted-foreground">Action Required</span>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className={cn("text-4xl font-bold", kpiValues.overdueCount > 0 ? "text-destructive" : "text-emerald-500")}>
                            {kpiValues.overdueCount}
                        </span>
                        {/* Trend Display added manually here since GlassCard is custom structure */}
                        {biWeeklyTrend !== 0 && (
                            <div className="flex items-center text-xs mt-1">
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
                    </div>
                </div>
            </div>
        </GlassCard>

        {/* Visualizations - Row 1 */}
        <GlassCard className="lg:col-span-2 p-6">
             <div className="h-[220px] w-full">
                 <CapaChart data={monthlyRegistrationData} title="Monthly Registrations" dataKey="total" />
            </div>
        </GlassCard>
      </div>

      {/* Visualizations - Row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard className="p-6">
             <div className="h-[250px] w-full">
                <CapaChart
                    data={actionsByChangeIdData}
                    title="Actions by Change ID"
                    dataKey="total"
                    onBarClick={setSelectedChangeId}
                />
            </div>
        </GlassCard>
        <GlassCard className="p-6">
             <div className="h-[250px] w-full">
                <CapaChart
                    data={responsibleChartData}
                    title="Actions by Responsible"
                    dataKey="total"
                />
            </div>
        </GlassCard>
      </div>

       <Card>
          <CardHeader>
              <CardTitle>Active Change Actions</CardTitle>
          </CardHeader>
          <CardContent>
              <DataTable
                  columns={columns}
                  data={processedData}
                  getRowClassName={(row) => cn(row.isOverdue && "bg-accent/20 hover:bg-accent/30")}
              />
          </CardContent>
      </Card>
    </div>
  );

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center text-center py-20 px-4 rounded-lg border-2 border-dashed border-muted-foreground/30">
      <FileUp className="h-16 w-16 text-muted-foreground mb-4" />
      <h2 className="text-2xl font-semibold mb-2">Upload Your Change Action Data</h2>
      <p className="text-muted-foreground mb-6 max-w-md">Use the uploader in the header to import your "Change - Actions Required.csv" file.</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
            <Switch
                id="show-completed-ca"
                checked={showCompleted}
                onCheckedChange={setShowCompleted}
            />
            <Label htmlFor="show-completed-ca">Show Completed</Label>
        </div>
         <RadioGroup value={teamFilter} onValueChange={(value) => setTeamFilter(value as any)} className="flex items-center gap-4">
            <Label>Team:</Label>
            <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="t1-ca" />
                <Label htmlFor="t1-ca">All Operators</Label>
            </div>
            <div className="flex items-center space-x-2">
                <RadioGroupItem value="production" id="t2-ca" />
                <Label htmlFor="t2-ca">Production Only</Label>
            </div>
        </RadioGroup>
      </div>
      {changeActionData.length > 0 ? <MainContent /> : <EmptyState />}

      {/* Drill-Down Sheet replacing the old Dialog */}
      <DrillDownSheet
        open={!!selectedChangeId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedChangeId(null);
            setSelectedActionId(null);
            setNavigationLevel('list');
          }
        }}
        title={
          navigationLevel === 'detail' && selectedAction
            ? `${selectedAction['Change_ActionID']} — ${selectedAction['Change Title']}`
            : `Actions for ${selectedChangeId}`
        }
        breadcrumbs={
          navigationLevel === 'detail'
            ? [{ label: `${selectedChangeId} Actions`, onClick: () => { setSelectedActionId(null); setNavigationLevel('list'); } }]
            : []
        }
        onExportCsv={() => {
          exportToCsv(
            selectedChangeIdActions,
            [
              { key: 'Change_ActionID', header: 'Action ID' },
              { key: 'Action required prior to change', header: 'Action Required' },
              { key: 'Responsible', header: 'Responsible' },
              { key: 'Deadline', header: 'Deadline' },
              { key: 'Approve', header: 'Approval' },
              { key: 'Pending Steps', header: 'Pending Steps' },
              { key: 'Registration Time', header: 'Registration Time' },
              { key: 'Completed On', header: 'Completed On' },
            ],
            `change-actions-${selectedChangeId?.replace(/\s+/g, '-').toLowerCase() ?? 'export'}.csv`
          );
        }}
      >
        {navigationLevel === 'list' ? (
          <>
            <SummaryBar
              metrics={[
                { label: 'Total Actions', value: sheetSummary.total, icon: ListTodo },
                { label: 'Completed', value: sheetSummary.completed, color: 'success', icon: CheckCircle },
                { label: 'Approved', value: sheetSummary.approved, color: sheetSummary.approved > 0 ? 'success' : 'default', icon: ShieldCheck },
                { label: 'Overdue', value: sheetSummary.overdue, color: sheetSummary.overdue > 0 ? 'danger' : 'default', icon: AlertTriangle },
              ]}
            />

            {selectedChangeTitle && (
              <div className="rounded-lg border p-3 bg-muted/20">
                <p className="text-xs text-muted-foreground">Change Title</p>
                <p className="text-sm font-medium">{selectedChangeTitle}</p>
              </div>
            )}

            <ExpandableDataTable<ChangeActionData>
              columns={drillDownColumns}
              data={selectedChangeIdActions}
              getRowId={(row) => row['Change_ActionID']}
              getRowClassName={(row) => cn(row.isOverdue && "bg-accent/20")}
              onRowClick={(row) => {
                setSelectedActionId(row['Change_ActionID']);
                setNavigationLevel('detail');
              }}
              expandedContent={(row) => (
                <div className="space-y-2 text-sm">
                  {row['Action required prior to change'] && (
                    <div>
                      <span className="font-medium text-muted-foreground">Full Action Required: </span>
                      {row['Action required prior to change']}
                    </div>
                  )}
                  {row['Registration Time'] && (
                    <div>
                      <span className="font-medium text-muted-foreground">Registration Time: </span>
                      {row['Registration Time']}
                    </div>
                  )}
                  {row['Completed On'] && (
                    <div>
                      <span className="font-medium text-muted-foreground">Completed On: </span>
                      {row['Completed On']}
                    </div>
                  )}
                </div>
              )}
            />
          </>
        ) : selectedAction ? (
          <>
            {/* Header: Change Title + Change ID */}
            <div>
              <h3 className="text-lg font-semibold">{selectedAction['Change Title']}</h3>
              <p className="text-sm text-muted-foreground">{selectedAction['Change ID (CMID)']}</p>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              {(() => {
                const approve = selectedAction['Approve']?.trim().toLowerCase();
                if (approve === 'approved') return <Badge className="bg-green-500 hover:bg-green-600 text-white border-transparent">Approved</Badge>;
                if (approve) return <Badge variant="secondary">{selectedAction['Approve']}</Badge>;
                return <Badge variant="outline">Approval Pending</Badge>;
              })()}
              {(() => {
                const pending = selectedAction['Pending Steps']?.trim();
                if (!pending) return <Badge className="bg-teal-500 hover:bg-teal-600 text-white">Completed</Badge>;
                return selectedAction.isOverdue
                  ? <Badge variant="destructive" className="bg-accent text-accent-foreground hover:bg-accent/80">Overdue</Badge>
                  : <Badge className="bg-green-500 hover:bg-green-600 text-white border-transparent">On Time</Badge>;
              })()}
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-4 rounded-lg border p-4">
              <div>
                <p className="text-xs text-muted-foreground">Responsible</p>
                <p className="text-sm font-medium">{selectedAction['Responsible'] || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Deadline</p>
                <p className="text-sm font-medium">
                  {isValid(selectedAction.deadlineDate) ? format(selectedAction.deadlineDate, 'PPP') : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Registration Time</p>
                <p className="text-sm font-medium">{selectedAction['Registration Time'] || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Completed On</p>
                <p className="text-sm font-medium">{selectedAction['Completed On'] || 'N/A'}</p>
              </div>
            </div>

            {/* Detail section for full action text */}
            <DetailSection
              title="Action Required Prior to Change"
              content={selectedAction['Action required prior to change']}
            />

            {/* Cross-linked documents */}
            {linkedDocuments.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Linked Documents</h4>
                <div className="flex flex-wrap gap-2">
                  {linkedDocuments.map((doc: any) => (
                    <CrossLinkBadge
                      key={`${doc['Doc Prefix']}-${doc['Doc Number']}`}
                      domain="document"
                      id={doc['Doc Number']}
                      label={`${doc['Doc Prefix'] || ''}-${doc['Doc Number'] || ''} ${doc['Title'] || ''}`}
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
