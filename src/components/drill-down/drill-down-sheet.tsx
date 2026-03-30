"use client"

import * as React from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ChevronLeft, ChevronRight, Download, GitCompare } from "lucide-react"

export interface Breadcrumb {
  label: string
  onClick: () => void
}

interface DrillDownSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  breadcrumbs?: Breadcrumb[]
  onExportCsv?: () => void
  onCompare?: () => void
  compareActive?: boolean
  children: React.ReactNode
}

export function DrillDownSheet({
  open,
  onOpenChange,
  title,
  breadcrumbs = [],
  onExportCsv,
  onCompare,
  compareActive = false,
  children,
}: DrillDownSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:w-[85vw] md:w-[75vw] lg:w-[60vw] sm:max-w-none p-0 flex flex-col"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-6 pt-6 pb-3 flex-shrink-0">
            {/* Breadcrumbs */}
            {breadcrumbs.length > 0 && (
              <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                {breadcrumbs.map((crumb, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <ChevronRight className="w-3 h-3" />}
                    <button
                      onClick={crumb.onClick}
                      className="hover:text-foreground transition-colors underline-offset-4 hover:underline"
                    >
                      {crumb.label}
                    </button>
                  </React.Fragment>
                ))}
                <ChevronRight className="w-3 h-3" />
                <span className="text-foreground font-medium">{title}</span>
              </nav>
            )}

            {/* Title bar */}
            <div className="flex items-center justify-between">
              <SheetHeader className="p-0">
                <SheetTitle className="text-xl">{title}</SheetTitle>
              </SheetHeader>

              <div className="flex items-center gap-2">
                {onCompare && (
                  <Button
                    variant={compareActive ? "default" : "outline"}
                    size="sm"
                    onClick={onCompare}
                  >
                    <GitCompare className="w-4 h-4 mr-1" />
                    Compare
                  </Button>
                )}
                {onExportCsv && (
                  <Button variant="outline" size="sm" onClick={onExportCsv}>
                    <Download className="w-4 h-4 mr-1" />
                    Export CSV
                  </Button>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Scrollable content */}
          <ScrollArea className="flex-1 px-6 py-4">
            <div className="space-y-6 pb-6">
              {children}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  )
}
