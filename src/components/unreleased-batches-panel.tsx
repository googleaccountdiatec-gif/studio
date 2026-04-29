"use client";

import React, { useMemo, useState } from 'react';
import { useData } from '@/contexts/data-context';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ListTodo, AlertTriangle, GitBranch } from 'lucide-react';
import { format, isValid, parseISO } from 'date-fns';
import { ExpandableDataTable, SummaryBar } from '@/components/drill-down';
import type { ExpandableColumn } from '@/components/drill-down';
import { cn } from '@/lib/utils';
import {
  getReleasedBatchNumbers,
  getDownstreamNotReleased,
  daysSince,
} from '@/lib/batch-registry/filter';

interface UnreleasedRow {
  id: string;
  batchNumber: string;
  typeOfBatch: string;
  projectNumber: string;
  productName: string;
  cloneName: string;
  registrationTime: string;
  daysOld: number | null;
  previousBatches: Array<{
    'Batch number': string;
    'Type of batch': string;
    'Registration Time': string;
  }>;
}

function formatRegistrationDate(iso: string): string {
  if (!iso) return '—';
  const d = parseISO(iso);
  return isValid(d) ? format(d, 'yyyy-MM-dd') : '—';
}

/** Pure count helper — useful for the parent's button label. */
export function useUnreleasedFinalBatchesCount(): number {
  const { batchRegistryData, batchReleaseData } = useData();
  const releasedSet = useMemo(
    () => getReleasedBatchNumbers(batchReleaseData),
    [batchReleaseData],
  );
  return useMemo(
    () => getDownstreamNotReleased(batchRegistryData, releasedSet).length,
    [batchRegistryData, releasedSet],
  );
}

/**
 * Body of the "Unreleased Final Batches" drill-down sheet. Owns its
 * search state but otherwise reads everything from DataContext. Keep
 * presentational — no page-level wrappers, no empty state (the parent
 * decides whether to render this at all).
 */
export function UnreleasedBatchesPanel() {
  const { batchRegistryData, batchReleaseData } = useData();
  const [search, setSearch] = useState('');

  const releasedSet = useMemo(
    () => getReleasedBatchNumbers(batchReleaseData),
    [batchReleaseData],
  );

  const downstreamNotReleased = useMemo(
    () => getDownstreamNotReleased(batchRegistryData, releasedSet),
    [batchRegistryData, releasedSet],
  );

  const totals = useMemo(() => {
    const downstream = batchRegistryData.filter((r) => r['Is Upstream'] === false).length;
    const upstream = batchRegistryData.filter((r) => r['Is Upstream'] === true).length;
    const released = downstream - downstreamNotReleased.length;
    return {
      pending: downstreamNotReleased.length,
      released,
      downstream,
      upstream,
    };
  }, [batchRegistryData, downstreamNotReleased]);

  const rows: UnreleasedRow[] = useMemo(() => {
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
        registrationTime: (r['Registration Time'] as string) || '',
        daysOld: daysSince(r['Registration Time']),
        previousBatches: previous as UnreleasedRow['previousBatches'],
      };
    });
  }, [downstreamNotReleased]);

  const filteredRows = useMemo(() => {
    if (search.trim() === '') return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.batchNumber.toLowerCase().includes(q) ||
        r.projectNumber.toLowerCase().includes(q) ||
        r.productName.toLowerCase().includes(q) ||
        r.cloneName.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const columns: ExpandableColumn<UnreleasedRow>[] = [
    { key: 'batchNumber', header: 'Batch #', sortable: true },
    { key: 'typeOfBatch', header: 'Type', sortable: true },
    {
      key: 'projectNumber',
      header: 'Project #',
      sortable: true,
      cell: (r) => r.projectNumber || <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'productName',
      header: 'Product',
      sortable: true,
      cell: (r) => r.productName || <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'daysOld',
      header: 'Days old',
      sortable: true,
      cell: (r) =>
        r.daysOld === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span
            className={cn(
              r.daysOld > 90 && 'text-red-600 dark:text-red-400 font-medium',
              r.daysOld > 60 && r.daysOld <= 90 && 'text-amber-600 dark:text-amber-400 font-medium',
            )}
          >
            {r.daysOld}
          </span>
        ),
    },
  ];

  if (batchRegistryData.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        No batch registry data loaded yet. Run a sync to populate.
      </div>
    );
  }

  return (
    <>
      <SummaryBar
        metrics={[
          {
            label: 'Awaiting release',
            value: totals.pending,
            color: totals.pending > 0 ? 'warning' : 'success',
            icon: AlertTriangle,
          },
          { label: 'Downstream released', value: totals.released, icon: GitBranch },
          { label: 'Total downstream', value: totals.downstream, icon: GitBranch },
          { label: 'Upstream registered', value: totals.upstream, icon: ListTodo },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-2 items-end">
        <div className="space-y-2">
          <Label>Search</Label>
          <Input
            placeholder="Batch #, project, product, clone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="text-sm text-muted-foreground">
          Showing {filteredRows.length} of {rows.length} downstream batches awaiting release
          (oldest first).
        </div>
      </div>

      <ExpandableDataTable<UnreleasedRow>
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
                <p className="text-muted-foreground italic">No previous batches recorded.</p>
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
    </>
  );
}
