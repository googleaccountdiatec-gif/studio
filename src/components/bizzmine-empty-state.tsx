"use client";

import React from 'react';
import { useData } from '@/contexts/data-context';
import { Button } from '@/components/ui/button';
import { Database, RefreshCw } from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';

interface Props {
  /** Optional title — defaults to a generic message. */
  title?: string;
  /** Optional description override. */
  description?: string;
}

export function BizzmineEmptyState({
  title = 'No data loaded yet',
  description = 'Click Sync Now to fetch the latest data from BizzMine. This may take 10–30 seconds on the first sync.',
}: Props) {
  const { sync, syncStatus } = useData();

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <GlassCard className="max-w-md w-full p-8 text-center">
        <Database className="h-12 w-12 mx-auto text-primary mb-4" />
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-6">{description}</p>
        <Button
          onClick={sync}
          disabled={syncStatus === 'syncing'}
          className="gap-2"
        >
          <RefreshCw
            className={`h-4 w-4 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`}
          />
          {syncStatus === 'syncing' ? 'Syncing…' : 'Sync Now'}
        </Button>
      </GlassCard>
    </div>
  );
}
