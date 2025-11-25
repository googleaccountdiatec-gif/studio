"use client";

import React, { useState, useMemo, ChangeEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileUp } from 'lucide-react';
import { format, parse, isValid, getQuarter } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from './ui/skeleton';
import { DataTable, DataTableColumn } from './data-table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useData } from '@/contexts/data-context';
import { getProductionTeam } from '@/lib/teams';
import { Switch } from '@/components/ui/switch';

const EXPECTED_HEADERS = ["Id", "Non Conformance Title", "Classification", "Pending Steps", "Case Worker", "Deadline for Investigation and Action Plan", "Registration Time", "Registered By", "Reoccurrence"];

interface NonConformanceData {
  Id: string;
  "Non Conformance Title": string;
  Classification: "Low risk" | "High risk" | string;
  "Pending Steps": string;
  "Case Worker": string;
  "Deadline for Investigation and Action Plan": string;
  "Registration Time": string;
  "Registered By": string;
  Reoccurrence: "YES" | "NO" | string;
  registrationDate: Date;
}

const DATE_FORMATS = [
  "dd/MM/yyyy hh:mm a", 
  "dd/MM/yyyy H:mm", 
  "dd/MM/yyyy", 
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

export default function NonConformanceDashboard() {
  const { nonConformanceData } = useData();
  const [yearFilter, setYearFilter] = useState<'all' | 'current' | 'previous' | 'current-previous'>('current-previous');
  const [teamFilter, setTeamFilter] = useState<'all' | 'production'>('all');
  const [dialogData, setDialogData] = useState<{ title: string; data: NonConformanceData[] } | null>(null);
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

  const quarterlyData = useMemo(() => {
    if (allDataWithDates.length === 0) return [];
    
    const yearsInData = [...new Set(allDataWithDates
        .map(d => d.registrationDate.getFullYear())
        .filter(y => !isNaN(y))
    )];

    if (yearsInData.length === 0) return [];
    
    const minYear = Math.min(...yearsInData);
    const maxYear = Math.max(...yearsInData);

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
        .filter(item => item.total > 0);
  }, [allDataWithDates]);
  
  const filteredChartData = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;

    switch (yearFilter) {
        case 'all':
            return quarterlyData;
        case 'current':
            return quarterlyData.filter(q => q.name.startsWith(String(currentYear)));
        case 'previous':
            return quarterlyData.filter(q => q.name.startsWith(String(previousYear)));
        case 'current-previous':
            return quarterlyData.filter(q => q.name.startsWith(String(currentYear)) || q.name.startsWith(String(previousYear)));
        default:
            return quarterlyData;
    }
  }, [quarterlyData, yearFilter]);


  const handleBarClick = (payload: any) => {
    if (!payload || !payload.activePayload || !payload.activePayload[0]) return;
    const quarterName = payload.activePayload[0].payload.name;
    const seriesName = payload.activePayload[0].name;
    
    const quarterInfo = quarterlyData.find(q => q.name === quarterName);
    if (!quarterInfo) return;

    let recordsToShow = quarterInfo.records;
    let title = `${seriesName} NCs for ${quarterName}`;

    if (seriesName === "Low Risk") {
      recordsToShow = quarterInfo.records.filter(r => r.Classification === "Low risk");
    } else if (seriesName === "High Risk") {
       recordsToShow = quarterInfo.records.filter(r => r.Classification === "High risk");
    } else if (seriesName === "Reoccurring") {
       recordsToShow = quarterInfo.records.filter(r => r.Reoccurrence === "YES");
       title = `Reoccurring NCs for ${quarterName}`;
    } else if (seriesName === "Total NCs") {
      // No extra filtering needed
    }
    
    setDialogData({ title, data: recordsToShow });
  };
  
  const detailColumns: DataTableColumn<NonConformanceData>[] = [
    { accessorKey: 'Id', header: 'ID', cell: (row) => row.Id },
    { accessorKey: 'Non Conformance Title', header: 'Title', cell: (row) => row["Non Conformance Title"] },
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
          <CardDescription>Low risk, high risk, and total non-conformances per quarter.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={filteredChartData} onClick={handleBarClick}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
              <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="right" dataKey="lowRisk" name="Low Risk" fill="hsl(var(--chart-2))" cursor="pointer" />
              <Bar yAxisId="right" dataKey="highRisk" name="High Risk" fill="hsl(var(--chart-5))" cursor="pointer" />
              <Bar yAxisId="left" dataKey="total" name="Total NCs" fill="hsl(var(--chart-1))" cursor="pointer" />
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
                 <LineChart data={filteredChartData} onClick={handleBarClick}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="reoccurring" name="Reoccurring" stroke="hsl(var(--chart-1))" strokeWidth={2} cursor="pointer" />
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
        <RadioGroup value={yearFilter} onValueChange={(value) => setYearFilter(value as any)} className="flex items-center gap-4">
            <Label>Year:</Label>
             <div className="flex items-center space-x-2">
                <RadioGroupItem value="current-previous" id="year-current-previous" />
                <Label htmlFor="year-current-previous">Current & Previous Year</Label>
            </div>
             <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="year-all" />
                <Label htmlFor="year-all">All Time</Label>
            </div>
            <div className="flex items-center space-x-2">
                <RadioGroupItem value="current" id="year-current" />
                <Label htmlFor="year-current">Current Year</Label>
            </div>
            <div className="flex items-center space-x-2">
                <RadioGroupItem value="previous" id="year-previous" />
                <Label htmlFor="year-previous">Previous Year</Label>
            </div>
        </RadioGroup>
        
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

      <Dialog open={!!dialogData} onOpenChange={(open) => !open && setDialogData(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{dialogData?.title}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <DataTable
              columns={detailColumns}
              data={dialogData?.data || []}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
