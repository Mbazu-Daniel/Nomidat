import { BadRequestException } from "@nestjs/common";

export type ReportRange = {
  from: Date;
  to: Date;
};

const DEFAULT_DAYS = 30;
const MAX_DAYS = 366;

export function defaultReportRange(): ReportRange {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - DEFAULT_DAYS);
  return { from, to };
}

export function parseReportRange(from?: string, to?: string): ReportRange {
  const fallback = defaultReportRange();
  const fromDate = from ? parseDate(from, "from") : fallback.from;
  const toDate = to ? parseDate(to, "to") : fallback.to;
  validateRange(fromDate, toDate);
  return { from: fromDate, to: toDate };
}

function validateRange(from: Date, to: Date) {
  if (from >= to) {
    throw new BadRequestException("Report 'from' must be before 'to'.");
  }
  const days = (to.getTime() - from.getTime()) / 86_400_000;
  if (days > MAX_DAYS) {
    throw new BadRequestException(`Report range cannot exceed ${MAX_DAYS} days.`);
  }
}

function parseDate(value: string, name: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Invalid report ${name} date.`);
  }
  return date;
}
