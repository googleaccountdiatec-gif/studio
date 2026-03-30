"use client"

import * as React from "react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface DetailSectionProps {
  title: string
  content: string | undefined | null
  emptyText?: string
  collapsible?: boolean
  defaultOpen?: boolean
}

export function DetailSection({
  title,
  content,
  emptyText = "Not provided",
  collapsible = true,
  defaultOpen = true,
}: DetailSectionProps) {
  const isEmpty = !content || content.trim() === '' || content.trim().toLowerCase() === 'na'
  const [open, setOpen] = React.useState(isEmpty ? false : defaultOpen)

  if (collapsible) {
    return (
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full rounded-lg border p-3 hover:bg-muted/50 transition-colors">
          <h4 className="text-sm font-medium">{title}</h4>
          <ChevronDown
            className={cn(
              "w-4 h-4 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="rounded-b-lg border border-t-0 p-4 bg-muted/20">
            <p className={cn(
              "text-sm whitespace-pre-wrap",
              isEmpty && "text-muted-foreground italic"
            )}>
              {isEmpty ? emptyText : content}
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    )
  }

  return (
    <div className="rounded-lg border p-4">
      <h4 className="text-sm font-medium mb-2">{title}</h4>
      <p className={cn(
        "text-sm whitespace-pre-wrap",
        isEmpty && "text-muted-foreground italic"
      )}>
        {isEmpty ? emptyText : content}
      </p>
    </div>
  )
}
