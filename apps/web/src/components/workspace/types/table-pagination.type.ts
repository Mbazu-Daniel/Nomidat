export type TablePaginationProps = {
  page: number;
  /** Rows on this page, not the total across all pages. */
  count: number;
  loading: boolean;
  hasNext: boolean;
  /** Rows the API was asked for, so the "shown from–to" range is honest. */
  pageSize: number;
  onPageChange: (page: number) => void;
};
