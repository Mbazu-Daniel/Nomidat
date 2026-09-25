export type TablePaginationProps = {
  page: number;
  count: number;
  loading: boolean;
  hasNext: boolean;
  onPageChange: (page: number) => void;
};
