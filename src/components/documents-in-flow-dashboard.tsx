"use client";

import React, { useMemo } from 'react';
import { useData } from '@/contexts/data-context';
import { GlassCard } from '@/components/ui/glass-card';
import { ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip } from 'recharts';
import { CapaChart } from './capa-chart';
import { DataTable, DataTableColumn } from './data-table';
import { Badge } from './ui/badge';
import { FileUp } from 'lucide-react';
import type { DocumentKpiData } from '@/lib/types';

const PIE_COLORS = [
    'hsl(var(--chart-1))', 
    'hsl(var(--chart-2))', 
    'hsl(var(--chart-3))', 
    'hsl(var(--chart-4))', 
    'hsl(var(--chart-5))'
];

export default function DocumentsInFlowDashboard() {
  const { documentKpiData } = useData();

  const documentsInFlow = useMemo(() => {
    return documentKpiData.filter(doc => doc['Pending Steps'] && doc['Pending Steps'].trim() !== '');
  }, [documentKpiData]);

  const revisionTypeData = useMemo(() => {
    const counts: { [key: string]: number } = {
        "Major Revision": 0,
        "Minor Revision": 0,
        "New Document": 0,
        "Other": 0,
    };
    documentsInFlow.forEach(doc => {
      const flow = (doc['Document Flow'] || 'Other').toLowerCase();
      if (flow.includes('major')) {
        counts["Major Revision"]++;
      } else if (flow.includes('minor')) {
        counts["Minor Revision"]++;
      } else if (flow.includes('create') || flow.includes('new')) {
        counts["New Document"]++;
      } else {
        counts["Other"]++;
      }
    });
    return Object.entries(counts)
      .filter(([, value]) => value > 0) // Don't show categories with 0 documents
      .map(([name, value]) => ({ name, value }));
  }, [documentsInFlow]);

  const statusData = useMemo(() => {
    const counts: { [key: string]: number } = {};
    documentsInFlow.forEach(doc => {
      const step = doc['Pending Steps'] || 'Unknown';
      counts[step] = (counts[step] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [documentsInFlow]);

  const columns: DataTableColumn<DocumentKpiData>[] = [
    { accessorKey: 'Doc Number', header: 'Doc Number', cell: (row) => `${row['Doc Prefix']}-${row['Doc Number']}` },
    { accessorKey: 'Title', header: 'Title', cell: (row) => row['Title'] },
    { accessorKey: 'Document Flow', header: 'Revision Type', cell: (row) => <Badge variant="secondary">{row['Document Flow']}</Badge> },
    { accessorKey: 'Pending Steps', header: 'Current Status', cell: (row) => <Badge variant="outline">{row['Pending Steps']}</Badge> },
  ];

  if (documentKpiData.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center text-center py-20 px-4 rounded-lg border-2 border-dashed border-muted-foreground/30">
            <FileUp className="h-16 w-16 text-muted-foreground mb-4"/>
            <h2 className="text-2xl font-semibold mb-2">Upload Document KPI Data</h2>
            <p className="text-muted-foreground mb-6 max-w-md">Use the uploader in the header to import your "Document KPI.csv" file.</p>
        </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard className="p-6">
          <h3 className="text-lg font-semibold mb-4">Documents by Revision Type</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={revisionTypeData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {revisionTypeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', backdropFilter: 'blur(4px)', border: '1px solid hsl(var(--border))' }} />
              <Legend layout="vertical" verticalAlign="middle" align="right" />
            </PieChart>
          </ResponsiveContainer>
        </GlassCard>
        
        <GlassCard className="p-6">
          <div className="h-[350px] w-full">
            <CapaChart data={statusData} title="Documents by Current Status" dataKey="total" />
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold mb-4">All Documents In Flow</h3>
        <DataTable columns={columns} data={documentsInFlow} />
      </GlassCard>
    </div>
  );
}
