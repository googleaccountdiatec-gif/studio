"use client";

import React, { useMemo, useState } from 'react';
import { useData } from '@/contexts/data-context';
import { GlassCard } from '@/components/ui/glass-card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ListTodo, AlertTriangle, GitBranch, Clock } from 'lucide-react';
import { format, isValid, parseISO } from 'date-fns';
import { ExpandableDataTable, SummaryBar } from '@/components/drill-down';
import type { ExpandableColumn } from '@/components/drill-down';
import { cn } from '@/lib/utils';
import {
  getReleasedBatchNumbers,
  getDownstreamNotReleased,
  daysSince,
} from '@/lib/batch-registry/filter';

interface BatchRegistryRow {
  id: string;
  batchNumber: string;
  typeOfBatch: string;
  projectNumber: string;
  productName: string;
  cloneName: string;
  pendingSteps: string;
  registrationTime: string;
  daysOld: number | null;
  previousBatches: Array<{
    'Batch number': string;
    'Type of batch': string;
    'Registration Time': string;
  }>;
  raw: Record<string, unknown>;
}

function formatRegistrationDate(iso: string): string {
  if (!iso) return '—';
  const d = parseISO(iso);
  return isValid(d) ? format(d, 'yyyy-MM-dd') : '—';
}

export default function BatchRegistryDashboard() {
  const { batchRegistryData, batchReleaseData } = useData();
  const [batchFilter, setBatchFilter] = useState('');

  const releasedSet = useMemo(
    () => getReleasedBatchNumbers(batchReleaseData),
    [batchReleaseData],
  );

  const downstreamNotReleased = useMemo(
    () => getDownstreamNotReleased(batchRegistryData, releasedSet),
    [batchRegistryData, releasedSet],
  );

  const totals = useMemo(() => {
    const upstream = batchRegistryData.filter((r) => r['Is Upstream'] === true).length;
    const downstream = batchRegistryData.filter((r) => r['Is Upstream'] === false).length;
    return {
      total: batchRegistryData.length,
      upstream,
      downstream,
      pending: downstreamNotReleased.length,
    };
  }, [batchRegistryData, downstreamNotReleased]);

  const rows: BatchRegistryRow[] = useMemo(() => {
    return downstreamNotReleased.map((r, i) => {
      const batchNumber = (r['Batch number'] as string) || '';
      const previous = Array.isArray(r['Previous Batches'])
        ? (r['Previous Batches'] as Array<Record<string, string>>).filter(
            (p) => typeof p['Batch number'] === 'string' && p['Batch number'].trim() !== '',
          )
        : [];
      return {
        id: (r['BRID'] as string) || batchNumber || String(i),
        batchNumber,
        typeOfBatch: (r['Type of batch'] as string) || '',
        projectNumber: (r['Project Number'] as string) || '',
        productName: (r['Product Name'] as string) || '',
        cloneName: (r['Clone name'] as string) || '',
        pendingSteps: (r['Pending Steps'] as string) || '',
        registrationTime: (r['Registration Time'] as string) || '',
        daysOld: daysSince(r['Registration Time']),
        previousBatches: previous as BatchRegistryRow['previousBatches'],
        raw: r as Record<string, unknown>,
      };
    });
  }, [downstreamNotReleased]);

  const filteredRows = useMemo(() => {
    if (batchFilter.trim() === '') return rows;
    const q = batchFilter.toLowerCase();
    return rows.filter(
      (r) =>
        r.batchNumber.toLowerCase().includes(q) ||
        r.projectNumber.toLowerCase().includes(q) ||
        r.productName.toLowerCase().includes(q) ||
        r.cloneName.toLowerCase().includes(q),
    );
  }, [rows, batchFilter]);

  const columns: ExpandableColumn<BatchRegistryRow>[] = [
    { key: 'batchNumber', header: 'Batch #', sortable: true },
    { key: 'typeOfBatch', header: 'Type', sortable: true },
    {
      key: 'projectNumber',
      header: 'Project #',
      sortable: true,
      cell: (r) => r.projectNumber || <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'daysOld',
      header: 'Days old',
      sortable: true,
      cell: (r) =>
        r.daysOld === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className={cn(r.daysOld > 60 && 'text-amber-600 dark:text-amber-400 font-medium')}>
            {r.daysOld}
          </span>
        ),
    },
    {
      key: 'pendingSteps',
      header: 'Pending step',
      sortable: true,
      cell: (r) =>
        r.pendingSteps ? (
          <Badge variant="outline" className="font-normal">
            {r.pendingSteps}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  if (batchRegistryData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-20 px-4 rounded-lg border-2 border-dashed border-muted-foreground/30">
        <GitBranch className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">No Batch Registry data</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Run a sync from the header to load batch registry records from BizzMine.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SummaryBar
        metrics={[
          {
            label: 'Downstream not yet released',
            value: totals.pending,
            color: totals.pending > 0 ? 'warning' : 'success',
            icon: AlertTriangle,
          },
          { label: 'Downstream batches', value: totals.downstream, icon: GitBranch },
          { label: 'Upstream batches', value: totals.upstream, icon: GitBranch },
          { label: 'Total registered', value: totals.total, icon: ListTodo },
        ]}
      />

      <GlassCard className="p-4">
        <div className="grid gap-4 md:grid-cols-2 items-end">
          <div className="space-y-2">
            <Label>Search</Label>
            <Input
              placeholder="Batch #, project, product, clone..."
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
            />
          </div>
          <div className="text-sm text-muted-foreground">
            Showing {filteredRows.length} of {rows.length} downstream batches not yet released
            (oldest first).
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Downstream batches awaiting release</h3>
        </div>
        <ExpandableDataTable<BatchRegistryRow>
          columns={columns}
          data={filteredRows}
          getRowId={(row) => row.id}
          getRowClassName={(row) =>
            cn(row.daysOld !== null && row.daysOld > 90 && 'bg-amber-500/10')
          }
          expandedContent={(row) => (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <span className="font-medium text-muted-foreground">Registered: </span>
                  {formatRegistrationDate(row.registrationTime)}
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Product: </span>
                  {row.productName || 'N/A'}
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Clone: </span>
                  {row.cloneName || 'N/A'}
                </div>
              </div>

              <div>
                <p className="font-medium text-muted-foreground mb-2">
                  Pooling tree (previous batches that fed this batch):
                </p>
                {row.previousBatches.length === 0 ? (
                  <p className="text-muted-foreground italic">
                    No previous batches recorded.
                  </p>
                ) : (
                  <ul className="space-y-1 ml-2 border-l-2 border-muted pl-3">
                    {row.previousBatches.map((p, i) => (
                      <li key={`${row.id}-prev-${i}`} className="flex items-center gap-2">
                        <span className="font-mono text-xs">{p['Batch number']}</span>
                        {p['Type of batch'] && (
                          <Badge variant="secondary" className="font-normal text-xs">
                            {p['Type of batch']}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatRegistrationDate(p['Registration Time'])}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        />
      </GlassCard>
    </div>
  );
}
