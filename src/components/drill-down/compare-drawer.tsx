"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface CompareField {
  key: string
  label: string
}

interface CompareDrawerProps<T extends Record<string, any>> {
  items: T[]
  fields: CompareField[]
  getItemLabel: (item: T) => string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CompareDrawer<T extends Record<string, any>>({
  items,
  fields,
  getItemLabel,
  open,
  onOpenChange,
}: CompareDrawerProps<T>) {
  if (items.length < 2) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Comparing {items.length} items</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium text-muted-foreground w-[200px]">Field</th>
                  {items.map((item, i) => (
                    <th key={i} className="text-left p-2 font-medium min-w-[200px]">
                      {getItemLabel(item)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fields.map(field => {
                  const values = items.map(item => String(item[field.key] ?? ''))
                  const allSame = values.every(v => v === values[0])
                  return (
                    <tr key={field.key} className="border-b">
                      <td className="p-2 font-medium text-muted-foreground">{field.label}</td>
                      {values.map((val, i) => (
                        <td
                          key={i}
                          className={cn(
                            "p-2 whitespace-pre-wrap",
                            !allSame && "bg-amber-50 dark:bg-amber-950/20"
                          )}
                        >
                          {val || <span className="text-muted-foreground italic">Empty</span>}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
