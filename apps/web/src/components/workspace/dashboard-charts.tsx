import { useCurrency } from "@/lib/currency-context";
import { formatMoney } from "@/lib/money";

/**
 * Dashboard charts, drawn by hand in SVG.
 *
 * The project carries no charting library, and this keeps it that way: an area
 * chart and a ring are a few lines of geometry, and a dependency would be the
 * largest thing in the bundle for two shapes.
 *
 * Every value shown is a real recorded figure. Nothing here interpolates,
 * smooths, or pads a series, so a flat line means the business was flat rather
 * than the chart hiding a gap.
 */

/** Sales over the period as an area chart. */
export function SalesTrendChart({ points }: { points: { date: string; salesMinor: number }[] }) {
  const currency = useCurrency();
  if (points.length === 0) {
    return (
      <p className="flex min-h-32 items-center justify-center text-center text-sm text-muted-foreground">
        Sales will appear here once you record a sale.
      </p>
    );
  }

  const width = 520;
  const height = 180;
  // Inset so the stroke on the first and last point is not clipped by the edge.
  const pad = 6;
  const max = Math.max(1, ...points.map((point) => point.salesMinor));

  const x = (index: number) =>
    points.length === 1 ? width / 2 : pad + (index / (points.length - 1)) * (width - pad * 2);
  const y = (value: number) => height - pad - (value / max) * (height - pad * 2);

  const coords = points.map((point, index) => [x(index), y(point.salesMinor)] as const);
  const line = coords.map(([px, py]) => `${px},${py}`).join(" ");
  // Built from the coordinates rather than by rewriting the line string: a
  // separator replace would also hit a space inside a coordinate if the number
  // formatting ever changed.
  const area =
    `M${coords[0][0]},${height} ` +
    coords.map(([px, py]) => `L${px},${py}`).join(" ") +
    ` L${coords[coords.length - 1][0]},${height} Z`;

  const first = points[0];
  const last = points[points.length - 1];
  const change =
    first.salesMinor > 0 ? ((last.salesMinor - first.salesMinor) / first.salesMinor) * 100 : null;

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex items-baseline gap-2.5">
        <span className="font-display text-xl font-semibold tabular-nums">
          {formatMoney(last.salesMinor, currency)}
        </span>
        <span className="text-xs text-muted-foreground">
          {change === null
            ? "Most recent day"
            : `${change >= 0 ? "+" : ""}${change.toFixed(0)}% vs ${new Date(
                first.date,
              ).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}`}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        // preserveAspectRatio="none" stretches the SVG to fill, which would
        // distort the stroke, so the line carries vectorEffect to keep it 2px.
        className="h-44 w-full overflow-visible"
        role="img"
        aria-label={`Daily sales for ${points.length} days, peaking at ${formatMoney(max, currency)}`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="dashTrendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#dashTrendFill)" />
        <polyline
          points={line}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="flex justify-between text-[0.6875rem] text-muted-foreground">
        <span>
          {new Date(first.date).toLocaleDateString("en-NG", {
            day: "numeric",
            month: "short",
          })}
        </span>
        <span>
          {new Date(last.date).toLocaleDateString("en-NG", {
            day: "numeric",
            month: "short",
          })}
        </span>
      </div>
    </figure>
  );
}

/** Share of sales by product, as a ring with a legend. */
export function SalesCategoryRing({
  rows,
}: {
  rows: { productName: string; salesMinor: number }[];
}) {
  const currency = useCurrency();
  const top = rows.slice(0, 5);
  const total = top.reduce((sum, row) => sum + row.salesMinor, 0);

  if (total <= 0) {
    return (
      <p className="flex min-h-32 items-center justify-center text-center text-sm text-muted-foreground">
        Product sales will break down here once you sell something.
      </p>
    );
  }

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  // Each slice starts where the previous one ended, so the offset is a running
  // total of the dashes drawn so far rather than a sum recomputed per slice.
  let consumed = 0;
  const slices = top.map((row, index) => {
    const dash = (row.salesMinor / total) * circumference;
    // Colours come from the chart ramp in the token layer, so the ring and the
    // legend swatch read the same variable and cannot drift apart.
    const colour = `var(--chart-${index + 1})`;
    const slice = { name: row.productName, index, dash, offset: -consumed, colour };
    consumed += dash;
    return slice;
  });

  return (
    <figure className="flex flex-col gap-4">
      <svg
        viewBox="0 0 140 140"
        className="w-full max-w-44 self-center"
        role="img"
        aria-label="Sales by product"
      >
        <circle cx="70" cy="70" r={radius} className="fill-none stroke-muted" strokeWidth={18} />
        {slices.map((slice) => (
          <circle
            key={slice.name}
            cx="70"
            cy="70"
            r={radius}
            className="fill-none transition-opacity hover:opacity-80"
            style={{
              stroke: slice.colour,
              strokeWidth: 18,
              // Rotated so the first slice starts at twelve o'clock, not three.
              transform: "rotate(-90deg)",
              transformOrigin: "70px 70px",
              strokeDasharray: `${slice.dash} ${circumference - slice.dash}`,
              strokeDashoffset: slice.offset,
            }}
          />
        ))}
        <text
          x="70"
          y="66"
          className="fill-foreground text-[0.9375rem] font-semibold"
          textAnchor="middle"
        >
          {formatMoney(total, currency)}
        </text>
        <text x="70" y="82" className="fill-muted-foreground text-[0.625rem]" textAnchor="middle">
          top {top.length}
        </text>
      </svg>
      <ul className="flex flex-col gap-2">
        {/* Driven off the same slices as the ring, so a swatch can never end up
            beside the wrong colour. */}
        {slices.map((slice) => (
          <li
            key={slice.name}
            className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground"
          >
            <span
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ background: slice.colour }}
              aria-hidden="true"
            />
            <span className="flex-1 truncate">{slice.name}</span>
            <strong className="text-foreground">
              {Math.round((slice.dash / circumference) * 100)}%
            </strong>
          </li>
        ))}
      </ul>
    </figure>
  );
}
