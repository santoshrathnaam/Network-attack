import React, { useState, useMemo } from 'react';
import { TrafficDataPoint, NetworkStatus } from '../../types/cyberDefense';
import { Card } from '../common/Card';
import { Activity, ShieldAlert, Zap, Clock } from 'lucide-react';

interface NetworkActivityChartProps {
  trafficData?: TrafficDataPoint[];
  currentStatus: NetworkStatus;
}

export const NetworkActivityChart: React.FC<NetworkActivityChartProps> = ({
  trafficData = [],
  currentStatus
}) => {
  const [selectedRange, setSelectedRange] = useState<'1m' | '5m' | '15m'>('5m');
  const [hoveredPoint, setHoveredPoint] = useState<TrafficDataPoint | null>(null);

  // Filter or slice points according to selected range
  const displayPoints = useMemo(() => {
    if (!trafficData || trafficData.length === 0) return [];
    if (selectedRange === '1m') return trafficData.slice(-15);
    if (selectedRange === '5m') return trafficData.slice(-25);
    return trafficData;
  }, [trafficData, selectedRange]);

  // Chart dimensions & scaling
  const width = 800;
  const height = 240;
  const padding = { top: 25, right: 30, bottom: 35, left: 50 };

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // Calculate scales
  const { minVal, maxVal, pathD, areaD, thresholdY, baselineY, pointsWithCoords } = useMemo(() => {
    if (displayPoints.length === 0) {
      return {
        minVal: 0,
        maxVal: 600,
        pathD: '',
        areaD: '',
        thresholdY: 0,
        baselineY: 0,
        pointsWithCoords: []
      };
    }

    const volumes = displayPoints.map((p) => p.traffic_volume);
    const thresholds = displayPoints.map((p) => p.anomaly_threshold);
    const escalations = displayPoints.map((p) => p.projected_escalation || 0);

    const minV = Math.min(100, ...volumes) * 0.8;
    const maxV = Math.max(550, ...volumes, ...thresholds, ...escalations) * 1.12;

    const getX = (idx: number) =>
      padding.left + (idx / Math.max(1, displayPoints.length - 1)) * innerWidth;
    const getY = (val: number) =>
      padding.top + innerHeight - ((val - minV) / (maxV - minV)) * innerHeight;

    const coords = displayPoints.map((p, idx) => ({
      ...p,
      x: getX(idx),
      y: getY(p.traffic_volume)
    }));

    // Generate smooth Bézier SVG curve
    let d = '';
    let area = '';

    if (coords.length > 0) {
      d = `M ${coords[0].x} ${coords[0].y}`;
      for (let i = 0; i < coords.length - 1; i++) {
        const p0 = coords[i === 0 ? 0 : i - 1];
        const p1 = coords[i];
        const p2 = coords[i + 1];
        const p3 = coords[i + 2] || p2;

        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
      }

      const lastX = coords[coords.length - 1].x;
      const firstX = coords[0].x;
      const bottomY = padding.top + innerHeight;
      area = `${d} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
    }

    const tY = getY(displayPoints[0]?.anomaly_threshold || 480);
    const bY = getY(displayPoints[0]?.baseline || 240);

    return {
      minVal: Math.round(minV),
      maxVal: Math.round(maxV),
      pathD: d,
      areaD: area,
      thresholdY: tY,
      baselineY: bY,
      pointsWithCoords: coords
    };
  }, [displayPoints, innerWidth, innerHeight]);

  const latestPoint = pointsWithCoords[pointsWithCoords.length - 1];

  return (
    <Card
      title="Network Activity Visualization"
      subtitle="Real-time traffic volume against baseline normal and anomaly threshold"
      action={
        <div className="flex items-center gap-2">
          {/* Time range pills */}
          <div className="flex items-center bg-neutral-100 dark:bg-neutral-800/80 p-0.5 rounded-lg border border-neutral-200/60 dark:border-neutral-700/60">
            {(['1m', '5m', '15m'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setSelectedRange(range)}
                className={`px-2.5 py-0.5 text-xs font-medium rounded-md transition-colors ${
                  selectedRange === range
                    ? 'bg-white dark:bg-[#12141A] text-neutral-900 dark:text-neutral-100 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {/* Telemetry quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 pb-3 border-b border-neutral-100 dark:border-neutral-800/80">
        <div>
          <span className="text-[10px] uppercase font-semibold text-neutral-400 dark:text-neutral-500">
            Current Rate
          </span>
          <div className="text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-100 font-mono">
            {latestPoint ? `${latestPoint.traffic_volume} Mbps` : '—'}
          </div>
        </div>
        <div>
          <span className="text-[10px] uppercase font-semibold text-neutral-400 dark:text-neutral-500">
            Anomaly Threshold
          </span>
          <div className="text-lg font-semibold tabular-nums text-orange-600 dark:text-orange-400 font-mono">
            480 Mbps
          </div>
        </div>
        <div>
          <span className="text-[10px] uppercase font-semibold text-neutral-400 dark:text-neutral-500">
            Nominal Baseline
          </span>
          <div className="text-lg font-semibold tabular-nums text-neutral-500 dark:text-neutral-400 font-mono">
            240 Mbps
          </div>
        </div>
        <div>
          <span className="text-[10px] uppercase font-semibold text-neutral-400 dark:text-neutral-500">
            Escalation Zone
          </span>
          <div className="text-lg font-semibold tabular-nums text-rose-600 dark:text-rose-400 font-mono">
            &gt; 520 Mbps
          </div>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
          onMouseLeave={() => setHoveredPoint(null)}
        >
          <defs>
            {/* Soft area gradient */}
            <linearGradient id="appleTrafficGradient" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={
                  currentStatus === 'CRITICAL'
                    ? '#EF4444'
                    : currentStatus === 'ELEVATED'
                    ? '#F97316'
                    : currentStatus === 'WATCH'
                    ? '#F59E0B'
                    : '#10B981'
                }
                stopOpacity="0.18"
              />
              <stop
                offset="100%"
                stopColor={
                  currentStatus === 'CRITICAL'
                    ? '#EF4444'
                    : currentStatus === 'ELEVATED'
                    ? '#F97316'
                    : currentStatus === 'WATCH'
                    ? '#F59E0B'
                    : '#10B981'
                }
                stopOpacity="0.0"
              />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const y = padding.top + innerHeight * ratio;
            const val = Math.round(maxVal - (maxVal - minVal) * ratio);
            return (
              <g key={idx}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="currentColor"
                  className="text-neutral-100 dark:text-neutral-800"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="text-[10px] fill-neutral-400 dark:fill-neutral-500 font-mono"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Baseline Reference Line */}
          <line
            x1={padding.left}
            y1={baselineY}
            x2={width - padding.right}
            y2={baselineY}
            stroke="#9CA3AF"
            strokeDasharray="4 4"
            strokeWidth="1.2"
            opacity="0.6"
          />
          <text
            x={width - padding.right}
            y={baselineY - 4}
            textAnchor="end"
            className="text-[10px] fill-neutral-400 dark:fill-neutral-500 font-medium"
          >
            Baseline
          </text>

          {/* Anomaly Threshold Boundary Line */}
          <line
            x1={padding.left}
            y1={thresholdY}
            x2={width - padding.right}
            y2={thresholdY}
            stroke="#F97316"
            strokeDasharray="5 3"
            strokeWidth="1.5"
            opacity="0.85"
          />
          <text
            x={width - padding.right}
            y={thresholdY - 4}
            textAnchor="end"
            className="text-[10px] fill-orange-500 font-semibold uppercase tracking-wider"
          >
            Anomaly Boundary (480 Mbps)
          </text>

          {/* Traffic Area */}
          {areaD && <path d={areaD} fill="url(#appleTrafficGradient)" />}

          {/* Traffic Line */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke={
                currentStatus === 'CRITICAL'
                  ? '#DC2626'
                  : currentStatus === 'ELEVATED'
                  ? '#EA580C'
                  : currentStatus === 'WATCH'
                  ? '#D97706'
                  : '#059669'
              }
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Current / Latest Point Indicator */}
          {latestPoint && (
            <g transform={`translate(${latestPoint.x}, ${latestPoint.y})`}>
              <circle
                r="7"
                className={`${
                  currentStatus === 'CRITICAL'
                    ? 'fill-rose-500/20 stroke-rose-500'
                    : currentStatus === 'ELEVATED'
                    ? 'fill-orange-500/20 stroke-orange-500'
                    : currentStatus === 'WATCH'
                    ? 'fill-amber-500/20 stroke-amber-500'
                    : 'fill-emerald-500/20 stroke-emerald-500'
                }`}
                strokeWidth="2"
              />
              <circle
                r="3.5"
                className={`${
                  currentStatus === 'CRITICAL'
                    ? 'fill-rose-600'
                    : currentStatus === 'ELEVATED'
                    ? 'fill-orange-600'
                    : currentStatus === 'WATCH'
                    ? 'fill-amber-600'
                    : 'fill-emerald-600'
                }`}
              />
            </g>
          )}

          {/* Invisible interactive hover bars */}
          {pointsWithCoords.map((pt, idx) => (
            <rect
              key={idx}
              x={pt.x - 12}
              y={padding.top}
              width={24}
              height={innerHeight}
              fill="transparent"
              className="cursor-crosshair"
              onMouseEnter={() => setHoveredPoint(pt)}
            />
          ))}

          {/* Time axis labels */}
          {pointsWithCoords
            .filter((_, idx) => idx % Math.max(1, Math.floor(pointsWithCoords.length / 5)) === 0)
            .map((pt, idx) => (
              <text
                key={idx}
                x={pt.x}
                y={height - 10}
                textAnchor="middle"
                className="text-[10px] fill-neutral-400 dark:fill-neutral-500 font-mono"
              >
                {pt.timestamp}
              </text>
            ))}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredPoint && (
          <div
            className="absolute top-2 right-4 bg-neutral-900/90 text-white text-xs px-3 py-2 rounded-lg shadow-lg backdrop-blur-sm pointer-events-none border border-neutral-700"
          >
            <div className="font-mono text-[11px] text-neutral-400 mb-0.5">
              {hoveredPoint.timestamp}
            </div>
            <div className="font-semibold flex items-center gap-1.5">
              <span>Traffic:</span>
              <span className="font-mono text-emerald-400">{hoveredPoint.traffic_volume} Mbps</span>
            </div>
            <div className="text-[11px] text-neutral-300">
              Anomaly Threshold: {hoveredPoint.anomaly_threshold} Mbps
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between text-xs text-neutral-400 dark:text-neutral-500 pt-2 border-t border-neutral-100 dark:border-neutral-800/60">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-neutral-400 dark:bg-neutral-600 rounded" />
            <span>Normal Profile</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-orange-500 rounded" />
            <span>Anomaly Limit</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>Current State</span>
          </div>
        </div>
        <span className="text-[11px] font-mono">Sampling: 15s aggregate</span>
      </div>
    </Card>
  );
};
