'use client';

import * as React from 'react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { cn } from "@/lib/utils"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';

interface CapaChartProps {
  data: { name: string; [key: string]: any }[];
  title: string;
  dataKey: string;
  onBarClick?: (name: string) => void;
  className?: string;
}

export function CapaChart({ data, title, dataKey, onBarClick, className }: CapaChartProps) {
  const chartConfig = {
    [dataKey]: {
      label: dataKey.charAt(0).toUpperCase() + dataKey.slice(1),
      color: 'hsl(var(--primary))',
    },
  } satisfies ChartConfig;

  return (
    <div className={cn("w-full h-full flex flex-col", className)}>
       {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
        <ChartContainer config={chartConfig} className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              accessibilityLayer
              data={data}
              onClick={(e) => e && onBarClick && onBarClick(e.activeLabel as string)}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <XAxis
                dataKey="name"
                stroke="hsl(var(--foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="hsl(var(--foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}`}
                allowDecimals={false}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dot" />}
              />
              <Bar
                dataKey={dataKey}
                fill={`var(--color-${dataKey})`}
                radius={[4, 4, 0, 0]}
                cursor={onBarClick ? 'pointer' : 'default'}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
    </div>
  );
}
