import type { ReportCardProps } from "./types/reports.type";
export function ReportCard({ title, subtitle, children, className = "" }: ReportCardProps) {
  return (
    <section className={`workspace-card report-card ${className}`}>
      <header>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </header>
      {children}
    </section>
  );
}
