"use client";

import React, { useState, useMemo } from 'react';
import { useData } from '@/contexts/data-context';
import { GlassCard } from '@/components/ui/glass-card';
import { parse, isValid, getMonth, getYear, getQuarter, format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface BatchReleaseData {
  'Batch number': string;
  'Final batch status': string;
  'Completed On': string;
  'High-risk nonconformance': string;
  'Low-risk nonconformances': string;
  'Type of production': string;
  'Clone name': string;
  'Company': string;
  'Company aliases': string;
}

interface ProcessedBatch {
  id: string;
  status: string;
  completedDate: Date;
  highRiskNC: number;
  lowRiskNC: number;
  productionType: string;
  cloneName: string;
  company: string;
  aliases: string;
}

const DATE_FORMATS = [
  'dd/MM/yyyy hh:mm a',
  'dd/MM/yyyy HH:mm',
  'dd/MM/yyyy',
  'M/d/yyyy'
];

const parseDate = (dateString: string): Date => {
  if (!dateString) return new Date('invalid');
  for (const fmt of DATE_FORMATS) {
    const parsed = parse(dateString.trim(), fmt, new Date());
    if (isValid(parsed)) return parsed;
  }
  const isoParsed = new Date(dateString);
  if (isValid(isoParsed)) return isoParsed;
  return new Date('invalid');
};

export default function BatchReleaseDashboard() {
  const { batchReleaseData } = useData();
  
  // Filters
  const [prodTypeFilter, setProdTypeFilter] = useState<string>('all');
  const [cloneFilter, setCloneFilter] = useState<string>('');
  const [customerFilter, setCustomerFilter] = useState<string>('');
  const [quarterFilter, setQuarterFilter] = useState<string>('all');

  const processedData = useMemo(() => {
    return batchReleaseData
      .filter(row => row['Final batch status'] === 'Approved')
      .map(row => ({
        id: row['Batch number'],
        status: row['Final batch status'],
        completedDate: parseDate(row['Completed On']),
        highRiskNC: parseInt(row['High-risk nonconformance'] || '0', 10) || 0,
        lowRiskNC: parseInt(row['Low-risk nonconformances'] || '0', 10) || 0,
        productionType: row['Type of production'] || 'Unknown',
        cloneName: row['Clone name'] || '',
        company: row['Company'] || '',
        aliases: row['Company aliases'] || ''
      }))
      .filter(item => isValid(item.completedDate));
  }, [batchReleaseData]);

  const productionTypes = useMemo(() => {
    const types = new Set(processedData.map(item => item.productionType));
    return Array.from(types).sort();
  }, [processedData]);

  const filteredData = useMemo(() => {
    return processedData.filter(item => {
      const matchesType = prodTypeFilter === 'all' || item.productionType === prodTypeFilter;
      const matchesClone = cloneFilter === '' || item.cloneName.toLowerCase().includes(cloneFilter.toLowerCase());
      const matchesCustomer = customerFilter === '' || 
                              item.company.toLowerCase().includes(customerFilter.toLowerCase()) ||
                              item.aliases.toLowerCase().includes(customerFilter.toLowerCase());
      
      return matchesType && matchesClone && matchesCustomer;
    });
  }, [processedData, prodTypeFilter, cloneFilter, customerFilter]);

  // Extract unique active clones and customers for display
  const activeFilters = useMemo(() => {
    const clones = new Set<string>();
    const customers = new Set<string>();

    filteredData.forEach(item => {
        if (item.cloneName) clones.add(item.cloneName);
        if (item.company) customers.add(item.company);
    });

    return {
        clones: Array.from(clones).sort(),
        customers: Array.from(customers).sort()
    };
  }, [filteredData]);


  // --- Visualization 1: Monthly Approved Batches (YoY) ---
  const monthlyChartData = useMemo(() => {
    if (filteredData.length === 0) return { data: [], currentYear: new Date().getFullYear(), previousYear: new Date().getFullYear() - 1 };

    // Determine "Current Year" from the data, not the calendar
    const years = filteredData.map(d => getYear(d.completedDate));
    const currentYear = Math.max(...years);
    const previousYear = currentYear - 1;

    const months = Array.from({ length: 12 }, (_, i) => {
      const date = new Date(currentYear, i, 1);
      return {
        name: format(date, 'MMM'),
        monthIndex: i,
        current: 0,
        previous: 0
      };
    });

    filteredData.forEach(item => {
      const year = getYear(item.completedDate);
      const month = getMonth(item.completedDate);
      
      if (year === currentYear) {
        months[month].current++;
      } else if (year === previousYear) {
        months[month].previous++;
      }
    });

    return { data: months, currentYear, previousYear };
  }, [filteredData]);

  // --- KPI Metrics: Average Non-Conformances ---
  const kpiMetrics = useMemo(() => {
    const targetQuarter = quarterFilter === 'all' ? null : parseInt(quarterFilter);
    
    const metricsData = filteredData.filter(item => {
      if (targetQuarter === null) return true;
      return getQuarter(item.completedDate) === targetQuarter;
    });

    const totalBatches = metricsData.length;
    if (totalBatches === 0) return { low: 0, high: 0, total: 0 };

    const totalLow = metricsData.reduce((sum, item) => sum + item.lowRiskNC, 0);
    const totalHigh = metricsData.reduce((sum, item) => sum + item.highRiskNC, 0);

    return {
      low: (totalLow / totalBatches).toFixed(2),
      high: (totalHigh / totalBatches).toFixed(2),
      total: ((totalLow + totalHigh) / totalBatches).toFixed(2)
    };
  }, [filteredData, quarterFilter]);


  if (batchReleaseData.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center text-center py-20 px-4 rounded-lg border-2 border-dashed border-muted-foreground/30">
            <FileUp className="h-16 w-16 text-muted-foreground mb-4"/>
            <h2 className="text-2xl font-semibold mb-2">Upload Batch Release Data</h2>
            <p className="text-muted-foreground mb-6 max-w-md">Use the uploader in the header to import your "Batch Release KPI.csv" file.</p>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <GlassCard className="p-4">
        <div className="grid gap-4 md:grid-cols-4 items-end">
            <div className="space-y-2">
                <Label>Production Type</Label>
                <Select value={prodTypeFilter} onValueChange={setProdTypeFilter}>
                    <SelectTrigger>
                        <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        {productionTypes.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label>Clone Name</Label>
                <Input 
                    placeholder="Search clone..." 
                    value={cloneFilter}
                    onChange={(e) => setCloneFilter(e.target.value)}
                />
            </div>
            <div className="space-y-2">
                <Label>Customer</Label>
                <Input 
                    placeholder="Search company..." 
                    value={customerFilter}
                    onChange={(e) => setCustomerFilter(e.target.value)}
                />
            </div>
             <div className="space-y-2">
                <Label>Quarter (for KPIs)</Label>
                <Select value={quarterFilter} onValueChange={setQuarterFilter}>
                    <SelectTrigger>
                        <SelectValue placeholder="All Year" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Year</SelectItem>
                        <SelectItem value="1">Q1</SelectItem>
                        <SelectItem value="2">Q2</SelectItem>
                        <SelectItem value="3">Q3</SelectItem>
                        <SelectItem value="4">Q4</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
      </GlassCard>

      {/* Active Filter Display */}
      {(cloneFilter || customerFilter) && (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
                {activeFilters.clones.length > 0 && (
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Clones:</span>
                        {activeFilters.clones.slice(0, 10).map(clone => (
                            <Badge key={clone} variant="secondary">{clone}</Badge>
                        ))}
                        {activeFilters.clones.length > 10 && <span className="text-xs text-muted-foreground">+{activeFilters.clones.length - 10} more</span>}
                    </div>
                )}
            </div>
            <div className="flex flex-wrap gap-2">
                {activeFilters.customers.length > 0 && (
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Customers:</span>
                        {activeFilters.customers.slice(0, 10).map(customer => (
                            <Badge key={customer} variant="outline">{customer}</Badge>
                        ))}
                        {activeFilters.customers.length > 10 && <span className="text-xs text-muted-foreground">+{activeFilters.customers.length - 10} more</span>}
                    </div>
                )}
            </div>
        </div>
      )}

      {/* Visualizations */}
      <div className="grid gap-6 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2 p-6">
            <h3 className="text-lg font-semibold mb-4">Monthly Approved Batches (YoY)</h3>
            <ResponsiveContainer width="100%" height={350}>
                <BarChart data={monthlyChartData.data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', backdropFilter: 'blur(4px)', border: '1px solid hsl(var(--border))' }} />
                    <Legend />
                    <Bar dataKey="previous" name={`${monthlyChartData.previousYear}`} fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="current" name={`${monthlyChartData.currentYear}`} fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </GlassCard>

        {/* Consolidated KPI Card */}
        <GlassCard className="p-6 flex flex-col justify-center">
            <h3 className="text-lg font-semibold mb-6">Average Non-Conformances</h3>
            <div className="space-y-6">
                <div className="flex justify-between items-center border-b pb-4 border-border/50">
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-muted-foreground">Low Risk</span>
                        <span className="text-xs text-muted-foreground">Per batch</span>
                    </div>
                    <span className="text-3xl font-bold text-emerald-500">{kpiMetrics.low}</span>
                </div>
                <div className="flex justify-between items-center border-b pb-4 border-border/50">
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-muted-foreground">High Risk</span>
                        <span className="text-xs text-muted-foreground">Per batch</span>
                    </div>
                    <span className="text-3xl font-bold text-rose-500">{kpiMetrics.high}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">Total Average</span>
                        <span className="text-xs text-muted-foreground">Per batch</span>
                    </div>
                    <span className="text-4xl font-bold text-primary">{kpiMetrics.total}</span>
                </div>
            </div>
        </GlassCard>
      </div>
    </div>
  );
}
