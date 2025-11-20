"use client";

import React, { useState, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileUp, AlertTriangle, ListTodo } from 'lucide-react';
import { format, isAfter, parse, isValid, startOfDay, startOfMonth } from 'date-fns';
import { KpiCard } from './kpi-card';
import { CapaChart } from './capa-chart';
import { Skeleton } from './ui/skeleton';
import { DataTable, DataTableColumn } from './data-table';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getProductionTeam } from '@/lib/teams';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useData } from '@/contexts/data-context';

interface ChangeActionData {
  'Change_ActionID': string;
  'Action required prior to change': string;
  'Responsible': string;
  'Pending Steps': string;
  'Deadline': string;
  'Change Title': string;
  'Change ID (CMID)': string;
  'Registration Time': string;
  isOverdue: boolean;
  deadlineDate: Date;
  registrationDate: Date;
}

const DATE_FORMATS = [
  'dd/MM/yyyy HH:mm',
  'dd.MM.yyyy HH:mm',
  'dd/MM/yyyy',
  'dd.MM.yyyy',
  'M/d/yyyy',
  'MM/dd/yyyy'
];

const parseDate = (dateString: string): Date => {
  if (!dateString) return new Date('invalid');

  for (const formatStr of DATE_FORMATS) {
    const parsed = parse(dateString.trim(), formatStr, new Date());
    if (isValid(parsed)) {
      return parsed;
    }
  }

  const nativeParsed = new Date(dateString);
  if (isValid(nativeParsed)) {
    return nativeParsed;
  }

  return new Date('invalid');
}

export default function ChangeActionDashboard() {
  const { changeActionData } = useData();
  const [showCompleted, setShowCompleted] = useState(false);
  const [teamFilter, setTeamFilter] = useState<'all' | 'production'>('all');
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null);
  const productionTeam = getProductionTeam();

  const allDataWithDates = useMemo(() => {
    const today = startOfDay(new Date());
    return changeActionData.map(item => {
        const deadlineDate = parseDate(item.Deadline);
        const registrationDate = parseDate(item['Registration Time']);
        const isOverdue = isValid(deadlineDate) && isAfter(today, deadlineDate);
        return { ...item, deadlineDate, registrationDate, isOverdue };
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

  const selectedChangeIdActions = useMemo(() => {
    if (!selectedChangeId) return [];
    return allDataWithDates.filter(item => item['Change ID (CMID)'] === selectedChangeId);
  }, [allDataWithDates, selectedChangeId]);

  const selectedChangeTitle = useMemo(() => {
    if (!selectedChangeIdActions || selectedChangeIdActions.length === 0) return '';
    return selectedChangeIdActions[0]['Change Title'];
  }, [selectedChangeIdActions]);

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

  const detailColumns: DataTableColumn<ChangeActionData>[] = [
    { accessorKey: 'Change_ActionID', header: 'Action ID', cell: (row) => row['Change_ActionID'] },
    { accessorKey: 'Action required prior to change', header: 'Action Required', cell: (row) => row['Action required prior to change'] },
    { accessorKey: 'Responsible', header: 'Responsible', cell: (row) => row['Responsible'] },
    { accessorKey: 'Pending Steps', header: 'Pending Steps', cell: (row) => row['Pending Steps'] ? <Badge variant="secondary">{row['Pending Steps']}</Badge> : <Badge>Completed</Badge>},
    { accessorKey: 'deadlineDate', header: 'Deadline', cell: (row) => isValid(row.deadlineDate) ? format(row.deadlineDate, 'PPP') : 'Invalid Date'},
    { accessorKey: 'status', header: 'Status', cell: (row) => row.isOverdue ? <Badge variant="destructive">Overdue</Badge> : <Badge className="bg-green-500">On Time</Badge>},
  ];


  const MainContent = () => (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Active Change Actions" value={kpiValues.totalCount} icon={ListTodo} />
        <KpiCard title="Overdue Actions" value={kpiValues.overdueCount} icon={AlertTriangle} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <CapaChart data={monthlyRegistrationData} title="Monthly Registrations" dataKey="total" />
        <CapaChart 
            data={actionsByChangeIdData} 
            title="Actions by Change ID" 
            dataKey="total"
            onBarClick={setSelectedChangeId}
        />
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

       <Dialog open={!!selectedChangeId} onOpenChange={(open) => !open && setSelectedChangeId(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Actions for Change ID: {selectedChangeId}</DialogTitle>
            <DialogDescription>{selectedChangeTitle}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <DataTable
              columns={detailColumns}
              data={selectedChangeIdActions}
              getRowClassName={(row) => cn(row.isOverdue && "bg-accent/20 hover:bg-accent/30")}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
