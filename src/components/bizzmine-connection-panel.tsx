"use client";

import React, { useState } from 'react';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import { CheckCircle2, XCircle, Loader2, Server } from 'lucide-react';
import { cn } from '@/lib/utils';

type HealthState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'ok'; version: string; checkedAt: string }
  | { kind: 'error'; message: string };

export function BizzmineConnectionPanel() {
  const [state, setState] = useState<HealthState>({ kind: 'idle' });

  const test = async () => {
    setState({ kind: 'checking' });
    try {
      const r = await fetch('/api/bizzmine/health');
      const data = await r.json();
      if (data.ok) {
        setState({
          kind: 'ok',
          version: data.version,
          checkedAt: data.checkedAt,
        });
      } else {
        setState({
          kind: 'error',
          message: data.message ?? 'Unknown error',
        });
      }
    } catch (e) {
      setState({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Network error',
      });
    }
  };

  return (
    <GlassCard className="w-full max-w-2xl p-8 z-10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-6 w-6" />
          BizzMine Connection
        </CardTitle>
        <CardDescription>
          Verify the server can reach the BizzMine REST API.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <Button onClick={test} disabled={state.kind === 'checking'}>
            {state.kind === 'checking' && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Test Connection
          </Button>
          {state.kind === 'ok' && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>Connected — BizzMine v{state.version}</span>
            </div>
          )}
          {state.kind === 'error' && (
            <div className="flex items-center gap-2 text-sm">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className={cn('text-red-600')}>{state.message}</span>
            </div>
          )}
        </div>
      </CardContent>
    </GlassCard>
  );
}
