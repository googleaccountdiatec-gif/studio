"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CapaData } from "@/lib/types";
import { Badge } from "./ui/badge";
import { format, isValid } from "date-fns";

interface CapaDataTableProps {
  data: CapaData[];
  columnVisibility: Record<string, boolean>;
}

const PAGE_SIZE = 10;

export function CapaDataTable({ data, columnVisibility }: CapaDataTableProps) {
  const [currentPage, setCurrentPage] = React.useState(0);
  const totalPages = Math.ceil(data.length / PAGE_SIZE);
  const paginatedData = data.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE
  );

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages - 1));
  };

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 0));
  };
  
  React.useEffect(() => {
    setCurrentPage(0);
  }, [data]);

  const headers = [
    { key: 'CAPA ID', label: 'CAPA ID', visible: true },
    { key: 'Tittle', label: 'Title', visible: columnVisibility['Tittle'] },
    { key: 'effectiveDueDate', label: 'Effective Due Date', visible: true },
    { key: 'Assigned To', label: 'Assigned To', visible: columnVisibility['Assigned To'] },
    { key: 'Pending Steps', label: 'Pending Steps', visible: columnVisibility['Pending Steps'] },
    { key: 'status', label: 'Status', visible: true },
  ];

  const visibleHeaders = headers.filter(h => h.visible);

  return (
    <div className="w-full">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {visibleHeaders.map(header => <TableHead key={header.key}>{header.label}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length > 0 ? (
              paginatedData.map((item, index) => (
                <TableRow
                  key={item['CAPA ID'] || index}
                  className={cn(item.isOverdue && "bg-accent/20 hover:bg-accent/30")}
                >
                  {visibleHeaders.map(header => (
                    <TableCell key={`${item['CAPA ID']}-${header.key}`} className="py-3">
                      {header.key === 'CAPA ID' && item['CAPA ID']}
                      {header.key === 'Tittle' && <span className="font-medium">{item['Tittle']}</span>}
                      {header.key === 'effectiveDueDate' && (item.effectiveDueDate && isValid(item.effectiveDueDate) ? format(item.effectiveDueDate!, 'PPP') : 'Invalid Date')}
                      {header.key === 'Assigned To' && item['Assigned To']}
                      {header.key === 'Pending Steps' && <Badge variant="secondary">{item['Pending Steps']}</Badge>}
                      {header.key === 'status' && (item.isOverdue 
                          ? <Badge variant="destructive" className="bg-accent text-accent-foreground hover:bg-accent/80">Overdue</Badge> 
                          : <Badge className="bg-green-500 hover:bg-green-600 text-white border-transparent">On Time</Badge>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={visibleHeaders.length}
                  className="h-24 text-center"
                >
                  No CAPAs to display.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between space-x-2 py-4">
        <span className="text-sm text-muted-foreground">
            Page {totalPages > 0 ? currentPage + 1 : 0} of {totalPages > 0 ? totalPages : 0}
        </span>
        <div className="space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevPage}
              disabled={currentPage === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={currentPage >= totalPages - 1}
            >
              Next
            </Button>
        </div>
      </div>
    </div>
  );
}
