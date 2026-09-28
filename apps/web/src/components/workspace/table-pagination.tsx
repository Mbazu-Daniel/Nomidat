import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import type { TablePaginationProps } from "./types/table-pagination.type";
import "./table-pagination.css";

export function TablePagination({
  page,
  count,
  loading,
  hasNext,
  onPageChange,
}: TablePaginationProps) {
  return (
    <footer className="workspace-table-footer table-pagination">
      <span className="table-pagination-summary" aria-live="polite">
        <strong>{count}</strong> {count === 1 ? "record" : "records"} shown
        <span className="table-pagination-currency">NGN</span>
      </span>
      <nav className="table-pagination-controls" aria-label="Table pagination">
        <button
          type="button"
          className="table-page-button"
          aria-label="Previous page"
          disabled={loading || page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          <IconChevronLeft size={16} aria-hidden="true" />
          <span>Previous</span>
        </button>
        <span className="table-page-current" aria-current="page" aria-label={`Page ${page}`}>
          <span>Page</span>
          <strong>{page}</strong>
        </span>
        <button
          type="button"
          className="table-page-button"
          aria-label="Next page"
          disabled={loading || !hasNext}
          onClick={() => onPageChange(page + 1)}
        >
          <span>Next</span>
          <IconChevronRight size={16} aria-hidden="true" />
        </button>
      </nav>
    </footer>
  );
}
