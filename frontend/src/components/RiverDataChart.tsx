"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
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

      <div className="h-[360px] w-full rounded-2xl bg-slate-900/60 p-2 sm:h-[420px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.2)" strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              tickFormatter={formatTimestamp}
              minTickGap={32}
              tick={{ fill: "#cbd5e1", fontSize: 12 }}
              axisLine={{ stroke: "rgba(148, 163, 184, 0.35)" }}
              tickLine={{ stroke: "rgba(148, 163, 184, 0.35)" }}
            />
            <YAxis
              tick={{ fill: "#cbd5e1", fontSize: 12 }}
              axisLine={{ stroke: "rgba(148, 163, 184, 0.35)" }}
              tickLine={{ stroke: "rgba(148, 163, 184, 0.35)" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(15, 23, 42, 0.96)",
                border: "1px solid rgba(148, 163, 184, 0.25)",
                borderRadius: 16,
                color: "#e2e8f0",
              }}
              labelFormatter={(label) => formatTimestamp(String(label))}
            />
            <Legend />
            {metricStyles
              .filter((metric) => visibleMetrics.includes(metric.key))
              .map((metric) => (
                <Line
                  key={metric.key}
                  type="monotone"
                  dataKey={metric.key}
                  name={`${metric.label}${metric.unit ? ` (${metric.unit})` : ""}`}
                  stroke={metric.color}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}