"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";


export type RiverMetric = {
  key: string;
  label: string;
  description?: string;
  unit?: string;
  color?: string;
  /**
   * Per-metric plot height, overriding the chart-wide `chartHeight`. This is what
   * lets ONE card hold a tall primary row and a shorter secondary row -- the grid
   * sizes each row to its contents, so the two secondary metrics landing in row 2
   * make that row shorter without needing a second card or a second toggler.
   */
  chartHeight?: number;
};


type RiverDataRecord = Record<string, Record<string, string | number | null | undefined>>;

type RiverChartRow = {
  time: string;
  [key: string]: string | number | null;
};

type RiverDataChartProps = {
  data: RiverDataRecord | null | undefined;
  metrics: RiverMetric[];
  title?: string;
  /** Default plot height in px, for metrics that don't set their own. */
  chartHeight?: number;
};

const defaultPalette = ["#477C79", "#142B3B", "#59666C"];

function toChartRows(data: RiverDataRecord | null | undefined, metrics: RiverMetric[]): RiverChartRow[] {
  if (!data) {
    return [];
  }

  const timeEntries = Object.entries(data.time ?? {});

  return timeEntries.map(([index, time]) => {
    const row: RiverChartRow = {
      time: String(time ?? ""),
    };

    metrics.forEach((metric) => {
      const value = data[metric.key]?.[index];
      row[metric.key] =
        typeof value === "number" ? value : value === null || value === undefined || value === "" ? null : Number(value);
    });

    return row;
  });
}

function formatTimestamp(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// this function formats a number to two decimal places, or returns "—" if the value is null, undefined, or NaN
function formatValue(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  return parseFloat(value.toFixed(2)).toString();
}

// this function returns the latest non-null value for a given metric key from the chart rows
function getLatestValue(rows: RiverChartRow[], key: string): number | null {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const value = rows[i][key];
    if (typeof value === "number" && !Number.isNaN(value)) {
      return value;
    }
  }

  return null;
}
// this type defines the props for the MetricChartCard component, which displays a line chart for a specific river metric
type MetricChartCardProps = {
  dataKey: string;
  label: string;
  description?: string;
  unit?: string;
  color: string;
  data: RiverChartRow[];
  latestValue: number | null;
  chartHeight: number;
};

function MetricChartCard({ dataKey, label, description, unit, color, data, latestValue, chartHeight }: MetricChartCardProps) {
  return (
    <div className="group rounded-2xl border border-line bg-page p-4 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-accent-soft">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-ink">{label}</h3>
          {description ? <p className="mt-0.5 text-xs text-ink-muted">{description}</p> : null}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-semibold tabular-nums text-ink">{formatValue(latestValue)}</span>
          {unit ? <span className="text-sm text-ink-muted">{unit}</span> : null}
        </div>
      </div>

      <div className="w-full" style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#D9DED8" strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              tickFormatter={formatTimestamp}
              minTickGap={40}
              tick={{ fill: "#59666C", fontSize: 11 }}
              axisLine={{ stroke: "#D9DED8" }}
              tickLine={{ stroke: "#D9DED8" }}
            />
            <YAxis
              tick={{ fill: "#59666C", fontSize: 11 }}
              axisLine={{ stroke: "#D9DED8" }}
              tickLine={{ stroke: "#D9DED8" }}
              width={48}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#F5F4EF",
                border: "1px solid #D9DED8",
                borderRadius: 12,
                color: "#142B3B",
              }}
              labelFormatter={(value) => formatTimestamp(String(value))}
              formatter={(value) => [`${formatValue(Number(value))}${unit ? ` ${unit}` : ""}`, label]}
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              name={label}
              stroke={color}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5 }}
              animationDuration={500}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function RiverDataChart({ data, metrics, title = "River Monitoring", chartHeight = 220 }: RiverDataChartProps) {
  const [visibleMetrics, setVisibleMetrics] = useState<string[]>(() => metrics.map((metric) => metric.key));

  const chartData = useMemo(() => toChartRows(data, metrics), [data, metrics]);

  const metricStyles = useMemo(
    () =>
      metrics.map((metric, index) => ({
        ...metric,
        color: metric.color ?? defaultPalette[index % defaultPalette.length],
      })),
    [metrics],
  );

  const toggleMetric = (metricKey: string) => {
    setVisibleMetrics((current) =>
      current.includes(metricKey) ? current.filter((key) => key !== metricKey) : [...current, metricKey],
    );
  };

  const visibleMetricStyles = metricStyles.filter((metric) => visibleMetrics.includes(metric.key));

  return (
    <section className="rounded-2xl border border-line bg-panel p-4 md:p-6">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="mt-2 text-xl font-semibold text-ink md:text-2xl">{title}</h2>
          <p className="mt-1 text-sm text-ink-muted">Toggle the metrics below to compare river conditions over time.</p>
        </div>
        <div className="text-sm text-ink-muted">{chartData.length} observations</div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {metricStyles.map((metric) => {
          const active = visibleMetrics.includes(metric.key);

          return (
            <button
              key={metric.key}
              type="button"
              onClick={() => toggleMetric(metric.key)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? "border-transparent bg-page text-ink"
                  : "border-line bg-panel text-ink-muted hover:border-accent hover:text-ink"
              }`}
              style={active ? { boxShadow: `0 0 0 1px ${metric.color} inset` } : undefined}
            >
              <span className="text-base leading-none" aria-hidden="true">
                {active ? "✓" : "+"}
              </span>
              {metric.label}
            </button>
          );
        })}
      </div>

      {visibleMetricStyles.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {visibleMetricStyles.map((metric) => (
            <MetricChartCard
              key={metric.key}
              dataKey={metric.key}
              label={metric.label}
              description={metric.description}
              unit={metric.unit}
              color={metric.color}
              data={chartData}
              latestValue={getLatestValue(chartData, metric.key)}
              chartHeight={metric.chartHeight ?? chartHeight}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-line bg-page p-8 text-center text-sm text-ink-muted">
          Select at least one metric above to display its chart.
        </div>
      )}
    </section>
  );
}
