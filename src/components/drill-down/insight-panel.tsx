"use client"

import { cn } from "@/lib/utils"

interface InsightPanelProps {
  children: React.ReactNode
  columns?: 1 | 2
  className?: string
}

export function InsightPanel({ children, columns = 2, className }: InsightPanelProps) {
  return (
    <div
      className={cn(
        "grid gap-4",
        columns === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1",
        className
      )}
    >
      {children}
    </div>
  )
}

interface InsightCardProps {
  title: string
  children: React.ReactNode
  className?: string
}

export function InsightCard({ title, children, className }: InsightCardProps) {
  return (
    <div className={cn("rounded-lg border bg-card p-4", className)}>
      <h4 className="text-sm font-medium text-muted-foreground mb-3">{title}</h4>
      {children}
    </div>
  )
}
