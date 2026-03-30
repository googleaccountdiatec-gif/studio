"use client"

import { type LucideIcon, ArrowUp, ArrowDown, Minus } from "lucide-react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export interface SummaryMetric {
  label: string
  value: string | number
  color?: 'default' | 'success' | 'warning' | 'danger'
  icon?: LucideIcon
  trend?: { value: number; label: string }
}

interface SummaryBarProps {
  metrics: SummaryMetric[]
}

const colorMap = {
  default: 'text-foreground',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-red-600 dark:text-red-400',
}

export function SummaryBar({ metrics }: SummaryBarProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {metrics.map((metric, i) => (
        <Card key={i} className="p-3">
          <div className="flex items-center gap-2">
            {metric.icon && (
              <metric.icon className="w-4 h-4 text-muted-foreground" />
            )}
            <p className="text-xs text-muted-foreground font-medium">{metric.label}</p>
          </div>
          <p className={cn("text-2xl font-bold mt-1", colorMap[metric.color ?? 'default'])}>
            {metric.value}
          </p>
          {metric.trend && (
            <div className="flex items-center gap-1 mt-1">
              {metric.trend.value > 0 ? (
                <ArrowUp className="w-3 h-3 text-red-500" />
              ) : metric.trend.value < 0 ? (
                <ArrowDown className="w-3 h-3 text-emerald-500" />
              ) : (
                <Minus className="w-3 h-3 text-muted-foreground" />
              )}
              <span className="text-xs text-muted-foreground">{metric.trend.label}</span>
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}
