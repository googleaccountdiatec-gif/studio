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
import { cn } from "@/lib/utils"

export interface DataTableColumn<T> {
  accessorKey: keyof T | string;
  header: string;
  cell: (row: T) => React.ReactNode;
  visible?: boolean;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowClassName?: (row: T) => string;
}

const PAGE_SIZE = 10;

export function DataTable<T>({ columns, data, getRowClassName }: DataTableProps<T>) {
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
  
  const visibleColumns = columns.filter(c => c.visible !== false);

  return (
    <div className="w-full">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {visibleColumns.map((column) => (
                <TableHead key={String(column.accessorKey)}>{column.header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length > 0 ? (
              paginatedData.map((row, index) => (
                <TableRow key={index} className={getRowClassName ? getRowClassName(row) : ""}>
                  {visibleColumns.map((column) => (
                    <TableCell key={String(column.accessorKey)}>
                      {column.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={visibleColumns.length}
                  className="h-24 text-center"
                >
                  No results.
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
