"use client";

import React, { useEffect, useState } from 'react';
import { useData } from '@/contexts/data-context';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

function formatRelative(date: Date | null): string {
  if (!date) return 'never';
  const ms = Date.now() - date.getTime();
  if (ms < 0) return 'just now';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export function SyncNowButton() {
  const { sync, syncStatus, syncError, lastSyncedAt } = useData();
  const { toast } = useToast();
  const [, setTick] = useState(0);

  // Keep the relative-time indicator fresh
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (syncStatus === 'error' && syncError) {
      toast({
        variant: 'destructive',
        title: 'Sync failed',
        description: syncError,
      });
    }
  }, [syncStatus, syncError, toast]);

  const onClick = async () => {
    await sync();
  };

  return (
    <div className="flex items-center gap-3 ml-auto">
      <span className="text-xs text-muted-foreground hidden sm:inline">
        Last sync:{' '}
        <span className="font-medium text-foreground">
          {formatRelative(lastSyncedAt)}
        </span>
      </span>
      <Button
        onClick={onClick}
        disabled={syncStatus === 'syncing'}
        size="sm"
        className="gap-2"
      >
        {syncStatus === 'syncing' && (
          <RefreshCw className="h-4 w-4 animate-spin" />
        )}
        {syncStatus === 'idle' && lastSyncedAt && (
          <CheckCircle2 className="h-4 w-4" />
        )}
        {syncStatus === 'idle' && !lastSyncedAt && (
          <RefreshCw className="h-4 w-4" />
        )}
        {syncStatus === 'error' && (
          <AlertTriangle className="h-4 w-4 text-destructive" />
        )}
        <span className={cn(syncStatus === 'syncing' && 'animate-pulse')}>
          {syncStatus === 'syncing' ? 'Syncing…' : 'Sync Now'}
        </span>
      </Button>
    </div>
  );
}
