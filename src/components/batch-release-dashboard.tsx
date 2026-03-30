"use client";

import React, { useState, useMemo } from 'react';
import { useData } from '@/contexts/data-context';
import { GlassCard } from '@/components/ui/glass-card';
import { parse, isValid, getMonth, getYear, format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, LabelList } from 'recharts';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { FileUp, CalendarIcon, ListTodo, AlertTriangle, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CapaChart } from './capa-chart';
import { cn } from '@/lib/utils';
import { DrillDownSheet, SummaryBar, ExpandableDataTable } from '@/components/drill-down';
import type { ExpandableColumn } from '@/components/drill-down';
import { exportToCsv } from '@/lib/csv-export';

interface BatchReleaseData {
  'Batch number': string;
  'Batch number from list'?: string;
  'Project Number'?: string;
  'Product number'?: string;
  'Product Name'?: string;
  'Final batch status': string;
  'Clone name': string;
  'High-risk nonconformance': string;
  'Low-risk nonconformances': string;
  'Type of Production': string;
  'Company': string;
  'Company aliases': string;
  'Completed On': string;
  canonicalBatchNumber?: string;
  [key: string]: any;
}

interface ProcessedBatch {
  id: string;
  canonicalBatchNumber: string;
  batchNumber: string;
  batchNumberFromList: string;
  projectNumber: string;
  productNumber: string;
  productName: string;
  status: string;
  completedDate: Date;
  highRiskNC: number;
  lowRiskNC: number;
  productionType: string;
  cloneName: string;
  company: string;
  aliases: string;
  completedOn: string;
  raw: BatchReleaseData;
}

const DATE_FORMATS = [
  'dd/MM/yyyy hh:mm a',
  'dd/MM/yyyy HH:mm',
  'dd/MM/yyyy',
  'dd MMM yyyy HH:mm',
  'dd MMM yyyy',
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

  // Year Selection State (Default to Current & Previous Year)
  const currentRealYear = new Date().getFullYear();
  const [selectedYears, setSelectedYears] = useState<number[]>([currentRealYear, currentRealYear - 1]);

  // Drill-down state
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [navigationLevel, setNavigationLevel] = useState<'list' | 'detail'>('list');

  const processedData: ProcessedBatch[] = useMemo(() => {
    return batchReleaseData
      .filter(row => row['Final batch status'] === 'Approved')
      .map((item: any) => {
        const canonical = (item['Batch number from list'] && item['Batch number from list'].trim() !== '')
          ? item['Batch number from list']
          : item['Batch number'];
        const completedDate = parseDate(item['Completed On']);
        return {
          id: canonical || item['Batch number'],
          canonicalBatchNumber: canonical,
          batchNumber: item['Batch number'] || '',
          batchNumberFromList: item['Batch number from list'] || '',
          projectNumber: item['Project Number'] || '',
          productNumber: item['Product number'] || '',
          productName: item['Product Name'] || '',
          status: item['Final batch status'],
          completedDate,
          highRiskNC: parseInt(item['High-risk nonconformance'] || '0', 10) || 0,
          lowRiskNC: parseInt(item['Low-risk nonconformances'] || '0', 10) || 0,
          productionType: item['Type of production'] || item['Type of Production'] || 'Unknown',
          cloneName: item['Clone name'] || '',
          company: item['Company'] || '',
          aliases: item['Company aliases'] || '',
          completedOn: item['Completed On'] || '',
          raw: item,
        } as ProcessedBatch;
      })
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

  // Available years in the dataset + Current Year (always include current year)
  const availableYears = useMemo(() => {
    const years = new Set(filteredData.map(item => getYear(item.completedDate)));
    years.add(currentRealYear);
    return Array.from(years).sort((a, b) => b - a);
  }, [filteredData, currentRealYear]);

  // Active Filters Display
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


  // --- Visualization 1: Monthly Approved Batches ---
  const monthlyChartData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const date = new Date(currentRealYear, i, 1);
      const entry: any = {
        name: format(date, 'MMM'),
        monthIndex: i,
      };

      // Initialize counts for all selected years
      selectedYears.forEach(y => {
          entry[y] = 0;
      });

      return entry;
    });

    filteredData.forEach(item => {
      const year = getYear(item.completedDate);
      // Only aggregate if the year is currently selected
      if (selectedYears.includes(year)) {
          const month = getMonth(item.completedDate);
          months[month][year]++;
      }
    });

    return months;
  }, [filteredData, selectedYears, currentRealYear]);

  // --- KPI Metrics: Average Non-Conformances ---
  const kpiMetrics = useMemo(() => {
    const metricsData = filteredData.filter(item => {
        const year = getYear(item.completedDate);
        return selectedYears.includes(year);
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
  }, [filteredData, selectedYears]);

  // --- Product Chart Data ---
  const productChartData = useMemo(() => {
    const productCounts: { [key: string]: number } = {};
    filteredData.forEach(item => {
      const year = getYear(item.completedDate);
      if (selectedYears.includes(year)) {
        const name = item.productName || 'Unknown';
        productCounts[name] = (productCounts[name] || 0) + 1;
      }
    });
    return Object.entries(productCounts)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [filteredData, selectedYears]);

  // Filtered data for selected years (used in main table and drill-downs)
  const yearFilteredData = useMemo(() => {
    return filteredData.filter(item => {
      const year = getYear(item.completedDate);
      return selectedYears.includes(year);
    });
  }, [filteredData, selectedYears]);

  // --- Product drill-down data ---
  const productRecords = useMemo(() => {
    if (!selectedProduct) return [];
    return yearFilteredData.filter(item => (item.productName || 'Unknown') === selectedProduct);
  }, [yearFilteredData, selectedProduct]);

  const productSummary = useMemo(() => {
    const total = productRecords.length;
    if (total === 0) return { total: 0, avgNC: '0', highRiskCount: 0 };
    const totalNC = productRecords.reduce((s, b) => s + b.lowRiskNC + b.highRiskNC, 0);
    const highRiskCount = productRecords.filter(b => b.highRiskNC > 0).length;
    return { total, avgNC: (totalNC / total).toFixed(2), highRiskCount };
  }, [productRecords]);

  // Selected batch for detail view (product sheet)
  const selectedBatchFromProduct = useMemo(() => {
    if (!selectedBatchId) return null;
    return productRecords.find(b => b.id === selectedBatchId) ?? null;
  }, [productRecords, selectedBatchId]);

  // --- Month drill-down data ---
  const monthRecords = useMemo(() => {
    if (!selectedMonth) return [];
    // selectedMonth is the short month name like "Jan", "Feb", etc.
    const monthIndex = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(selectedMonth);
    if (monthIndex === -1) return [];
    return yearFilteredData.filter(item => getMonth(item.completedDate) === monthIndex);
  }, [yearFilteredData, selectedMonth]);

  const monthSummary = useMemo(() => {
    const total = monthRecords.length;
    if (total === 0) return { total: 0, avgNC: '0', highRiskCount: 0 };
    const totalNC = monthRecords.reduce((s, b) => s + b.lowRiskNC + b.highRiskNC, 0);
    const highRiskCount = monthRecords.filter(b => b.highRiskNC > 0).length;
    return { total, avgNC: (totalNC / total).toFixed(2), highRiskCount };
  }, [monthRecords]);

  // Selected batch for detail view (month sheet)
  const selectedBatchFromMonth = useMemo(() => {
    if (!selectedBatchId) return null;
    return monthRecords.find(b => b.id === selectedBatchId) ?? null;
  }, [monthRecords, selectedBatchId]);

  // ExpandableDataTable columns for batch data
  const batchColumns: ExpandableColumn<ProcessedBatch>[] = [
    { key: 'canonicalBatchNumber', header: 'Batch #', sortable: true },
    { key: 'productName', header: 'Product Name', sortable: true },
    { key: 'cloneName', header: 'Clone', sortable: true },
    {
      key: 'lowRiskNC',
      header: 'Low NC',
      sortable: true,
      cell: (row) => <span className={cn(row.lowRiskNC > 0 && "text-amber-600 dark:text-amber-400 font-medium")}>{row.lowRiskNC}</span>
    },
    {
      key: 'highRiskNC',
      header: 'High NC',
      sortable: true,
      cell: (row) => <span className={cn(row.highRiskNC > 0 && "text-red-600 dark:text-red-400 font-medium")}>{row.highRiskNC}</span>
    },
    { key: 'company', header: 'Customer', sortable: true },
  ];

  // Render batch detail view (reused in product and month sheets)
  const renderBatchDetail = (batch: ProcessedBatch) => (
    <>
      <div>
        <h3 className="text-lg font-semibold">Batch {batch.canonicalBatchNumber}</h3>
        <p className="text-sm text-muted-foreground">{batch.productName}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{batch.productionType}</Badge>
        {batch.highRiskNC > 0 && <Badge variant="destructive">High Risk NC: {batch.highRiskNC}</Badge>}
        {batch.lowRiskNC > 0 && <Badge className="bg-amber-400 hover:bg-amber-500 text-black">Low Risk NC: {batch.lowRiskNC}</Badge>}
        {batch.highRiskNC === 0 && batch.lowRiskNC === 0 && <Badge className="bg-green-500 hover:bg-green-600 text-white border-transparent">No NCs</Badge>}
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-lg border p-4">
        <div>
          <p className="text-xs text-muted-foreground">Canonical Batch #</p>
          <p className="text-sm font-medium">{batch.canonicalBatchNumber || 'N/A'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Legacy Batch #</p>
          <p className="text-sm font-medium">{batch.batchNumber || 'N/A'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Project Number</p>
          <p className="text-sm font-medium">{batch.projectNumber || 'N/A'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Product Number</p>
          <p className="text-sm font-medium">{batch.productNumber || 'N/A'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Product Name</p>
          <p className="text-sm font-medium">{batch.productName || 'N/A'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Clone</p>
          <p className="text-sm font-medium">{batch.cloneName || 'N/A'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Customer</p>
          <p className="text-sm font-medium">{batch.company || 'N/A'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Production Type</p>
          <p className="text-sm font-medium">{batch.productionType || 'N/A'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Low Risk NCs</p>
          <p className="text-sm font-medium">{batch.lowRiskNC}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">High Risk NCs</p>
          <p className="text-sm font-medium">{batch.highRiskNC}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Completed On</p>
          <p className="text-sm font-medium">{batch.completedOn || 'N/A'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Status</p>
          <p className="text-sm font-medium">{batch.status}</p>
        </div>
      </div>
    </>
  );


  if (batchReleaseData.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center text-center py-20 px-4 rounded-lg border-2 border-dashed border-muted-foreground/30">
            <FileUp className="h-16 w-16 text-muted-foreground mb-4"/>
            <h2 className="text-2xl font-semibold mb-2">Upload Batch Release Data</h2>
            <p className="text-muted-foreground mb-6 max-w-md">Use the uploader in the header to import your "Batch Release KPI.csv" file.</p>
        </div>
    );
  }

  // Helper to get chart bars based on selected years
  const getChartBars = () => {
      // Sort selected years to keep bar order consistent
      const sortedYears = [...selectedYears].sort((a, b) => a - b);

      return sortedYears.map((year, index) => (
          <Bar
            key={year}
            dataKey={year}
            name={`${year}`}
            fill={`hsl(var(--chart-${(index % 5) + 1}))`}
            radius={[4, 4, 0, 0]}
          >
              <LabelList dataKey={year} position="top" fill="hsl(var(--foreground))" fontSize={10} formatter={(value: any) => value > 0 ? value : ''} />
          </Bar>
      ));
  };

  const toggleYear = (year: number) => {
    setSelectedYears(prev =>
        prev.includes(year)
            ? prev.filter(y => y !== year)
            : [...prev, year]
    );
  };

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
                <Label>Years</Label>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {selectedYears.length > 0
                                ? `${selectedYears.length} year${selectedYears.length !== 1 ? 's' : ''} selected`
                                : "Select years"}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2" align="start">
                        <div className="space-y-2">
                            <h4 className="font-medium leading-none text-sm mb-2 text-muted-foreground px-2">Select years to compare</h4>
                            <div className="grid gap-2">
                                {availableYears.map(year => (
                                    <div key={year} className="flex items-center space-x-2 px-2 py-1 rounded hover:bg-muted/50">
                                        <Checkbox
                                            id={`year-${year}`}
                                            checked={selectedYears.includes(year)}
                                            onCheckedChange={() => toggleYear(year)}
                                        />
                                        <Label htmlFor={`year-${year}`} className="flex-1 cursor-pointer">{year}</Label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
        </div>
      </GlassCard>

      {/* Active Filter Display */}
      {(cloneFilter || customerFilter || selectedYears.length > 0) && (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-2 items-center">
                 <span className="text-sm text-muted-foreground mr-2">Active Filters:</span>
                 {selectedYears.length > 0 && (
                     <div className="flex items-center gap-1">
                        {selectedYears.sort().map(year => (
                            <Badge key={year} variant="secondary" className="px-2">{year}</Badge>
                        ))}
                     </div>
                 )}
            </div>
            {(activeFilters.clones.length > 0 || activeFilters.customers.length > 0) && (
                <div className="flex flex-wrap gap-4 mt-2">
                    {activeFilters.clones.length > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Clones:</span>
                            {activeFilters.clones.slice(0, 15).map(clone => (
                                <Badge key={clone} variant="secondary">{clone}</Badge>
                            ))}
                            {activeFilters.clones.length > 15 && <span className="text-xs text-muted-foreground">+{activeFilters.clones.length - 15} more</span>}
                        </div>
                    )}
                    {activeFilters.customers.length > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Customers:</span>
                            {activeFilters.customers.slice(0, 15).map(customer => (
                                <Badge key={customer} variant="outline">{customer}</Badge>
                            ))}
                            {activeFilters.customers.length > 15 && <span className="text-xs text-muted-foreground">+{activeFilters.customers.length - 15} more</span>}
                        </div>
                    )}
                </div>
            )}
        </div>
      )}

      {/* Visualizations */}
      <div className="grid gap-6 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2 p-6">
            <h3 className="text-lg font-semibold mb-4">Monthly Approved Batches</h3>
            <ResponsiveContainer width="100%" height={350}>
                <BarChart
                  data={monthlyChartData}
                  margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
                  onClick={(e) => {
                    if (e && e.activeLabel) {
                      setSelectedMonth(e.activeLabel as string);
                      setSelectedBatchId(null);
                      setNavigationLevel('list');
                    }
                  }}
                >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', backdropFilter: 'blur(4px)', border: '1px solid hsl(var(--border))' }} />
                    <Legend />
                    {getChartBars()}
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

      {/* Batches by Product Chart */}
      {productChartData.length > 0 && (
        <GlassCard className="p-6">
          <div className="h-[250px] w-full">
            <CapaChart
              data={productChartData}
              title="Batches by Product"
              dataKey="total"
              onBarClick={(name) => {
                setSelectedProduct(name);
                setSelectedBatchId(null);
                setNavigationLevel('list');
              }}
            />
          </div>
        </GlassCard>
      )}

      {/* Main Data Table */}
      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold mb-4">Batch Release Data</h3>
        <ExpandableDataTable<ProcessedBatch>
          columns={batchColumns}
          data={yearFilteredData}
          getRowId={(row) => row.id}
          getRowClassName={(row) => cn(row.highRiskNC > 0 && "bg-destructive/10")}
          onRowClick={(row) => {
            // Open the product sheet for this batch's product, then navigate to detail
            setSelectedProduct(row.productName || 'Unknown');
            setSelectedBatchId(row.id);
            setNavigationLevel('detail');
          }}
          expandedContent={(row) => (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div>
                <span className="font-medium text-muted-foreground">Batch # (Legacy): </span>
                {row.batchNumber || 'N/A'}
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Batch # (List): </span>
                {row.batchNumberFromList || 'N/A'}
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Project Number: </span>
                {row.projectNumber || 'N/A'}
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Production Type: </span>
                {row.productionType}
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Completed On: </span>
                {row.completedOn || 'N/A'}
              </div>
            </div>
          )}
        />
      </GlassCard>

      {/* Product Drill-Down Sheet */}
      <DrillDownSheet
        open={!!selectedProduct}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedProduct(null);
            setSelectedBatchId(null);
            setNavigationLevel('list');
          }
        }}
        title={
          navigationLevel === 'detail' && selectedBatchFromProduct
            ? `Batch ${selectedBatchFromProduct.canonicalBatchNumber}`
            : `Product: ${selectedProduct}`
        }
        breadcrumbs={
          navigationLevel === 'detail'
            ? [{ label: `${selectedProduct}`, onClick: () => { setSelectedBatchId(null); setNavigationLevel('list'); } }]
            : []
        }
        onExportCsv={() => {
          exportToCsv(
            productRecords.map(r => r.raw),
            [
              { key: 'Batch number from list', header: 'Batch #' },
              { key: 'Product Name', header: 'Product' },
              { key: 'Clone name', header: 'Clone' },
              { key: 'Low-risk nonconformances', header: 'Low Risk NC' },
              { key: 'High-risk nonconformance', header: 'High Risk NC' },
              { key: 'Company', header: 'Customer' },
              { key: 'Type of Production', header: 'Production Type' },
              { key: 'Completed On', header: 'Completed On' },
            ],
            `batch-product-${selectedProduct?.replace(/\s+/g, '-').toLowerCase() ?? 'export'}.csv`
          );
        }}
      >
        {navigationLevel === 'list' ? (
          <>
            <SummaryBar
              metrics={[
                { label: 'Total Batches', value: productSummary.total, icon: ListTodo },
                { label: 'Avg NCs', value: productSummary.avgNC, icon: BarChart3 },
                { label: 'High Risk Batches', value: productSummary.highRiskCount, color: productSummary.highRiskCount > 0 ? 'danger' : 'default', icon: AlertTriangle },
              ]}
            />

            <ExpandableDataTable<ProcessedBatch>
              columns={batchColumns}
              data={productRecords}
              getRowId={(row) => row.id}
              getRowClassName={(row) => cn(row.highRiskNC > 0 && "bg-destructive/10")}
              onRowClick={(row) => {
                setSelectedBatchId(row.id);
                setNavigationLevel('detail');
              }}
              expandedContent={(row) => (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="font-medium text-muted-foreground">Batch # (Legacy): </span>
                    {row.batchNumber || 'N/A'}
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Project Number: </span>
                    {row.projectNumber || 'N/A'}
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Production Type: </span>
                    {row.productionType}
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Completed On: </span>
                    {row.completedOn || 'N/A'}
                  </div>
                </div>
              )}
            />
          </>
        ) : selectedBatchFromProduct ? (
          renderBatchDetail(selectedBatchFromProduct)
        ) : null}
      </DrillDownSheet>

      {/* Month Drill-Down Sheet */}
      <DrillDownSheet
        open={!!selectedMonth}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedMonth(null);
            setSelectedBatchId(null);
            setNavigationLevel('list');
          }
        }}
        title={
          navigationLevel === 'detail' && selectedBatchFromMonth
            ? `Batch ${selectedBatchFromMonth.canonicalBatchNumber}`
            : `Batches in ${selectedMonth}`
        }
        breadcrumbs={
          navigationLevel === 'detail'
            ? [{ label: `${selectedMonth} Batches`, onClick: () => { setSelectedBatchId(null); setNavigationLevel('list'); } }]
            : []
        }
        onExportCsv={() => {
          exportToCsv(
            monthRecords.map(r => r.raw),
            [
              { key: 'Batch number from list', header: 'Batch #' },
              { key: 'Product Name', header: 'Product' },
              { key: 'Clone name', header: 'Clone' },
              { key: 'Low-risk nonconformances', header: 'Low Risk NC' },
              { key: 'High-risk nonconformance', header: 'High Risk NC' },
              { key: 'Company', header: 'Customer' },
              { key: 'Type of Production', header: 'Production Type' },
              { key: 'Completed On', header: 'Completed On' },
            ],
            `batch-month-${selectedMonth?.toLowerCase() ?? 'export'}.csv`
          );
        }}
      >
        {navigationLevel === 'list' ? (
          <>
            <SummaryBar
              metrics={[
                { label: 'Total Batches', value: monthSummary.total, icon: ListTodo },
                { label: 'Avg NCs', value: monthSummary.avgNC, icon: BarChart3 },
                { label: 'High Risk Batches', value: monthSummary.highRiskCount, color: monthSummary.highRiskCount > 0 ? 'danger' : 'default', icon: AlertTriangle },
              ]}
            />

            <ExpandableDataTable<ProcessedBatch>
              columns={batchColumns}
              data={monthRecords}
              getRowId={(row) => row.id}
              getRowClassName={(row) => cn(row.highRiskNC > 0 && "bg-destructive/10")}
              onRowClick={(row) => {
                setSelectedBatchId(row.id);
                setNavigationLevel('detail');
              }}
              expandedContent={(row) => (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="font-medium text-muted-foreground">Batch # (Legacy): </span>
                    {row.batchNumber || 'N/A'}
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Project Number: </span>
                    {row.projectNumber || 'N/A'}
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Production Type: </span>
                    {row.productionType}
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Completed On: </span>
                    {row.completedOn || 'N/A'}
                  </div>
                </div>
              )}
            />
          </>
        ) : selectedBatchFromMonth ? (
          renderBatchDetail(selectedBatchFromMonth)
        ) : null}
      </DrillDownSheet>
    </div>
  );
}
