import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import type { TablePaginationProps } from "./types/table-pagination.type";
import "./table-pagination.css";

/**
 * Paging, with the count stated honestly.
 *
 * "50 records shown" is what the page holds, not how many exist. When a next page
 * exists, saying so is the difference between a seller who knows there are more
 * customers and one who assumes the list is complete — which matters most for
 * exactly the list that gets truncated: contacts and stock.
 */
export function TablePagination({
  page,
  count,
  loading,
  hasNext,
  pageSize,
  onPageChange,
}: TablePaginationProps) {
  const from = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = from + count - 1;

  return (
    <footer className="workspace-table-footer table-pagination">
      <span className="table-pagination-summary" aria-live="polite">
        {count === 0 ? (
          "No records on this page"
        ) : (
          <>
            <strong>
              {from}–{to}
            </strong>{" "}
            shown
          </>
        )}
        {hasNext && <span className="table-pagination-more">· more available</span>}
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
