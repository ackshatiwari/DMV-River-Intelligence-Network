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
};

const defaultPalette = ["#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6"];

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
};

function MetricChartCard({ dataKey, label, description, unit, color, data, latestValue }: MetricChartCardProps) {
  return (
    <div className="group rounded-2xl border border-slate-700/70 bg-slate-900/60 p-4 shadow-lg shadow-slate-950/30 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-slate-500/70 hover:shadow-xl hover:shadow-slate-900/50">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-slate-300">{label}</h3>
          {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-semibold tabular-nums text-slate-50">{formatValue(latestValue)}</span>
          {unit ? <span className="text-sm text-slate-400">{unit}</span> : null}
        </div>
      </div>

      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.15)" strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              tickFormatter={formatTimestamp}
              minTickGap={40}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={{ stroke: "rgba(148, 163, 184, 0.25)" }}
              tickLine={{ stroke: "rgba(148, 163, 184, 0.25)" }}
            />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={{ stroke: "rgba(148, 163, 184, 0.25)" }}
              tickLine={{ stroke: "rgba(148, 163, 184, 0.25)" }}
              width={48}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(15, 23, 42, 0.96)",
                border: "1px solid rgba(148, 163, 184, 0.25)",
                borderRadius: 12,
                color: "#e2e8f0",
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

export default function RiverDataChart({ data, metrics, title = "River Monitoring" }: RiverDataChartProps) {
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
    <section className="rounded-2xl border border-slate-700/70 bg-slate-950/70 p-4 shadow-2xl shadow-slate-950/40 backdrop-blur md:p-6">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="mt-2 text-xl font-semibold text-slate-50 md:text-2xl">{title}</h2>
          <p className="mt-1 text-sm text-slate-300">Toggle the metrics below to compare river conditions over time.</p>
        </div>
        <div className="text-sm text-slate-400">{chartData.length} observations</div>
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
                  ? "border-transparent bg-slate-100 text-slate-950 shadow-sm"
                  : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500 hover:text-slate-50"
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
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-700/70 bg-slate-900/40 p-8 text-center text-sm text-slate-400">
          Select at least one metric above to display its chart.
        </div>
      )}
    </section>
  );
}
