"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

interface DrillDownDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  onExportCsv?: () => void
  children: React.ReactNode
}

export function DrillDownDialog({
  open,
  onOpenChange,
  title,
  onExportCsv,
  children,
}: DrillDownDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle>{title}</DialogTitle>
            {onExportCsv && (
              <Button variant="outline" size="sm" onClick={onExportCsv}>
                <Download className="w-4 h-4 mr-1" />
                Export CSV
              </Button>
            )}
          </div>
        </DialogHeader>
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 pb-4">
            {children}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
