"use client";

import React, { useState, useMemo, ChangeEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileUp, CalendarIcon } from 'lucide-react';
import { format, parse, isValid, getQuarter } from 'date-fns';
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

// Updated headers: Removed "Deadline...", Added "Status"
const EXPECTED_HEADERS = ["Id", "Non Conformance Title", "Classification", "Pending Steps", "Case Worker", "Status", "Registration Time", "Registered By", "Reoccurrence"];

interface NonConformanceData {
  Id: string;
  "Non Conformance Title": string;
  Classification: "Low risk" | "High risk" | string;
  "Pending Steps": string;
  "Case Worker": string;
  "Status": string;
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
  
  // Multi-Year Selection State (Default: Current & Previous)
  const currentRealYear = new Date().getFullYear();
  const [selectedYears, setSelectedYears] = useState<number[]>([currentRealYear, currentRealYear - 1]);
  
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