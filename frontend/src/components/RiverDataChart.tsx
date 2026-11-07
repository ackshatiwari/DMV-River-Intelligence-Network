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


export type UnitOption = {
  unit: string;
  /** Converts a value from the API's native unit into this one. */
  convert: (value: number) => number;
};

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
  /**
   * Display units the viewer can switch between; the first is the default. With
   * two or more, the card shows a unit toggle and converts the headline, line,
   * axis, and tooltip together. Display-only -- the API data is never changed.
   */
  unitOptions?: UnitOption[];
};


type RiverDataRecord = Record<string, Record<string, string | number | null | undefined>>;

type RiverChartRow = {
  time: string;
  [key: string]: string | number | null;
};

/**
 * A time-range switch for the primary card (see `primaryMetricKeys`). The first
 * option is the default view and is drawn from the chart's main `data`; the
 * others come from `data` here, which the page fetches when one is first selected.
 */
export type RangeControl = {
  options: string[];
  selected: string;
  onSelect: (range: string) => void;
  /** Series for `selected` when it isn't the default; null while loading or failed. */
  data: RiverDataRecord | null;
  error: string | null;
};

type RiverDataChartProps = {
  data: RiverDataRecord | null | undefined;
  metrics: RiverMetric[];
  title?: string;
  /** Default plot height in px, for metrics that don't set their own. */
  chartHeight?: number;
  /**
   * Metrics shown ONE AT A TIME in a single full-width card, with a switch to
   * pick between them (first is the default). The rest render as the usual
   * two-column grid of toggleable cards beneath it.
   */
  primaryMetricKeys?: string[];
  rangeControl?: RangeControl;
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

// Axis ticks for the multi-day ranges, where the time of day is just noise.
function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString([], { month: "short", day: "numeric" });
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

// The viewer's unit choice is remembered per metric, per browser. Storage can
// throw (private windows, blocked site data); a lost preference just falls back
// to the default unit, so every failure here is swallowed.
function unitStorageKey(metricKey: string) {
  return `dmvrin:unit:${metricKey}`;
}

function readStoredUnit(metricKey: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem(unitStorageKey(metricKey));
  } catch {
    return null;
  }
}

function writeStoredUnit(metricKey: string, unit: string) {
  try {
    window.localStorage.setItem(unitStorageKey(metricKey), unit);
  } catch {
    // Not persisted; the toggle still works for this visit.
  }
}

type SegmentedToggleProps = {
  ariaLabel: string;
  options: string[];
  selected: string | undefined;
  onSelect: (option: string) => void;
};

// The small pill switch in a card's header, shared by the unit and range toggles.
function SegmentedToggle({ ariaLabel, options, selected, onSelect }: SegmentedToggleProps) {
  return (
    <div role="group" aria-label={ariaLabel} className="inline-flex rounded-full border border-line bg-panel p-0.5">
      {options.map((option) => {
        const active = option === selected;

        return (
          <button
            key={option}
            type="button"
            onClick={() => onSelect(option)}
            aria-pressed={active}
            className={`rounded-full px-2 py-0.5 text-xs font-medium transition ${
              active ? "bg-ink text-page" : "text-ink-muted hover:text-ink"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

// this type defines the props for the MetricChartCard component, which displays a line chart for a specific river metric
type MetricChartCardProps = {
  dataKey: string;
  label: string;
  description?: string;
  unit?: string;
  unitOptions?: UnitOption[];
  color: string;
  data: RiverChartRow[];
  latestValue: number | null;
  chartHeight: number;
  range?: Pick<RangeControl, "options" | "selected" | "onSelect">;
  /** Multi-day view: date-only axis ticks. */
  showDates: boolean;
  /** Shown in place of the plot while a range loads or after it fails. */
  statusMessage: string | null;
};

function MetricChartCard({
  dataKey,
  label,
  description,
  unit,
  unitOptions,
  color,
  data,
  latestValue,
  chartHeight,
  range,
  showDates,
  statusMessage,
}: MetricChartCardProps) {
  // Read in the initializer rather than an effect: this card only mounts after the
  // client-side fetch resolves, so it never server-renders and can't mismatch.
  const [selectedUnit, setSelectedUnit] = useState<string | null>(() => readStoredUnit(dataKey));
  const activeOption = unitOptions?.find((option) => option.unit === selectedUnit) ?? unitOptions?.[0];
  const convert = activeOption?.convert;
  const displayUnit = activeOption?.unit ?? unit;

  const displayData = useMemo(
    () =>
      convert
        ? data.map((row) => {
            const value = row[dataKey];
            return { ...row, [dataKey]: typeof value === "number" ? convert(value) : value };
          })
        : data,
    [data, dataKey, convert],
  );
  const displayLatest = latestValue !== null && convert ? convert(latestValue) : latestValue;

  const selectUnit = (nextUnit: string) => {
    setSelectedUnit(nextUnit);
    writeStoredUnit(dataKey, nextUnit);
  };

  return (
    <div className="group rounded-2xl border border-line bg-page p-4 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-accent-soft">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-ink">{label}</h3>
          {description ? <p className="mt-0.5 text-xs text-ink-muted">{description}</p> : null}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {range ? (
            <SegmentedToggle
              ariaLabel={`${label} time range`}
              options={range.options}
              selected={range.selected}
              onSelect={range.onSelect}
            />
          ) : null}
          {unitOptions && unitOptions.length > 1 ? (
            <SegmentedToggle
              ariaLabel={`${label} unit`}
              options={unitOptions.map((option) => option.unit)}
              selected={displayUnit}
              onSelect={selectUnit}
            />
          ) : null}
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-semibold tabular-nums text-ink">{formatValue(displayLatest)}</span>
            {displayUnit ? <span className="text-sm text-ink-muted">{displayUnit}</span> : null}
          </div>
        </div>
      </div>

      <div className="w-full" style={{ height: chartHeight }}>
        {statusMessage ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-line text-sm text-ink-muted">
            {statusMessage}
          </div>
        ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={displayData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#D9DED8" strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              tickFormatter={showDates ? formatDate : formatTimestamp}
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
              formatter={(value) => [`${formatValue(Number(value))}${displayUnit ? ` ${displayUnit}` : ""}`, label]}
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
        )}
      </div>
    </div>
  );
}

export default function RiverDataChart({ data, metrics, title = "River Monitoring", chartHeight = 220, rangeControl }: RiverDataChartProps) {
  const [visibleMetrics, setVisibleMetrics] = useState<string[]>(() => metrics.map((metric) => metric.key));

  const chartData = useMemo(() => toChartRows(data, metrics), [data, metrics]);
  const rangeData = rangeControl?.data;
  const rangeRows = useMemo(() => toChartRows(rangeData, metrics), [rangeData, metrics]);
  const longRangeSelected = rangeControl !== undefined && rangeControl.selected !== rangeControl.options[0];

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
        <div className="text-sm text-ink-muted">{chartData.length} readings in the last 24h</div>
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
          {visibleMetricStyles.map((metric) => {
            const followsRange = rangeControl?.metricKeys.includes(metric.key) ?? false;
            const usesRangeData = followsRange && longRangeSelected;

            let statusMessage: string | null = null;
            if (usesRangeData && !rangeControl?.data) {
              statusMessage = rangeControl?.error ?? `Loading ${rangeControl?.selected} of readings...`;
            }

            return (
              <MetricChartCard
                key={metric.key}
                dataKey={metric.key}
                label={metric.label}
                description={metric.description}
                unit={metric.unit}
                unitOptions={metric.unitOptions}
                color={metric.color}
                data={usesRangeData ? rangeRows : chartData}
                // Always the latest raw reading, even on the averaged multi-day
                // views -- a 3-hour mean would understate what the river is doing now.
                latestValue={getLatestValue(chartData, metric.key)}
                chartHeight={metric.chartHeight ?? chartHeight}
                range={followsRange ? rangeControl : undefined}
                showDates={usesRangeData}
                statusMessage={statusMessage}
              />
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-line bg-page p-8 text-center text-sm text-ink-muted">
          Select at least one metric above to display its chart.
        </div>
      )}
    </section>
  );
}
