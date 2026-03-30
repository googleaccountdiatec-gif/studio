"use client"

import { Badge } from "@/components/ui/badge"
import { FileText, Shield, ArrowRightLeft, AlertTriangle, GraduationCap, Package } from "lucide-react"
import { cn } from "@/lib/utils"

const domainConfig = {
  capa: { icon: Shield, label: 'CAPA', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  'change-action': { icon: ArrowRightLeft, label: 'CMID', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  document: { icon: FileText, label: 'DOC', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' },
  nc: { icon: AlertTriangle, label: 'NC', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
  training: { icon: GraduationCap, label: 'Training', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200' },
  batch: { icon: Package, label: 'Batch', color: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200' },
}

interface CrossLinkBadgeProps {
  domain: keyof typeof domainConfig
  id: string
  label?: string
  onClick: () => void
}

export function CrossLinkBadge({ domain, id, label, onClick }: CrossLinkBadgeProps) {
  const config = domainConfig[domain]
  const Icon = config.icon

  return (
    <Badge
      variant="outline"
      className={cn(
        "cursor-pointer hover:opacity-80 transition-opacity gap-1 py-1",
        config.color
      )}
      onClick={onClick}
    >
      <Icon className="w-3 h-3" />
      {label ?? `${config.label}-${id}`}
    </Badge>
  )
}
