"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { X, CalendarIcon } from "lucide-react"

export interface FilterConfig {
  key: string
  label: string
  type: 'select' | 'multi-select' | 'search' | 'toggle' | 'date-range'
  options?: { label: string; value: string }[]
}

interface FilterBarProps {
  filters: FilterConfig[]
  values: Record<string, any>
  onChange: (key: string, value: any) => void
  onReset: () => void
}

export function FilterBar({ filters, values, onChange, onReset }: FilterBarProps) {
  const hasActiveFilters = filters.some(f => {
    const v = values[f.key]
    if (f.type === 'toggle') return v === true
    if (f.type === 'multi-select') return Array.isArray(v) && v.length > 0
    if (f.type === 'search') return typeof v === 'string' && v.length > 0
    if (f.type === 'select') return v && v !== 'all'
    return false
  })

  return (
    <div className="flex flex-wrap items-end gap-3">
      {filters.map(filter => (
        <div key={filter.key} className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{filter.label}</Label>

          {filter.type === 'select' && filter.options && (
            <Select
              value={values[filter.key] ?? 'all'}
              onValueChange={v => onChange(filter.key, v)}
            >
              <SelectTrigger className="h-8 w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {filter.options.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {filter.type === 'multi-select' && filter.options && (
            <div className="flex flex-wrap gap-1">
              {filter.options.map(opt => {
                const selected = (values[filter.key] as string[] ?? []).includes(opt.value)
                return (
                  <Badge
                    key={opt.value}
                    variant={selected ? "default" : "outline"}
                    className="cursor-pointer text-xs"
                    onClick={() => {
                      const current = (values[filter.key] as string[]) ?? []
                      const next = selected
                        ? current.filter(v => v !== opt.value)
                        : [...current, opt.value]
                      onChange(filter.key, next)
                    }}
                  >
                    {opt.label}
                  </Badge>
                )
              })}
            </div>
          )}

          {filter.type === 'search' && (
            <Input
              className="h-8 w-[160px]"
              placeholder={`Search ${filter.label.toLowerCase()}...`}
              value={values[filter.key] ?? ''}
              onChange={e => onChange(filter.key, e.target.value)}
            />
          )}

          {filter.type === 'toggle' && (
            <Switch
              checked={values[filter.key] ?? false}
              onCheckedChange={v => onChange(filter.key, v)}
            />
          )}

          {filter.type === 'date-range' && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-8 w-[200px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {values[filter.key]?.from
                    ? `${values[filter.key].from.toLocaleDateString()} - ${values[filter.key].to?.toLocaleDateString() ?? '...'}`
                    : 'Pick date range'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={values[filter.key]}
                  onSelect={(range: any) => onChange(filter.key, range)}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
      ))}

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onReset} className="h-8">
          <X className="w-3 h-3 mr-1" />
          Reset
        </Button>
      )}
    </div>
  )
}
