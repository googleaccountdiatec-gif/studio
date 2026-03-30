"use client";

import React, { useState, useMemo } from 'react';
import { useData } from '@/contexts/data-context';
import { GlassCard } from '@/components/ui/glass-card';
import { ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip } from 'recharts';
import { CapaChart } from './capa-chart';
import { Badge } from './ui/badge';
import { FileUp, FileText, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  DrillDownSheet,
  SummaryBar,
  ExpandableDataTable,
  DetailSection,
  CrossLinkBadge,
} from '@/components/drill-down';
import type { Breadcrumb, SummaryMetric, ExpandableColumn } from '@/components/drill-down';
import { exportToCsv } from '@/lib/csv-export';
import { parseCrossReferences } from '@/lib/cross-references';

interface DocumentKpiData {
  'Doc Prefix': string;
  'Doc Number': string;
  'Title': string;
  'Version Date': string;
  'Document Flow': string;
  'Pending Steps': string;
  'Completed On': string;
  'Author': string;
  'Version'?: string;
  'Change Reason'?: string;
  'Responsible'?: string;
  'Authorized copy'?: string;
  'Periodic review of document'?: string;
  'Distribution List'?: string;
  [key: string]: any;
}

const PIE_COLORS = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))'
];

function getRevisionType(doc: DocumentKpiData): string {
  const flow = (doc['Document Flow'] || 'Other').toLowerCase();
  if (flow.includes('major')) return 'Major Revision';
  if (flow.includes('minor')) return 'Minor Revision';
  if (flow.includes('create') || flow.includes('new')) return 'New Document';
  return 'Other';
}

function getDocId(doc: DocumentKpiData): string {
  return `${doc['Doc Prefix']}-${doc['Doc Number']}`;
}

export default function DocumentsInFlowDashboard() {
  const { documentKpiData: rawDocumentKpiData } = useData();
  const documentKpiData = rawDocumentKpiData as DocumentKpiData[];

  // --- State ---
  const [selectedDistPerson, setSelectedDistPerson] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [navigationLevel, setNavigationLevel] = useState<'list' | 'detail'>('list');

  // --- Derived data ---
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
      const type = getRevisionType(doc);
      counts[type]++;
    });
    return Object.entries(counts)
      .filter(([, value]) => value > 0)
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

  const distributionTeamData = useMemo(() => {
    const counts: Record<string, number> = {};
    documentsInFlow.forEach(doc => {
      const list = doc['Distribution List'];
      if (!list) return;
      list.split(',').map(s => s.trim()).filter(Boolean).forEach(person => {
        counts[person] = (counts[person] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);
  }, [documentsInFlow]);

  const kpiMetrics = useMemo(() => {
    const totalInFlow = documentsInFlow.length;
    const periodicReviewRequired = documentsInFlow.filter(
      doc => doc['Periodic review of document']?.trim().toLowerCase() === 'required'
    ).length;
    const authorizedCopies = documentsInFlow.filter(
      doc => doc['Authorized copy']?.trim().toLowerCase() === 'yes'
    ).length;
    return { totalInFlow, periodicReviewRequired, authorizedCopies };
  }, [documentsInFlow]);

  const distPersonDrillDownData = useMemo(() => {
    if (!selectedDistPerson) return [];
    return documentsInFlow.filter(doc => {
      const list = (doc['Distribution List'] || '').split(',').map(s => s.trim());
      return list.includes(selectedDistPerson);
    });
  }, [documentsInFlow, selectedDistPerson]);

  const statusDrillDownData = useMemo(() => {
    if (!selectedStatus) return [];
    return documentsInFlow.filter(doc => (doc['Pending Steps'] || 'Unknown') === selectedStatus);
  }, [documentsInFlow, selectedStatus]);

  const selectedDoc = useMemo(() => {
    if (!selectedDocId) return null;
    return documentsInFlow.find(doc => getDocId(doc) === selectedDocId) ?? null;
  }, [documentsInFlow, selectedDocId]);

  // --- Columns for main table ---
  const mainColumns: ExpandableColumn<DocumentKpiData>[] = useMemo(() => [
    {
      key: 'Doc Number',
      header: 'Doc Number',
      sortable: true,
      cell: (row: DocumentKpiData) => (
        <span className="font-mono text-sm">{getDocId(row)}</span>
      ),
    },
    { key: 'Title', header: 'Title', cell: (row: DocumentKpiData) => (
      <span className="max-w-[250px] truncate block">{row['Title']}</span>
    )},
    { key: 'Author', header: 'Author', sortable: true },
    { key: 'Version', header: 'Version', cell: (row: DocumentKpiData) => row['Version'] || '-' },
    {
      key: 'Document Flow',
      header: 'Revision Type',
      cell: (row: DocumentKpiData) => {
        const type = getRevisionType(row);
        const variant = type === 'Major Revision' ? 'destructive'
          : type === 'New Document' ? 'default'
          : 'secondary';
        return <Badge variant={variant}>{type}</Badge>;
      },
    },
    {
      key: 'Pending Steps',
      header: 'Status',
      cell: (row: DocumentKpiData) => <Badge variant="outline">{row['Pending Steps']}</Badge>,
    },
  ], []);

  // --- Columns for drill-down tables ---
  const drillDownColumns: ExpandableColumn<DocumentKpiData>[] = useMemo(() => [
    {
      key: 'Doc Number',
      header: 'Doc #',
      sortable: true,
      cell: (row: DocumentKpiData) => (
        <span className="font-mono text-sm">{getDocId(row)}</span>
      ),
    },
    { key: 'Title', header: 'Title', cell: (row: DocumentKpiData) => (
      <span className="max-w-[200px] truncate block">{row['Title']}</span>
    )},
    { key: 'Version', header: 'Version', cell: (row: DocumentKpiData) => row['Version'] || '-' },
    {
      key: 'Document Flow',
      header: 'Type',
      cell: (row: DocumentKpiData) => {
        const type = getRevisionType(row);
        const variant = type === 'Major Revision' ? 'destructive'
          : type === 'New Document' ? 'default'
          : 'secondary';
        return <Badge variant={variant}>{type}</Badge>;
      },
    },
    {
      key: 'Pending Steps',
      header: 'Status',
      cell: (row: DocumentKpiData) => <Badge variant="outline">{row['Pending Steps']}</Badge>,
    },
  ], []);

  // --- Expanded content for tables ---
  const mainExpandedContent = (row: DocumentKpiData) => (
    <div className="space-y-2 text-sm">
      <div>
        <span className="font-medium text-muted-foreground">Change Reason: </span>
        <span>{row['Change Reason'] || 'Not provided'}</span>
      </div>
      <div>
        <span className="font-medium text-muted-foreground">Responsible (Approver): </span>
        <span>{row['Responsible'] || 'Not assigned'}</span>
      </div>
      {row['Distribution List'] && (
        <div>
          <span className="font-medium text-muted-foreground">Distribution List: </span>
          <span>{row['Distribution List']}</span>
        </div>
      )}
    </div>
  );

  const drillDownExpandedContent = (row: DocumentKpiData) => (
    <div className="space-y-1 text-sm">
      <div>
        <span className="font-medium text-muted-foreground">Change Reason: </span>
        <span>{row['Change Reason'] || 'Not provided'}</span>
      </div>
    </div>
  );

  // --- Handlers ---
  const handleMainRowClick = (row: DocumentKpiData) => {
    setSelectedDocId(getDocId(row));
    setSelectedStatus(row['Pending Steps'] || 'Unknown');
    setNavigationLevel('detail');
  };

  const handleDrillDownRowClick = (row: DocumentKpiData) => {
    setSelectedDocId(getDocId(row));
    setNavigationLevel('detail');
  };

  const handleDistSheetClose = (open: boolean) => {
    if (!open) {
      setSelectedDistPerson(null);
      setSelectedDocId(null);
      setNavigationLevel('list');
    }
  };

  const handleStatusSheetClose = (open: boolean) => {
    if (!open) {
      setSelectedStatus(null);
      setSelectedDocId(null);
      setNavigationLevel('list');
    }
  };

  const handleBackToDistList = () => {
    setSelectedDocId(null);
    setNavigationLevel('list');
  };

  const handleBackToStatusList = () => {
    setSelectedDocId(null);
    setNavigationLevel('list');
  };

  // --- Summary metrics for drill-down ---
  const getDistSummaryMetrics = (data: DocumentKpiData[]): SummaryMetric[] => [
    { label: 'Documents', value: data.length },
    {
      label: 'Major Revisions',
      value: data.filter(d => getRevisionType(d) === 'Major Revision').length,
      color: data.filter(d => getRevisionType(d) === 'Major Revision').length > 0 ? 'warning' : 'default',
    },
    {
      label: 'Periodic Review Required',
      value: data.filter(d => d['Periodic review of document']?.trim().toLowerCase() === 'required').length,
      color: data.filter(d => d['Periodic review of document']?.trim().toLowerCase() === 'required').length > 0 ? 'warning' : 'default',
    },
  ];

  const getStatusSummaryMetrics = (data: DocumentKpiData[]): SummaryMetric[] => [
    { label: 'Documents', value: data.length },
    {
      label: 'Major Revisions',
      value: data.filter(d => getRevisionType(d) === 'Major Revision').length,
      color: data.filter(d => getRevisionType(d) === 'Major Revision').length > 0 ? 'warning' : 'default',
    },
    {
      label: 'New Documents',
      value: data.filter(d => getRevisionType(d) === 'New Document').length,
    },
  ];

  // --- Export handlers ---
  const handleExportDistCsv = () => {
    exportToCsv(
      distPersonDrillDownData,
      [
        { key: 'Doc Prefix', header: 'Prefix' },
        { key: 'Doc Number', header: 'Doc Number' },
        { key: 'Title', header: 'Title' },
        { key: 'Author', header: 'Author' },
        { key: 'Version', header: 'Version' },
        { key: 'Document Flow', header: 'Document Flow' },
        { key: 'Pending Steps', header: 'Status' },
        { key: 'Responsible', header: 'Responsible' },
      ],
      `documents-distribution-${selectedDistPerson?.replace(/\s+/g, '_')}.csv`
    );
  };

  const handleExportStatusCsv = () => {
    exportToCsv(
      statusDrillDownData,
      [
        { key: 'Doc Prefix', header: 'Prefix' },
        { key: 'Doc Number', header: 'Doc Number' },
        { key: 'Title', header: 'Title' },
        { key: 'Author', header: 'Author' },
        { key: 'Version', header: 'Version' },
        { key: 'Document Flow', header: 'Document Flow' },
        { key: 'Pending Steps', header: 'Status' },
        { key: 'Change Reason', header: 'Change Reason' },
      ],
      `documents-by-status-${selectedStatus?.replace(/\s+/g, '_')}.csv`
    );
  };

  // --- Empty state ---
  if (documentKpiData.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center text-center py-20 px-4 rounded-lg border-2 border-dashed border-muted-foreground/30">
            <FileUp className="h-16 w-16 text-muted-foreground mb-4"/>
            <h2 className="text-2xl font-semibold mb-2">Upload Document KPI Data</h2>
            <p className="text-muted-foreground mb-6 max-w-md">Use the uploader in the header to import your "Document KPI.csv" file.</p>
        </div>
    );
  }

  // --- Cross-references helper ---
  const renderCrossLinks = (changeReason: string | undefined | null) => {
    const refs = parseCrossReferences(changeReason);
    if (refs.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-2">
        {refs.map((ref, i) => (
          <CrossLinkBadge
            key={`${ref.domain}-${ref.id}-${i}`}
            domain={ref.domain}
            id={ref.id}
            label={ref.rawMatch}
            onClick={() => {}}
          />
        ))}
      </div>
    );
  };

  // --- Detail view for a single document ---
  const renderDocumentDetail = (doc: DocumentKpiData, onBack: () => void, backLabel: string) => {
    const type = getRevisionType(doc);
    const crossLinks = parseCrossReferences(doc['Change Reason']);
    const distributionItems = doc['Distribution List']
      ? doc['Distribution List'].split(',').map(s => s.trim()).filter(Boolean)
      : [];

    return (
      <div className="space-y-6">
        {/* Title and badges */}
        <div>
          <h3 className="text-lg font-semibold mb-2">{doc['Title']}</h3>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Version {doc['Version'] || 'N/A'}</Badge>
            <Badge variant={type === 'Major Revision' ? 'destructive' : type === 'New Document' ? 'default' : 'secondary'}>
              {type}
            </Badge>
            <Badge variant="outline">{doc['Pending Steps']}</Badge>
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground font-medium">Author</p>
            <p className="text-sm font-semibold mt-1">{doc['Author'] || 'Unknown'}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground font-medium">Responsible (Approver)</p>
            <p className="text-sm font-semibold mt-1">{doc['Responsible'] || 'Not assigned'}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground font-medium">Version Date</p>
            <p className="text-sm font-semibold mt-1">{doc['Version Date'] || '-'}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground font-medium">Completed On</p>
            <p className="text-sm font-semibold mt-1">{doc['Completed On'] || 'In progress'}</p>
          </div>
        </div>

        {/* Change Reason */}
        <DetailSection
          title="Change Reason"
          content={doc['Change Reason']}
          emptyText="No change reason provided"
          defaultOpen={true}
        />

        {/* Compliance block */}
        <div className="rounded-lg border p-4">
          <h4 className="text-sm font-medium mb-3">Compliance</h4>
          <div className="flex flex-wrap gap-2">
            <Badge variant={doc['Authorized copy']?.trim().toLowerCase() === 'yes' ? 'default' : 'secondary'}>
              {doc['Authorized copy']?.trim().toLowerCase() === 'yes' ? 'Authorized Copy' : 'Not Authorized Copy'}
            </Badge>
            <Badge variant={doc['Periodic review of document']?.trim().toLowerCase() === 'required' ? 'destructive' : 'secondary'}>
              {doc['Periodic review of document']?.trim().toLowerCase() === 'required' ? 'Periodic Review Required' : 'No Periodic Review'}
            </Badge>
          </div>
        </div>

        {/* Distribution List */}
        {distributionItems.length > 0 && (
          <div className="rounded-lg border p-4">
            <h4 className="text-sm font-medium mb-3">Distribution List</h4>
            <div className="flex flex-wrap gap-2">
              {distributionItems.map((item, i) => (
                <Badge key={i} variant="outline">{item}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Cross-links */}
        {crossLinks.length > 0 && (
          <div className="rounded-lg border p-4">
            <h4 className="text-sm font-medium mb-3">Cross-References</h4>
            <div className="flex flex-wrap gap-2">
              {crossLinks.map((ref, i) => (
                <CrossLinkBadge
                  key={`${ref.domain}-${ref.id}-${i}`}
                  domain={ref.domain}
                  id={ref.id}
                  label={ref.rawMatch}
                  onClick={() => {}}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <GlassCard className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">Total In Flow</p>
          </div>
          <p className="text-3xl font-bold">{kpiMetrics.totalInFlow}</p>
        </GlassCard>
        <GlassCard className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">Periodic Review Required</p>
          </div>
          <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
            {kpiMetrics.periodicReviewRequired}
          </p>
        </GlassCard>
        <GlassCard className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">Authorized Copies</p>
          </div>
          <p className="text-3xl font-bold">{kpiMetrics.authorizedCopies}</p>
        </GlassCard>
      </div>

      {/* Charts row */}
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
            <CapaChart
              data={statusData}
              title="Documents by Current Status"
              dataKey="total"
              onBarClick={(name) => setSelectedStatus(name)}
            />
          </div>
        </GlassCard>
      </div>

      {/* Distribution Team chart */}
      <GlassCard className="p-6">
        <div className="h-[400px] w-full">
          <CapaChart
            data={distributionTeamData}
            title="Distribution Team (Top 15)"
            dataKey="total"
            onBarClick={(name) => setSelectedDistPerson(name)}
          />
        </div>
      </GlassCard>

      {/* Main data table */}
      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold mb-4">All Documents In Flow</h3>
        <ExpandableDataTable
          columns={mainColumns}
          data={documentsInFlow}
          getRowId={(row) => getDocId(row)}
          expandedContent={mainExpandedContent}
          onRowClick={handleMainRowClick}
        />
      </GlassCard>

      {/* Distribution Team DrillDownSheet */}
      <DrillDownSheet
        open={!!selectedDistPerson}
        onOpenChange={handleDistSheetClose}
        title={navigationLevel === 'detail' && selectedDoc
          ? getDocId(selectedDoc)
          : `Distribution: ${selectedDistPerson}`
        }
        breadcrumbs={navigationLevel === 'detail' ? [
          { label: `Distribution: ${selectedDistPerson}`, onClick: handleBackToDistList },
        ] : []}
        onExportCsv={navigationLevel === 'list' ? handleExportDistCsv : undefined}
      >
        {navigationLevel === 'detail' && selectedDoc ? (
          renderDocumentDetail(selectedDoc, handleBackToDistList, `Distribution: ${selectedDistPerson}`)
        ) : (
          <div className="space-y-6">
            <SummaryBar metrics={getDistSummaryMetrics(distPersonDrillDownData)} />
            <ExpandableDataTable
              columns={[
                ...drillDownColumns.slice(0, 2),
                { key: 'Author', header: 'Author', sortable: true, cell: (row: DocumentKpiData) => row['Author'] || 'Unknown' },
                ...drillDownColumns.slice(2),
              ]}
              data={distPersonDrillDownData}
              getRowId={(row) => getDocId(row)}
              expandedContent={drillDownExpandedContent}
              onRowClick={handleDrillDownRowClick}
            />
          </div>
        )}
      </DrillDownSheet>

      {/* Status DrillDownSheet */}
      <DrillDownSheet
        open={!!selectedStatus}
        onOpenChange={handleStatusSheetClose}
        title={navigationLevel === 'detail' && selectedDoc
          ? getDocId(selectedDoc)
          : `Status: ${selectedStatus}`
        }
        breadcrumbs={navigationLevel === 'detail' ? [
          { label: `Status: ${selectedStatus}`, onClick: handleBackToStatusList },
        ] : []}
        onExportCsv={navigationLevel === 'list' ? handleExportStatusCsv : undefined}
      >
        {navigationLevel === 'detail' && selectedDoc ? (
          renderDocumentDetail(selectedDoc, handleBackToStatusList, `Status: ${selectedStatus}`)
        ) : (
          <div className="space-y-6">
            <SummaryBar metrics={getStatusSummaryMetrics(statusDrillDownData)} />
            <ExpandableDataTable
              columns={drillDownColumns}
              data={statusDrillDownData}
              getRowId={(row) => getDocId(row)}
              expandedContent={drillDownExpandedContent}
              onRowClick={handleDrillDownRowClick}
            />
          </div>
        )}
      </DrillDownSheet>
    </div>
  );
}
