"use client";

import React, { useState, useMemo, ChangeEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileUp, CalendarIcon, CheckCircle2, XCircle } from 'lucide-react';
import { format, parse, isValid, getQuarter, differenceInDays } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from './ui/skeleton';
import { DataTable, DataTableColumn } from './data-table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useData } from '@/contexts/data-context';
import { getProductionTeam } from '@/lib/teams';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { DrillDownSheet, SummaryBar, InsightPanel, InsightCard, ExpandableDataTable, DetailSection } from '@/components/drill-down';
import { exportToCsv } from '@/lib/csv-export';

// Updated headers: Removed "Deadline...", Added "Status"
const EXPECTED_HEADERS = ["Id", "Non Conformance Title", "Classification", "Pending Steps", "Case Worker", "Status", "Registration Time", "Registered By", "Reoccurrence"];

interface NonConformanceData {
  'Id': string;
  'Non Conformance Title': string;
  'Classification': string;
  'Pending Steps': string;
  'Case Worker': string;
  'Status': string;
  'Registration Time': string;
  'Registered By': string;
  'Reoccurrence': string;
  'Completed On'?: string;
  'Impact Other'?: string;
  'Investigation summary'?: string;
  'Impact Assessment'?: string;
  'Root cause description'?: string;
  'Classification justification'?: string;
  'Segregation of product'?: string;
  'Discarded product'?: string;
  'Started new production'?: string;
  'Repeated operation/analysis'?: string;
  registrationDate: Date;
  [key: string]: any;
}

const DATE_FORMATS = [
  "dd/MM/yyyy hh:mm a",
  "dd/MM/yyyy H:mm",
  "dd/MM/yyyy",
  "dd MMM yyyy HH:mm",
  "dd MMM yyyy",
  'M/d/yyyy',
  'MM/dd/yyyy',
  'dd.MM.yyyy',
  "dd.MM.yyyy HH:mm"
];

const parseDate = (dateString: string): Date => {
  if (!dateString) return new Date('invalid');
  for (const fmt of DATE_FORMATS) {
    const parsed = parse(dateString.trim(), fmt, new Date());
    if (isValid(parsed)) return parsed;
  }
  const isoParsed = new Date(dateString);
  if (isValid(isoParsed)) return isoParsed;

  return new Date('invalid');
};

// --- Corrective action boolean helper ---
const CORRECTIVE_ACTIONS = [
  { key: 'Segregation of product', label: 'Segregation of product' },
  { key: 'Discarded product', label: 'Discarded product' },
  { key: 'Started new production', label: 'Started new production' },
  { key: 'Repeated operation/analysis', label: 'Repeated operation/analysis' },
] as const;

function isTruthy(val: string | undefined): boolean {
  if (!val) return false;
  const lower = val.trim().toLowerCase();
  return lower === 'yes' || lower === 'true' || lower === '1';
}

// --- NcListView component ---
interface NcListViewProps {
  data: NonConformanceData[];
  summary: { total: number; lowRisk: number; highRisk: number; avgDaysToClose: number | null; reoccurrenceRate: number };
  onSelectNc: (id: string) => void;
}

function NcListView({ data, summary, onSelectNc }: NcListViewProps) {
  // Case worker distribution
  const caseWorkerCounts = useMemo(() => {
    const map: Record<string, number> = {};
    data.forEach(d => {
      const worker = d['Case Worker'] || 'Unknown';
      map[worker] = (map[worker] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  // Corrective action counts
  const correctiveActionCounts = useMemo(() => {
    return CORRECTIVE_ACTIONS.map(action => ({
      label: action.label,
      count: data.filter(d => isTruthy(d[action.key])).length,
    }));
  }, [data]);

  const expandableColumns: import('@/components/drill-down').ExpandableColumn<NonConformanceData>[] = [
    { key: 'Id', header: 'ID', sortable: true },
    { key: 'Non Conformance Title', header: 'Title', cell: (row) => (
      <span className="max-w-[200px] truncate block">{row['Non Conformance Title']}</span>
    )},
    { key: 'Classification', header: 'Classification', sortable: true, cell: (row) => (
      <Badge variant={row.Classification === 'High risk' ? 'destructive' : 'secondary'}>
        {row.Classification}
      </Badge>
    )},
    { key: 'Case Worker', header: 'Case Worker', sortable: true },
    { key: 'Reoccurrence', header: 'Reoccurrence', cell: (row) => (
      row.Reoccurrence === 'YES'
        ? <Badge variant="destructive">YES</Badge>
        : <Badge variant="outline">{row.Reoccurrence || 'NO'}</Badge>
    )},
  ];

  return (
    <>
      <SummaryBar metrics={[
        { label: 'Total NCs', value: summary.total },
        { label: 'Low Risk', value: summary.lowRisk, color: 'success' },
        { label: 'High Risk', value: summary.highRisk, color: summary.highRisk > 0 ? 'danger' : 'default' },
        { label: 'Avg Days to Close', value: summary.avgDaysToClose !== null ? `${summary.avgDaysToClose}d` : 'N/A' },
      ]} />

      <InsightPanel columns={2}>
        <InsightCard title="Corrective Actions Taken">
          <div className="grid grid-cols-2 gap-3">
            {correctiveActionCounts.map(ca => (
              <div key={ca.label} className="flex flex-col items-center p-2 rounded-md bg-muted/50">
                <span className="text-2xl font-bold">{ca.count}</span>
                <span className="text-xs text-muted-foreground text-center">{ca.label}</span>
              </div>
            ))}
          </div>
        </InsightCard>
        <InsightCard title="Case Worker Distribution">
          <div className="space-y-2 max-h-[180px] overflow-y-auto">
            {caseWorkerCounts.map(cw => (
              <div key={cw.name} className="flex items-center justify-between text-sm">
                <span className="truncate mr-2">{cw.name}</span>
                <Badge variant="secondary">{cw.count}</Badge>
              </div>
            ))}
          </div>
        </InsightCard>
      </InsightPanel>

      <ExpandableDataTable
        columns={expandableColumns}
        data={data}
        getRowId={(row) => row.Id}
        onRowClick={(row) => onSelectNc(row.Id)}
        expandedContent={(row) => (
          <div className="space-y-3">
            {row['Investigation summary'] && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Investigation Summary</p>
                <p className="text-sm">
                  {row['Investigation summary'].length > 200
                    ? row['Investigation summary'].slice(0, 200) + '...'
                    : row['Investigation summary']}
                </p>
              </div>
            )}
            <div className="flex items-center gap-4 flex-wrap">
              {CORRECTIVE_ACTIONS.map(action => (
                <div key={action.key} className="flex items-center gap-1.5 text-sm">
                  {isTruthy(row[action.key])
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    : <XCircle className="w-4 h-4 text-muted-foreground/40" />
                  }
                  <span className={isTruthy(row[action.key]) ? '' : 'text-muted-foreground'}>{action.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      />
    </>
  );
}

// --- NcDetailView component ---
interface NcDetailViewProps {
  nc: NonConformanceData;
}

function NcDetailView({ nc }: NcDetailViewProps) {
  return (
    <div className="space-y-6">
      {/* Title and Badges */}
      <div>
        <h3 className="text-lg font-semibold mb-2">{nc['Non Conformance Title']}</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={nc.Classification === 'High risk' ? 'destructive' : 'secondary'}>
            {nc.Classification}
          </Badge>
          {nc.Reoccurrence === 'YES' ? (
            <Badge variant="destructive">Reoccurrence: YES</Badge>
          ) : (
            <Badge variant="outline">Reoccurrence: {nc.Reoccurrence || 'NO'}</Badge>
          )}
          <Badge variant={nc.Status === 'Deadline Exceeded' ? 'destructive' : 'secondary'}>
            {nc.Status}
          </Badge>
        </div>
      </div>

      {/* Metadata Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-muted-foreground font-medium">Case Worker</p>
          <p className="text-sm font-medium mt-0.5">{nc['Case Worker'] || 'N/A'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium">Registered By</p>
          <p className="text-sm font-medium mt-0.5">{nc['Registered By'] || 'N/A'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium">Registration Time</p>
          <p className="text-sm font-medium mt-0.5">{nc['Registration Time'] || 'N/A'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium">Completed On</p>
          <p className="text-sm font-medium mt-0.5">{nc['Completed On'] || 'N/A'}</p>
        </div>
      </div>

      {/* Detail Sections */}
      <div className="space-y-3">
        <DetailSection title="Classification Justification" content={nc['Classification justification']} />
        <DetailSection title="Impact Assessment" content={nc['Impact Assessment']} />
        <DetailSection title="Investigation Summary" content={nc['Investigation summary']} />
        <DetailSection title="Root Cause Description" content={nc['Root cause description']} />
        <DetailSection title="Impact Other" content={nc['Impact Other']} defaultOpen={false} />
      </div>

      {/* Corrective Actions */}
      <div className="rounded-lg border p-4">
        <h4 className="text-sm font-medium mb-3">Corrective Actions</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CORRECTIVE_ACTIONS.map(action => (
            <div key={action.key} className="flex items-center gap-2 text-sm">
              {isTruthy(nc[action.key])
                ? <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                : <XCircle className="w-5 h-5 text-muted-foreground/40 flex-shrink-0" />
              }
              <span className={isTruthy(nc[action.key]) ? 'font-medium' : 'text-muted-foreground'}>{action.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function NonConformanceDashboard() {
  const { nonConformanceData } = useData();
  
  // Multi-Year Selection State (Default: Current & Previous)
  const currentRealYear = new Date().getFullYear();
  const [selectedYears, setSelectedYears] = useState<number[]>([currentRealYear, currentRealYear - 1]);
  
  const [teamFilter, setTeamFilter] = useState<'all' | 'production'>('all');
  const [dialogData, setDialogData] = useState<{ title: string; data: NonConformanceData[] } | null>(null);
  const [selectedNcId, setSelectedNcId] = useState<string | null>(null);
  const [navigationLevel, setNavigationLevel] = useState<'list' | 'detail'>('list');
  const productionTeam = getProductionTeam();

  const allDataWithDates = useMemo(() => {
    let data = nonConformanceData.map(item => ({
        ...item,
        registrationDate: parseDate(item["Registration Time"]),
    }));

    if (teamFilter === 'production') {
        data = data.filter(item => 
            productionTeam.includes(item["Case Worker"]) || 
            productionTeam.includes(item["Registered By"])
        );
    }

    return data;
  }, [nonConformanceData, teamFilter, productionTeam]);

  // Determine available years from data + Current Real Year
  const availableYears = useMemo(() => {
     const yearsInData = [...new Set(allDataWithDates
        .map(d => d.registrationDate.getFullYear())
        .filter(y => !isNaN(y))
    )];
    // Ensure current year is included
    if (!yearsInData.includes(currentRealYear)) {
        yearsInData.push(currentRealYear);
    }
    return yearsInData.sort((a, b) => b - a);
  }, [allDataWithDates, currentRealYear]);


  const quarterlyData = useMemo(() => {
    if (availableYears.length === 0) return [];
    
    // We want to generate quarters for the full range of years found (or expected)
    // so the chart isn't disjointed if possible, but filtering handles display.
    const minYear = Math.min(...availableYears);
    const maxYear = Math.max(...availableYears);

    const years = [];
    for (let y = minYear; y <= maxYear; y++) {
        years.push(y);
    }
    
    const quarters = [1, 2, 3, 4];
    const aggregated: { [key: string]: { lowRisk: number; highRisk: number; total: number; reoccurring: number; records: NonConformanceData[] } } = {};

    years.forEach(year => {
      quarters.forEach(q => {
        const key = `${year}-Q${q}`;
        aggregated[key] = { lowRisk: 0, highRisk: 0, total: 0, reoccurring: 0, records: [] };
      });
    });
    
    allDataWithDates.forEach(item => {
      if (!isValid(item.registrationDate)) return;
      const year = item.registrationDate.getFullYear();
      const quarter = getQuarter(item.registrationDate);
      const key = `${year}-Q${quarter}`;
      
      if (aggregated[key]) {
        aggregated[key].total++;
        aggregated[key].records.push(item);
        if (item.Classification === 'Low risk') aggregated[key].lowRisk++;
        if (item.Classification === 'High risk') aggregated[key].highRisk++;
        if (item.Reoccurrence === 'YES') aggregated[key].reoccurring++;
      }
    });

    return Object.entries(aggregated)
        .map(([key, value]) => ({ name: key, ...value }))
        // Don't filter out 0 totals yet, let the year selection decide display
        .sort((a, b) => a.name.localeCompare(b.name)); 
  }, [allDataWithDates, availableYears]);
  
  const filteredChartData = useMemo(() => {
    return quarterlyData.filter(q => {
        const year = parseInt(q.name.split('-')[0]);
        return selectedYears.includes(year);
    });
  }, [quarterlyData, selectedYears]);

  const drillDownSummary = useMemo(() => {
    if (!dialogData) return null;
    const items = dialogData.data;
    const total = items.length;
    const lowRisk = items.filter(d => d.Classification === 'Low risk').length;
    const highRisk = items.filter(d => d.Classification === 'High risk').length;
    const reoccurrenceCount = items.filter(d => d.Reoccurrence === 'YES').length;
    const reoccurrenceRate = total > 0 ? Math.round((reoccurrenceCount / total) * 100) : 0;

    const daysToClose: number[] = [];
    items.forEach(d => {
      if (d['Completed On'] && d['Registration Time']) {
        const regDate = parseDate(d['Registration Time']);
        const complDate = parseDate(d['Completed On']);
        if (isValid(regDate) && isValid(complDate)) {
          const days = differenceInDays(complDate, regDate);
          if (days >= 0) daysToClose.push(days);
        }
      }
    });
    const avgDaysToClose = daysToClose.length > 0
      ? Math.round(daysToClose.reduce((a, b) => a + b, 0) / daysToClose.length)
      : null;

    return { total, lowRisk, highRisk, reoccurrenceRate, avgDaysToClose };
  }, [dialogData]);

  const selectedNc = useMemo(() => {
    if (!selectedNcId || !dialogData) return null;
    return dialogData.data.find(d => d.Id === selectedNcId) ?? null;
  }, [selectedNcId, dialogData]);

  const handleSpecificBarClick = (data: any, type: 'low' | 'high' | 'total' | 'reoccurring') => {
      const quarterName = data.name;
      const quarterInfo = quarterlyData.find(q => q.name === quarterName);
      if (!quarterInfo) return;

      let recordsToShow = quarterInfo.records;
      let title = "";

      if (type === 'low') {
          recordsToShow = quarterInfo.records.filter(r => r.Classification === "Low risk");
          title = `Low Risk NCs for ${quarterName}`;
      } else if (type === 'high') {
          recordsToShow = quarterInfo.records.filter(r => r.Classification === "High risk");
          title = `High Risk NCs for ${quarterName}`;
      } else if (type === 'reoccurring') {
          recordsToShow = quarterInfo.records.filter(r => r.Reoccurrence === "YES");
          title = `Reoccurring NCs for ${quarterName}`;
      } else {
          title = `All NCs for ${quarterName}`;
      }

      setDialogData({ title, data: recordsToShow });
  };

  const toggleYear = (year: number) => {
    setSelectedYears(prev => 
        prev.includes(year) 
            ? prev.filter(y => y !== year)
            : [...prev, year]
    );
  };
  
  const detailColumns: DataTableColumn<NonConformanceData>[] = [
    { accessorKey: 'Id', header: 'ID', cell: (row) => row.Id },
    { accessorKey: 'Non Conformance Title', header: 'Title', cell: (row) => row["Non Conformance Title"] },
    { accessorKey: 'Status', header: 'Status', cell: (row) => {
        const isOverdue = row.Status === 'Deadline Exceeded';
        return isOverdue 
            ? <Badge variant="destructive">Deadline Exceeded</Badge> 
            : <Badge variant="secondary">{row.Status}</Badge>
    }},
    { accessorKey: 'Registered By', header: 'Registered By', cell: (row) => row["Registered By"] },
    { accessorKey: 'Case Worker', header: 'Case Worker', cell: (row) => row["Case Worker"] },
    { accessorKey: 'Registration Time', header: 'Registration Time', cell: (row) => row["Registration Time"] },
    { accessorKey: 'Classification', header: 'Classification', cell: (row) => row.Classification },
    { accessorKey: 'Reoccurrence', header: 'Reoccurrence', cell: (row) => row.Reoccurrence },
  ];

  const MainContent = () => (
    <div className="space-y-6">
       <Card>
        <CardHeader>
          <CardTitle>Risk & Total Volume Overview</CardTitle>
          <CardDescription>
            Low risk, high risk, and total non-conformances per quarter for: {selectedYears.sort().join(', ')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={filteredChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis stroke="#8884d8" />
              <Tooltip 
                contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    borderRadius: '8px', 
                    border: '1px solid hsl(var(--border))' 
                }} 
              />
              <Legend />
              
              {/* LOW RISK: Soft Pink (--chart-4) */}
              <Bar 
                dataKey="lowRisk" 
                name="Low Risk" 
                fill="hsl(var(--chart-4))" 
                cursor="pointer" 
                onClick={(data) => handleSpecificBarClick(data, 'low')}
              />
              
              {/* HIGH RISK: Dangerous Aggressive Red (--chart-2) */}
              <Bar 
                dataKey="highRisk" 
                name="High Risk" 
                fill="hsl(var(--chart-2))" 
                cursor="pointer" 
                onClick={(data) => handleSpecificBarClick(data, 'high')}
              />
              
              {/* TOTAL: The Dominant Black (--chart-1) */}
              <Bar 
                dataKey="total" 
                name="Total NCs" 
                fill="hsl(var(--chart-1))" 
                cursor="pointer" 
                onClick={(data) => handleSpecificBarClick(data, 'total')}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
          <CardHeader>
            <CardTitle>Reoccurrence Trend</CardTitle>
             <CardDescription>Count of reoccurring non-conformances per quarter.</CardDescription>
          </CardHeader>
          <CardContent>
             <ResponsiveContainer width="100%" height={350}>
                 <LineChart data={filteredChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip 
                        contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            borderRadius: '8px', 
                            border: '1px solid hsl(var(--border))' 
                        }} 
                    />
                    <Legend />
                    {/* LINE: Using the Red Primary to slash through the data */}
                    <Line 
                        type="monotone" 
                        dataKey="reoccurring" 
                        name="Reoccurring" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2} 
                        cursor="pointer" 
                        activeDot={{ r: 8, onClick: (e, payload) => handleSpecificBarClick(payload.payload, 'reoccurring') }}
                    />
                 </LineChart>
            </ResponsiveContainer>
          </CardContent>
      </Card>
    </div>
  );

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center text-center py-20 px-4 rounded-lg border-2 border-dashed border-muted-foreground/30">
      <FileUp className="h-16 w-16 text-muted-foreground mb-4"/>
      <h2 className="text-2xl font-semibold mb-2">Upload Your Non-Conformance Data</h2>
      <p className="text-muted-foreground mb-6 max-w-md">Use the uploader in the header to import your "Non-conformance KPIs.csv" file.</p>
    </div>
  );
  
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
            <Label>Years:</Label>
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedYears.length > 0 
                            ? `${selectedYears.length} year${selectedYears.length !== 1 ? 's' : ''} selected` 
                            : "Select years"}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="start">
                    <div className="space-y-2">
                        <h4 className="font-medium leading-none text-sm mb-2 text-muted-foreground px-2">Select years to compare</h4>
                        <div className="grid gap-2">
                            {availableYears.map(year => (
                                <div key={year} className="flex items-center space-x-2 px-2 py-1 rounded hover:bg-muted/50">
                                    <Checkbox 
                                        id={`year-${year}`} 
                                        checked={selectedYears.includes(year)}
                                        onCheckedChange={() => toggleYear(year)}
                                    />
                                    <Label htmlFor={`year-${year}`} className="flex-1 cursor-pointer">{year}</Label>
                                </div>
                            ))}
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
        
        <RadioGroup value={teamFilter} onValueChange={(value) => setTeamFilter(value as any)} className="flex items-center gap-4 ml-auto">
            <Label>Team:</Label>
            <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="t1-nc" />
                <Label htmlFor="t1-nc">All Operators</Label>
            </div>
            <div className="flex items-center space-x-2">
                <RadioGroupItem value="production" id="t2-nc" />
                <Label htmlFor="t2-nc">Production Only</Label>
            </div>
        </RadioGroup>
      </div>
      {nonConformanceData.length > 0 ? <MainContent /> : <EmptyState />}

      <DrillDownSheet
        open={!!dialogData}
        onOpenChange={(open) => {
          if (!open) {
            setDialogData(null);
            setSelectedNcId(null);
            setNavigationLevel('list');
          }
        }}
        title={navigationLevel === 'detail' && selectedNc
          ? `NC-${selectedNc.Id}: ${selectedNc['Non Conformance Title']}`
          : dialogData?.title ?? ''
        }
        breadcrumbs={navigationLevel === 'detail' ? [
          { label: dialogData?.title ?? 'List', onClick: () => { setSelectedNcId(null); setNavigationLevel('list'); } }
        ] : []}
        onExportCsv={() => {
          if (!dialogData) return;
          exportToCsv(
            dialogData.data,
            [
              { key: 'Id', header: 'ID' },
              { key: 'Non Conformance Title', header: 'Title' },
              { key: 'Classification', header: 'Classification' },
              { key: 'Case Worker', header: 'Case Worker' },
              { key: 'Registered By', header: 'Registered By' },
              { key: 'Registration Time', header: 'Registration Time' },
              { key: 'Completed On', header: 'Completed On' },
              { key: 'Status', header: 'Status' },
              { key: 'Reoccurrence', header: 'Reoccurrence' },
              { key: 'Investigation summary', header: 'Investigation Summary' },
              { key: 'Root cause description', header: 'Root Cause' },
            ],
            `nc-drill-down-${dialogData.title.replace(/\s+/g, '-').toLowerCase()}.csv`
          );
        }}
      >
        {navigationLevel === 'list' && dialogData && drillDownSummary && (
          <NcListView
            data={dialogData.data}
            summary={drillDownSummary}
            onSelectNc={(id) => { setSelectedNcId(id); setNavigationLevel('detail'); }}
          />
        )}
        {navigationLevel === 'detail' && selectedNc && (
          <NcDetailView nc={selectedNc} />
        )}
      </DrillDownSheet>
    </div>
  );
}