import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DataTablePaginationProps {
  totalItems: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

export default function DataTablePagination({
  totalItems,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
}: DataTablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers with ellipses
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (currentPage > 3) {
        pages.push("...");
      }
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) {
        pages.push("...");
      }
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
      {/* Items summary */}
      <div className="flex items-center gap-2 font-medium">
        <span>
          Showing <span className="font-semibold text-foreground">{startItem}</span> to{" "}
          <span className="font-semibold text-foreground">{endItem}</span> of{" "}
          <span className="font-semibold text-foreground">{totalItems}</span> entries
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {/* Page size selector: 10, 25, 50 */}
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Show:</span>
          <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
            {pageSizeOptions.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => {
                  onPageSizeChange(size);
                  onPageChange(1); // Reset to page 1 on page size change
                }}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  pageSize === size
                    ? "bg-brand-deep text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* Page navigation: 1, 2, 3, 4, 5... */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="h-8 w-8 rounded-lg border-border"
            title="Previous Page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-1">
            {getPageNumbers().map((p, idx) =>
              p === "..." ? (
                <span key={`ellipsis-${idx}`} className="px-1.5 text-muted-foreground font-bold">
                  …
                </span>
              ) : (
                <button
                  key={`page-${p}`}
                  type="button"
                  onClick={() => onPageChange(Number(p))}
                  className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-semibold transition-colors ${
                    currentPage === p
                      ? "bg-brand-deep text-white shadow-xs"
                      : "border border-border bg-card text-foreground hover:bg-muted"
                  }`}
                >
                  {p}
                </button>
              )
            )}
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="h-8 w-8 rounded-lg border-border"
            title="Next Page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
