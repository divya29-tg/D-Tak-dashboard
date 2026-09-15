import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Users,
  MapPin,
  UserCheck,
  Network,
  Server,
  ChevronRight,
  LogOut,
  Building2,
  ShieldCheck,
  ArrowLeftRight,
  FileText,
  ClipboardList,
  Share2,
  UsersRound,
  Settings2,
  Copy,
  TrendingUp,
  Clock,
  Radio,
  ArrowUpRight,
  Boxes,
  Globe,
} from 'lucide-react';
import { ROUTES } from '@/app/router/routes';
import dtakLogo from '@/assets/dtak-logo.png';
import { getAdminProfile } from '@/utils/adminProfile';
import { useAuth } from '@/app/router/AppRouter';
import './NCCScreen.css';

type RangeMode = 'daily' | 'weekly' | 'monthly';

const HOLDER_DATASETS: Record<RangeMode, { labels: string[]; values: number[] }> = {
  daily: {
    labels: ['9/1', '9/2', '9/3', '9/4', '9/5', '9/6', '9/7', '9/8', '9/9', '9/10', '9/11', '9/12', '9/13', '9/14'],
    values: [44, 45, 45, 46, 47, 47, 48, 48, 49, 49, 50, 50, 51, 52],
  },
  weekly: {
    labels: ['Wk 29', 'Wk 30', 'Wk 31', 'Wk 32', 'Wk 33', 'Wk 34', 'Wk 35', 'Wk 36'],
    values: [31, 34, 36, 38, 41, 44, 47, 50],
  },
  monthly: {
    labels: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept'],
    values: [18, 24, 29, 35, 42, 51],
  },
};

const SERVICE_DATASETS: Record<RangeMode, { labels: string[]; created: number[]; published: number[] }> = {
  daily: {
    labels: ['9/8', '9/9', '9/10', '9/11', '9/12', '9/13', '9/14'],
    created: [3, 2, 4, 1, 3, 2, 4],
    published: [2, 2, 3, 1, 2, 2, 3],
  },
  weekly: {
    labels: ['Wk 31', 'Wk 32', 'Wk 33', 'Wk 34', 'Wk 35', 'Wk 36'],
    created: [9, 11, 8, 14, 12, 16],
    published: [7, 9, 8, 11, 10, 13],
  },
  monthly: {
    labels: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept'],
    created: [22, 28, 31, 35, 40, 46],
    published: [18, 23, 27, 30, 34, 39],
  },
};

const CREDENTIAL_DATASETS: Record<RangeMode, { labels: string[]; values: number[] }> = {
  daily: {
    labels: HOLDER_DATASETS.daily.labels,
    values: [8, 10, 6, 12, 9, 14, 11, 13, 10, 15, 12, 16, 14, 18],
  },
  weekly: {
    labels: HOLDER_DATASETS.weekly.labels,
    values: [28, 34, 31, 40, 37, 45, 42, 50],
  },
  monthly: {
    labels: HOLDER_DATASETS.monthly.labels,
    values: [24, 31, 29, 38, 42, 48],
  },
};

const TXN_RANGE_OPTIONS = ['24H', '7D', '30D', '3M', '1Y'] as const;
type TxnRange = (typeof TXN_RANGE_OPTIONS)[number];

const TRANSACTION_DATASETS: Record<TxnRange, { labels: string[]; values: number[] }> = {
  '24H': { labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '23:59'], values: [12, 18, 34, 52, 61, 48, 29] },
  '7D': { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], values: [38, 45, 52, 66, 58, 41, 36] },
  '30D': { labels: ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'], values: [186, 214, 248, 266] },
  '3M': { labels: ['Jul', 'Aug', 'Sept'], values: [820, 910, 1040] },
  '1Y': {
    labels: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept'],
    values: [140, 165, 190, 210, 225, 248, 265, 280, 301, 320, 340, 362],
  },
};

const TRANSACTIONS_TOTAL = 2944;
const SERVICES_CREATED_TOTAL = 168;
const CLAIM_DEFS_TOTAL = 261;
const SCHEMAS_TOTAL = 259;
const ISSUERS_TOTAL = 10;
const VERIFIERS_TOTAL = 1;

// DTAK design-token colors (see the --ncc-* CSS variables in NCCScreen.css).
const NCC_GREEN = '#8fbf3f';
const NCC_PURPLE = '#a78bfa';
const NCC_MUTED_GREEN = '#6b8f70';
const NCC_AMBER = '#f2a93b';
const NCC_BLUE = '#3b82f6';
const NCC_RED = '#e5484d';
const NCC_TEXT_SECONDARY = '#9ca3af';
const NCC_TEXT_TERTIARY = '#6b7280';

const STAT_CARDS = [
  { icon: Share2, value: TRANSACTIONS_TOTAL, label: 'Transactions', trend: '18%', color: NCC_GREEN, bg: 'rgba(143, 191, 63, 0.14)', spark: [12, 15, 14, 18, 22, 20, 25, 28, 26, 31] },
  { icon: Building2, value: SERVICES_CREATED_TOTAL, label: 'Services', trend: '8%', color: NCC_PURPLE, bg: 'rgba(167, 139, 250, 0.14)', spark: [20, 22, 21, 24, 23, 26, 28, 27, 30, 32] },
  { icon: ClipboardList, value: CLAIM_DEFS_TOTAL, label: 'Claim Definitions', trend: '6%', color: NCC_AMBER, bg: 'rgba(242, 169, 59, 0.14)', spark: [30, 29, 31, 33, 32, 35, 34, 37, 39, 38] },
  { icon: FileText, value: SCHEMAS_TOTAL, label: 'Schemas', trend: '4%', color: NCC_MUTED_GREEN, bg: 'rgba(107, 143, 112, 0.16)', spark: [40, 41, 40, 42, 44, 43, 45, 46, 45, 47] },
  { icon: ShieldCheck, value: ISSUERS_TOTAL, label: 'Issuers', trend: '7%', color: NCC_BLUE, bg: 'rgba(59, 130, 246, 0.14)', spark: [4, 5, 5, 6, 6, 7, 8, 8, 9, 10] },
  { icon: UserCheck, value: VERIFIERS_TOTAL, label: 'Verifier', trend: null, color: NCC_TEXT_SECONDARY, bg: 'rgba(156, 163, 175, 0.12)', spark: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
];

const DISTRIBUTION_SEGMENTS = [
  { label: 'NYM', value: 42, color: NCC_GREEN },
  { label: 'Schema', value: 28, color: NCC_PURPLE },
  { label: 'Credential', value: 21, color: NCC_MUTED_GREEN },
  { label: 'Claim Definition', value: 6, color: NCC_AMBER },
  { label: 'Revocation', value: 2, color: NCC_RED },
  { label: 'Other', value: 1, color: NCC_TEXT_TERTIARY },
];

interface NodeInfo {
  alias: string;
  port: number;
  nodeIp: string;
  service: string;
  did: string;
  uptime: string;
  status: 'Operational' | 'Offline';
}

// The full mesh is 26 nodes (matches the Edge Node network); the topology
// panel visualizes a representative sample rather than all 26 at once.
const NODES_TOTAL = 26;
const NODES_ONLINE = 15;

const NODES: NodeInfo[] = [
  { alias: 'Node1', port: 9701, nodeIp: '10.160.0.8', service: 'VALIDATOR', did: 'Gk3nWpXtRVYcPiab9s2Q', uptime: '482 days, 2 hours', status: 'Operational' },
  { alias: 'Node2', port: 9703, nodeIp: '10.160.0.8', service: 'VALIDATOR', did: 'EbP4aYNeTHL6q385GuVR', uptime: '482 days, 2 hours', status: 'Operational' },
  { alias: 'Node3', port: 9705, nodeIp: '10.160.0.8', service: 'VALIDATOR', did: '4cU41vWW82ArfxJXHkzP', uptime: '482 days, 2 hours', status: 'Operational' },
  { alias: 'Node4', port: 9707, nodeIp: '10.160.0.8', service: 'VALIDATOR', did: 'TWwCRQRZ2ZHMJFn9TzLp', uptime: '482 days, 2 hours', status: 'Offline' },
  { alias: 'Node5', port: 9709, nodeIp: '10.160.0.9', service: 'VALIDATOR', did: 'Qp82fWzNc6bLXtR9VkAe', uptime: '340 days, 6 hours', status: 'Operational' },
  { alias: 'Node6', port: 9711, nodeIp: '10.160.0.9', service: 'OBSERVER', did: 'Nx4uHmYcTz18qBpLwR7v', uptime: '340 days, 6 hours', status: 'Operational' },
  { alias: 'Node7', port: 9713, nodeIp: '10.160.0.9', service: 'OBSERVER', did: 'Rj93kSpXhQ6cVtY2mLbN', uptime: '198 days, 11 hours', status: 'Offline' },
  { alias: 'Node8', port: 9715, nodeIp: '10.160.0.10', service: 'VALIDATOR', did: 'Wv7dGpMzXc3fRhT8nKjQ', uptime: '198 days, 11 hours', status: 'Operational' },
];

interface LedgerRow {
  seq: number;
  type: string;
  color: string;
  txnId: string;
  time: string;
}

const RECENT_LEDGER: LedgerRow[] = [
  { seq: 2944, type: 'NYM', color: NCC_GREEN, txnId: 'e935fela260497524e1195c9b7f18716aecbb4ea9b...', time: '25 mins ago' },
  { seq: 2943, type: 'Schema', color: NCC_PURPLE, txnId: '3f21a8e99d4c7b2e6f0a9d114b8c1d2f7a8e92...', time: '1 hour ago' },
  { seq: 2942, type: 'Credential', color: NCC_MUTED_GREEN, txnId: '82bd4f6e1a7c93d2e5f8a1b4dc3d7e9f31c21...', time: '2 hours ago' },
  { seq: 2941, type: 'Claim Def', color: NCC_AMBER, txnId: '17aa9b3d4e6c21f5a8b7d9e0f4c3b8a1d4c12...', time: '3 hours ago' },
  { seq: 2940, type: 'Revocation', color: NCC_RED, txnId: '9c4d7e2a1f8b6d3c5e2a9f7b3d1c8e4a2b7f31...', time: '5 hours ago' },
];

const CHART_W = 720;
const CHART_H = 240;
const CHART_PAD_L = 36;
const CHART_PAD_R = 12;
const CHART_PAD_T = 12;
const CHART_PAD_B = 28;

function niceGrid(maxRaw: number): number[] {
  const step = Math.ceil((maxRaw * 1.2) / 4 / 5) * 5 || 5;
  return [0, step, step * 2, step * 3, step * 4];
}

/** Sum of a period's values -- used so a panel's headline number actually
 * changes when you switch its time-range toggle, instead of always
 * showing the same fixed all-time total. */
function sumOf(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/** % change from the first to the last point in the selected period. */
function trendOf(values: number[]): number {
  const first = values[0] ?? 0;
  const last = values[values.length - 1] ?? 0;
  if (first === 0) return last > 0 ? 100 : 0;
  return Math.round(((last - first) / first) * 100);
}

function RangeToggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div className="ncc-toggle-group" role="tablist" aria-label="Time range">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          role="tab"
          aria-selected={value === opt.id}
          className={`ncc-toggle-btn ${value === opt.id ? 'ncc-toggle-btn--active' : ''}`}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

interface TooltipState {
  x: number;
  y: number;
  title: string;
  rows: { label: string; value: string; color: string }[];
}

/** Generic single-series line/area chart -- used for Transaction Activity and Network Adoption. */
function LineChart({
  labels,
  values,
  color,
  valueLabel,
}: {
  labels: string[];
  values: number[];
  color: string;
  valueLabel: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const gradientId = useRef(`ncc-line-fill-${Math.random().toString(36).slice(2)}`).current;

  const plotW = CHART_W - CHART_PAD_L - CHART_PAD_R;
  const plotH = CHART_H - CHART_PAD_T - CHART_PAD_B;
  const gridValues = useMemo(() => niceGrid(Math.max(...values, 1)), [values]);
  const maxVal = gridValues[gridValues.length - 1] || 1;

  const points = useMemo(
    () =>
      values.map((v, i) => ({
        x: CHART_PAD_L + (values.length === 1 ? plotW / 2 : (plotW * i) / (values.length - 1)),
        y: CHART_PAD_T + plotH - (v / maxVal) * plotH,
        v,
        label: labels[i],
      })),
    [values, labels, plotW, plotH, maxVal]
  );

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(CHART_PAD_T + plotH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(CHART_PAD_T + plotH).toFixed(1)} Z`;

  const showTooltip = (p: (typeof points)[number], evt: React.MouseEvent) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    setTooltip({
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top,
      title: p.label,
      rows: [{ label: valueLabel, value: String(p.v), color }],
    });
  };

  return (
    <div className="ncc-chart-wrap" ref={wrapRef} style={{ position: 'relative' }}>
      <svg
        className="ncc-svg-chart"
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        role="img"
        aria-label={valueLabel}
        onMouseLeave={() => setTooltip(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridValues.map((gv) => {
          const y = CHART_PAD_T + plotH - (gv / maxVal) * plotH;
          return (
            <g key={gv}>
              <line x1={CHART_PAD_L} x2={CHART_W - CHART_PAD_R} y1={y} y2={y} stroke="#2a2d30" strokeWidth={1} strokeDasharray="3 4" />
              <text x={CHART_PAD_L - 10} y={y + 3} textAnchor="end" fontSize="10" fill="#9ca3af">
                {gv}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={i === 0 || i === points.length - 1 ? 4 : 3}
            fill={color}
            stroke="#17191b"
            strokeWidth={1.5}
            style={{ cursor: 'pointer' }}
            onMouseMove={(e) => showTooltip(p, e)}
          />
        ))}

        <text x={CHART_PAD_L} y={CHART_H - 4} fontSize="11" fill="#9ca3af">
          {labels[0]}
        </text>
        <text x={CHART_W - CHART_PAD_R} y={CHART_H - 4} textAnchor="end" fontSize="11" fill="#9ca3af">
          {labels[labels.length - 1]}
        </text>
      </svg>

      {tooltip && (
        <div className="ncc-chart-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <div>{tooltip.title}</div>
          {tooltip.rows.map((r) => (
            <div key={r.label}>
              {r.label}: <span className="ncc-chart-tooltip__value">{r.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Grouped two-series bar chart -- used for Service Lifecycle (Created vs Published). */
function GroupedBarChart({
  labels,
  created,
  published,
}: {
  labels: string[];
  created: number[];
  published: number[];
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const plotW = CHART_W - CHART_PAD_L - CHART_PAD_R;
  const plotH = CHART_H - CHART_PAD_T - CHART_PAD_B;
  const groupW = plotW / labels.length;
  const barW = Math.min(18, groupW / 3.2);

  const gridValues = useMemo(() => niceGrid(Math.max(...created, ...published, 1)), [created, published]);
  const axisMax = gridValues[gridValues.length - 1] || 1;

  const showTooltip = (label: string, c: number, p: number, evt: React.MouseEvent) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    setTooltip({
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top,
      title: label,
      rows: [
        { label: 'Created Service', value: String(c), color: NCC_GREEN },
        { label: 'Published Service', value: String(p), color: NCC_PURPLE },
      ],
    });
  };

  return (
    <div className="ncc-chart-wrap" ref={wrapRef} style={{ position: 'relative' }}>
      <svg
        className="ncc-svg-chart"
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        role="img"
        aria-label="Created vs published services over time"
        onMouseLeave={() => setTooltip(null)}
      >
        {gridValues.map((gv) => {
          const y = CHART_PAD_T + plotH - (gv / axisMax) * plotH;
          return (
            <g key={gv}>
              <line x1={CHART_PAD_L} x2={CHART_W - CHART_PAD_R} y1={y} y2={y} stroke="#2a2d30" strokeWidth={1} strokeDasharray="3 4" />
              <text x={CHART_PAD_L - 10} y={y + 3} textAnchor="end" fontSize="10" fill="#9ca3af">
                {gv}
              </text>
            </g>
          );
        })}

        {labels.map((label, i) => {
          const groupX = CHART_PAD_L + groupW * i + groupW / 2;
          const cH = (created[i] / axisMax) * plotH;
          const pH = (published[i] / axisMax) * plotH;
          const baseY = CHART_PAD_T + plotH;
          return (
            <g key={label} onMouseMove={(e) => showTooltip(label, created[i], published[i], e)} style={{ cursor: 'pointer' }}>
              <rect x={groupX - barW - 2} y={baseY - cH} width={barW} height={cH} rx={3} fill={NCC_GREEN} />
              <rect x={groupX + 2} y={baseY - pH} width={barW} height={pH} rx={3} fill={NCC_PURPLE} />
              <text x={groupX} y={CHART_H - 4} textAnchor="middle" fontSize="10" fill="#9ca3af">
                {label}
              </text>
            </g>
          );
        })}
      </svg>

      {tooltip && (
        <div className="ncc-chart-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <div>{tooltip.title}</div>
          {tooltip.rows.map((r) => (
            <div key={r.label}>
              <span style={{ color: r.color, fontWeight: 700 }}>●</span> {r.label}:{' '}
              <span className="ncc-chart-tooltip__value">{r.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Single-series bar chart -- used for Credential Activity. */
function SingleBarChart({ labels, values, color }: { labels: string[]; values: number[]; color: string }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const plotW = CHART_W - CHART_PAD_L - CHART_PAD_R;
  const plotH = CHART_H - CHART_PAD_T - CHART_PAD_B;
  const groupW = plotW / labels.length;
  const barW = Math.min(22, groupW * 0.5);

  const gridValues = useMemo(() => niceGrid(Math.max(...values, 1)), [values]);
  const axisMax = gridValues[gridValues.length - 1] || 1;

  const showTooltip = (label: string, v: number, evt: React.MouseEvent) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    setTooltip({ x: evt.clientX - rect.left, y: evt.clientY - rect.top, title: label, rows: [{ label: 'Credentials Issued', value: String(v), color }] });
  };

  return (
    <div className="ncc-chart-wrap" ref={wrapRef} style={{ position: 'relative' }}>
      <svg
        className="ncc-svg-chart"
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        role="img"
        aria-label="Credentials issued over time"
        onMouseLeave={() => setTooltip(null)}
      >
        {gridValues.map((gv) => {
          const y = CHART_PAD_T + plotH - (gv / axisMax) * plotH;
          return (
            <g key={gv}>
              <line x1={CHART_PAD_L} x2={CHART_W - CHART_PAD_R} y1={y} y2={y} stroke="#2a2d30" strokeWidth={1} strokeDasharray="3 4" />
              <text x={CHART_PAD_L - 10} y={y + 3} textAnchor="end" fontSize="10" fill="#9ca3af">
                {gv}
              </text>
            </g>
          );
        })}

        {labels.map((label, i) => {
          const groupX = CHART_PAD_L + groupW * i + groupW / 2;
          const h = (values[i] / axisMax) * plotH;
          const baseY = CHART_PAD_T + plotH;
          return (
            <g key={label} onMouseMove={(e) => showTooltip(label, values[i], e)} style={{ cursor: 'pointer' }}>
              <rect x={groupX - barW / 2} y={baseY - h} width={barW} height={h} rx={3} fill={color} />
              <text x={groupX} y={CHART_H - 4} textAnchor="middle" fontSize="10" fill="#9ca3af">
                {label}
              </text>
            </g>
          );
        })}
      </svg>

      {tooltip && (
        <div className="ncc-chart-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <div>{tooltip.title}</div>
          {tooltip.rows.map((r) => (
            <div key={r.label}>
              {r.label}: <span className="ncc-chart-tooltip__value">{r.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Tiny inline sparkline -- stat cards + banner live-activity indicator. No axes/labels. */
function Sparkline({ values, color, width = 96, height = 28 }: { values: number[]; color: string; width?: number; height?: number }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const points = values.map((v, i) => {
    const x = values.length === 1 ? width / 2 : (width * i) / (values.length - 1);
    const y = height - ((v - min) / range) * height;
    return [x, y] as const;
  });
  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="ncc-sparkline" aria-hidden>
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Donut chart built from plain SVG circles (stroke-dasharray trick) -- Transaction Distribution. */
function DonutChart({
  segments,
  centerValue,
  centerLabel,
}: {
  segments: { label: string; value: number; color: string }[];
  centerValue: string;
  centerLabel: string;
}) {
  const size = 190;
  const stroke = 26;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;

  let cumulative = 0;
  const arcs = segments.map((s) => {
    const fraction = s.value / total;
    const dash = fraction * circumference;
    const offset = -cumulative * circumference;
    cumulative += fraction;
    return { ...s, dash, offset };
  });

  return (
    <div className="ncc-donut">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Transaction distribution by type">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2a2d30" strokeWidth={stroke} />
          {arcs.map((a) => (
            <circle
              key={a.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={a.color}
              strokeWidth={stroke}
              strokeDasharray={`${a.dash.toFixed(2)} ${(circumference - a.dash).toFixed(2)}`}
              strokeDashoffset={a.offset.toFixed(2)}
            />
          ))}
        </g>
        <text x={size / 2} y={size / 2 - 6} textAnchor="middle" fontSize="22" fontWeight={700} fill="#ffffff">
          {centerValue}
        </text>
        <text x={size / 2} y={size / 2 + 14} textAnchor="middle" fontSize="11" fill="#9ca3af">
          {centerLabel}
        </text>
      </svg>

      <div className="ncc-donut__legend">
        {segments.map((s) => (
          <div className="ncc-donut__legend-row" key={s.label}>
            <span className="ncc-legend-dot" style={{ backgroundColor: s.color }} />
            <span className="ncc-donut__legend-label">{s.label}</span>
            <span className="ncc-donut__legend-value">{s.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function NCCScreen() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const adminProfile = getAdminProfile();

  const [txnRange, setTxnRange] = useState<TxnRange>('7D');
  const [holderRange, setHolderRange] = useState<RangeMode>('monthly');
  const [serviceRange, setServiceRange] = useState<RangeMode>('weekly');
  const [credentialRange, setCredentialRange] = useState<RangeMode>('weekly');
  const [environment, setEnvironment] = useState('Staging');
  const [copied, setCopied] = useState(false);

  const txnData = TRANSACTION_DATASETS[txnRange];
  const holderData = HOLDER_DATASETS[holderRange];
  const serviceData = SERVICE_DATASETS[serviceRange];
  const credentialData = CREDENTIAL_DATASETS[credentialRange];

  const txnId = 'f7a2c9e1b4d8365af0219cbe7a44d902e5f8c1b3a6d740fe982c1b5a03df66c';

  // Headline totals + trends recomputed per panel from whichever range is
  // currently selected there, so switching Daily/Weekly/Monthly (or
  // 24H/7D/30D/3M/1Y) visibly changes more than just the chart shape.
  const txnPeriodTotal = useMemo(() => sumOf(txnData.values), [txnData]);
  const txnPeriodTrend = useMemo(() => trendOf(txnData.values), [txnData]);

  const totalHolders = holderData.values[holderData.values.length - 1];
  const holderTrend = useMemo(() => trendOf(holderData.values), [holderData]);

  const credentialPeriodTotal = useMemo(() => sumOf(credentialData.values), [credentialData]);
  const credentialPeriodTrend = useMemo(() => trendOf(credentialData.values), [credentialData]);

  const servicePeriodCreated = useMemo(() => sumOf(serviceData.created), [serviceData]);
  const servicePeriodPublished = useMemo(() => sumOf(serviceData.published), [serviceData]);

  const peakTxn = useMemo(() => {
    let peakIdx = 0;
    txnData.values.forEach((v, i) => {
      if (v > txnData.values[peakIdx]) peakIdx = i;
    });
    return { value: txnData.values[peakIdx], label: txnData.labels[peakIdx] };
  }, [txnData]);

  const peakCredential = useMemo(() => {
    let peakIdx = 0;
    credentialData.values.forEach((v, i) => {
      if (v > credentialData.values[peakIdx]) peakIdx = i;
    });
    return { value: credentialData.values[peakIdx], label: credentialData.labels[peakIdx] };
  }, [credentialData]);

  const handleCopyTxn = async () => {
    try {
      await navigator.clipboard.writeText(txnId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable; silently ignore.
    }
  };

  return (
    <div className="ncc-layout">
      {/* Sidebar */}
      <aside className="ncc-sidebar">
        <div className="ncc-sidebar__brand">
          <div className="ncc-sidebar__brand-logo">
            <img src={dtakLogo} alt="DTAK Logo" className="ncc-sidebar__logo-img" width="48" height="48" />
            <div className="ncc-sidebar__brand-text">
              <span className="ncc-sidebar__brand-title">DTAK</span>
              <span className="ncc-sidebar__brand-subtitle">ADMIN CONSOLE</span>
            </div>
          </div>
        </div>

        <nav className="ncc-sidebar__nav">
          <div className="ncc-sidebar__nav-item" onClick={() => navigate(ROUTES.HOME)}>
            <MapPin size={18} className="ncc-sidebar__nav-icon" />
            <span>HOME</span>
          </div>

          <div className="ncc-sidebar__nav-item" onClick={() => navigate(ROUTES.USER_MANAGEMENT)}>
            <User size={18} className="ncc-sidebar__nav-icon" />
            <span>USERS</span>
          </div>

          <div className="ncc-sidebar__nav-item" onClick={() => navigate(ROUTES.GROUP_MANAGEMENT)}>
            <Users size={18} className="ncc-sidebar__nav-icon" />
            <span>GROUPS</span>
          </div>

          <div className="ncc-sidebar__nav-item" onClick={() => navigate(ROUTES.CONTACT_REQUESTS)}>
            <UserCheck size={18} className="ncc-sidebar__nav-icon" />
            <span>REQUESTS</span>
          </div>

          <div className="ncc-sidebar__nav-item" onClick={() => navigate(ROUTES.EDGE_NODES)}>
            <Network size={18} className="ncc-sidebar__nav-icon" />
            <span>EDGE NODE</span>
          </div>

          <div className="ncc-sidebar__nav-item ncc-sidebar__nav-item--active" onClick={() => navigate(ROUTES.NCC)}>
            <div className="ncc-sidebar__active-indicator" />
            <Server size={18} className="ncc-sidebar__nav-icon" />
            <span>NCC</span>
          </div>
        </nav>

        <div className="ncc-sidebar__user-profile">
          <div className="ncc-sidebar__user-profile-top">
            <div className="ncc-sidebar__user-avatar">
              {adminProfile.initials ? (
                <span>{adminProfile.initials}</span>
              ) : (
                <User size={16} color="#A1A1AA" />
              )}
            </div>
            <div className="ncc-sidebar__user-info">
              {adminProfile.name && <span className="ncc-sidebar__user-name">{adminProfile.name}</span>}
              {adminProfile.role && <span className="ncc-sidebar__user-role">{adminProfile.role}</span>}
            </div>
            <ChevronRight size={16} className="ncc-sidebar__user-chevron" />
          </div>

          <div className="ncc-sidebar__user-status">
            <span className="ncc-sidebar__status-dot">●</span> SECURE SESSION · AUTH LVL 5
          </div>

          <button
            type="button"
            className="ncc-sidebar__logout-btn"
            onClick={() => {
              logout();
              navigate(ROUTES.LOGIN);
            }}
          >
            <span>Logout</span>
            <LogOut size={14} color="#E5484D" />
          </button>
        </div>
      </aside>

      {/* Main light-theme network dashboard */}
      <main className="ncc-main">
        <div className="ncc-scroll">
          {/* Status banner */}
          <section className="ncc-banner">
            <div className="ncc-banner__glow" aria-hidden />
            <div className="ncc-banner__left">
              <h1 className="ncc-banner__title">Gamma Consortium Network</h1>
              <div className="ncc-banner__status">
                <span className="ncc-banner__status-dot" />
                Operational
              </div>
              <p className="ncc-banner__desc">All network nodes are responding normally.</p>

              <div className="ncc-banner__metrics">
                <div className="ncc-banner__metric">
                  <div className="ncc-banner__metric-value">{NODES_ONLINE} / {NODES_TOTAL}</div>
                  <div className="ncc-banner__metric-label">Nodes Online</div>
                </div>
                <div className="ncc-banner__metric">
                  <div className="ncc-banner__metric-value">{NODES[0].uptime}</div>
                  <div className="ncc-banner__metric-label">Network Uptime</div>
                </div>
                <div className="ncc-banner__metric">
                  <div className="ncc-banner__metric-value">#{TRANSACTIONS_TOTAL}</div>
                  <div className="ncc-banner__metric-label">Latest Transaction</div>
                </div>
                <div className="ncc-banner__metric">
                  <div className="ncc-banner__metric-value">25 mins ago</div>
                  <div className="ncc-banner__metric-label">Last Activity</div>
                </div>
              </div>
            </div>

            <div className="ncc-banner__right">
              <div className="ncc-banner__env">
                <span className="ncc-banner__env-label">Environment</span>
                <select
                  className="ncc-banner__env-select"
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                >
                  {/* <option value="Staging">Staging</option> */}
                  <option value="Production">Production</option>
                </select>
              </div>

              <div className="ncc-banner__activity">
                <span className="ncc-banner__activity-label">Live Network Activity</span>
                <Sparkline values={[18, 22, 19, 26, 24, 30, 27, 33, 29, 35, 31, 38]} color={NCC_GREEN} width={140} height={36} />
                <span className="ncc-banner__activity-status">
                  <Radio size={11} />
                  Normal
                </span>
              </div>

              <div className="ncc-banner__globe" aria-hidden>
                <Globe size={104} strokeWidth={0.75} />
              </div>
            </div>
          </section>

          {/* Six headline stat cards */}
          <div className="ncc-stats-grid ncc-stats-grid--6">
            {STAT_CARDS.map((card) => (
              <div className="ncc-stat-card" key={card.label}>
                <div className="ncc-stat-card__top">
                  <div className="ncc-stat-card__icon" style={{ backgroundColor: card.bg, color: card.color }}>
                    <card.icon size={18} />
                  </div>
                  {card.trend ? (
                    <span className="ncc-stat-card__trend">
                      <TrendingUp size={11} />
                      {card.trend}
                    </span>
                  ) : (
                    <span className="ncc-stat-card__trend ncc-stat-card__trend--flat">—</span>
                  )}
                </div>
                <div>
                  <div className="ncc-stat-card__number">{card.value.toLocaleString()}</div>
                  <div className="ncc-stat-card__label">{card.label}</div>
                </div>
                <Sparkline values={card.spark} color={card.color} width={110} height={26} />
              </div>
            ))}
          </div>

          {/* Transaction Activity + Transaction Distribution */}
          <div className="ncc-grid-2">
            <div className="ncc-panel">
              <div className="ncc-panel__header">
                <div className="ncc-panel__header-left">
                  <div className="ncc-panel__icon">
                    <ArrowLeftRight size={18} />
                  </div>
                  <div>
                    <h2 className="ncc-panel__title">Transaction Activity</h2>
                    <p className="ncc-panel__subtitle">Total transactions over time</p>
                  </div>
                </div>
                <RangeToggle value={txnRange} onChange={setTxnRange} options={TXN_RANGE_OPTIONS.map((id) => ({ id, label: id }))} />
              </div>

              <div className="ncc-panel__headline">
                <span className="ncc-panel__headline-value">{txnPeriodTotal.toLocaleString()}</span>
                <span className={`ncc-panel__headline-trend ${txnPeriodTrend < 0 ? 'ncc-panel__headline-trend--down' : ''}`}>
                  <TrendingUp size={13} />
                  {txnPeriodTrend >= 0 ? '+' : ''}
                  {txnPeriodTrend}%
                </span>
                <span className="ncc-panel__headline-label">transactions in this period</span>
              </div>

              <LineChart labels={txnData.labels} values={txnData.values} color={NCC_GREEN} valueLabel="Transactions" />
            </div>

            <div className="ncc-panel">
              <div className="ncc-panel__header">
                <div className="ncc-panel__header-left">
                  <div className="ncc-panel__icon">
                    <FileText size={18} />
                  </div>
                  <div>
                    <h2 className="ncc-panel__title">Transaction Distribution</h2>
                    <p className="ncc-panel__subtitle">Breakdown by transaction type</p>
                  </div>
                </div>
              </div>

              <DonutChart segments={DISTRIBUTION_SEGMENTS} centerValue={TRANSACTIONS_TOTAL.toLocaleString()} centerLabel="Transactions" />
            </div>
          </div>

          {/* Network Adoption + Credential Activity + Service Lifecycle */}
          <div className="ncc-grid-3">
            <div className="ncc-panel">
              <div className="ncc-panel__header">
                <div className="ncc-panel__header-left">
                  <div className="ncc-panel__icon" style={{ backgroundColor: 'rgba(167, 139, 250, 0.14)', color: NCC_PURPLE }}>
                    <UsersRound size={18} />
                  </div>
                  <div>
                    <h2 className="ncc-panel__title">Network Adoption</h2>
                    <p className="ncc-panel__subtitle">Holder connections over time</p>
                  </div>
                </div>
              </div>
              <RangeToggle
                value={holderRange}
                onChange={setHolderRange}
                options={[
                  { id: 'daily', label: 'Daily' },
                  { id: 'weekly', label: 'Weekly' },
                  { id: 'monthly', label: 'Monthly' },
                ]}
              />

              <div className="ncc-panel__headline ncc-panel__headline--compact">
                <span className="ncc-panel__headline-value">{totalHolders}</span>
                <span className={`ncc-panel__headline-trend ${holderTrend < 0 ? 'ncc-panel__headline-trend--down' : ''}`}>
                  <TrendingUp size={13} />
                  {holderTrend >= 0 ? '+' : ''}
                  {holderTrend}%
                </span>
                <span className="ncc-panel__headline-label">total holders</span>
              </div>

              <LineChart labels={holderData.labels} values={holderData.values} color={NCC_PURPLE} valueLabel="Holders" />
            </div>

            <div className="ncc-panel">
              <div className="ncc-panel__header">
                <div className="ncc-panel__header-left">
                  <div className="ncc-panel__icon" style={{ backgroundColor: 'rgba(107, 143, 112, 0.16)', color: NCC_MUTED_GREEN }}>
                    <ClipboardList size={18} />
                  </div>
                  <div>
                    <h2 className="ncc-panel__title">Credential Activity</h2>
                    <p className="ncc-panel__subtitle">Credentials issued over time</p>
                  </div>
                </div>
              </div>
              <RangeToggle
                value={credentialRange}
                onChange={setCredentialRange}
                options={[
                  { id: 'daily', label: 'Daily' },
                  { id: 'weekly', label: 'Weekly' },
                  { id: 'monthly', label: 'Monthly' },
                ]}
              />

              <div className="ncc-panel__headline ncc-panel__headline--compact">
                <span className="ncc-panel__headline-value">{credentialPeriodTotal}</span>
                <span className={`ncc-panel__headline-trend ${credentialPeriodTrend < 0 ? 'ncc-panel__headline-trend--down' : ''}`}>
                  <TrendingUp size={13} />
                  {credentialPeriodTrend >= 0 ? '+' : ''}
                  {credentialPeriodTrend}%
                </span>
                <span className="ncc-panel__headline-label">credentials issued</span>
              </div>

              <SingleBarChart labels={credentialData.labels} values={credentialData.values} color={NCC_MUTED_GREEN} />
            </div>

            <div className="ncc-panel">
              <div className="ncc-panel__header">
                <div className="ncc-panel__header-left">
                  <div className="ncc-panel__icon">
                    <Settings2 size={18} />
                  </div>
                  <div>
                    <h2 className="ncc-panel__title">Service Lifecycle</h2>
                    <p className="ncc-panel__subtitle">Created vs Published services</p>
                  </div>
                </div>
              </div>

              <div className="ncc-lifecycle-numbers">
                <div>
                  <div className="ncc-lifecycle-numbers__value" style={{ color: NCC_GREEN }}>
                    {servicePeriodCreated}
                  </div>
                  <div className="ncc-lifecycle-numbers__label">Created</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="ncc-lifecycle-numbers__value" style={{ color: NCC_PURPLE }}>
                    {servicePeriodPublished}
                  </div>
                  <div className="ncc-lifecycle-numbers__label">Published</div>
                </div>
              </div>

              <div className="ncc-lifecycle-bar">
                <div
                  className="ncc-lifecycle-bar__segment"
                  style={{ width: `${(servicePeriodCreated / (servicePeriodCreated + servicePeriodPublished || 1)) * 100}%`, backgroundColor: NCC_GREEN }}
                />
                <div
                  className="ncc-lifecycle-bar__segment"
                  style={{ width: `${(servicePeriodPublished / (servicePeriodCreated + servicePeriodPublished || 1)) * 100}%`, backgroundColor: NCC_PURPLE }}
                />
              </div>

              <RangeToggle
                value={serviceRange}
                onChange={setServiceRange}
                options={[
                  { id: 'daily', label: 'Daily' },
                  { id: 'weekly', label: 'Weekly' },
                  { id: 'monthly', label: 'Monthly' },
                ]}
              />

              <GroupedBarChart labels={serviceData.labels} created={serviceData.created} published={serviceData.published} />
            </div>
          </div>

          {/* Network Topology + Insights / Recent Ledger Activity */}
          <div className="ncc-grid-2 ncc-grid-2--bottom ncc-grid-2--stretch">
            <div className="ncc-panel ncc-panel--fill">
              <div className="ncc-panel__header">
                <div className="ncc-panel__header-left">
                  <div className="ncc-panel__icon">
                    <Boxes size={18} />
                  </div>
                  <div>
                    <h2 className="ncc-panel__title">Network Topology</h2>
                    <p className="ncc-panel__subtitle">Live view of network nodes</p>
                  </div>
                </div>
                <span className="ncc-topology__ratio-badge">
                  {NODES_ONLINE} / {NODES_TOTAL} Nodes Connected
                </span>
              </div>

              <div className="ncc-topology">
                <svg className="ncc-topology__lines" viewBox="0 0 300 300" preserveAspectRatio="none" aria-hidden>
                  <line x1="150" y1="150" x2="50" y2="50" stroke="#c7d2fe" strokeWidth="1.5" strokeDasharray="3 4" />
                  <line x1="150" y1="150" x2="150" y2="50" stroke="#c7d2fe" strokeWidth="1.5" strokeDasharray="3 4" />
                  <line x1="150" y1="150" x2="250" y2="50" stroke="#c7d2fe" strokeWidth="1.5" strokeDasharray="3 4" />
                  <line x1="150" y1="150" x2="50" y2="150" stroke="#c7d2fe" strokeWidth="1.5" strokeDasharray="3 4" />
                  <line x1="150" y1="150" x2="250" y2="150" stroke="#c7d2fe" strokeWidth="1.5" strokeDasharray="3 4" />
                  <line x1="150" y1="150" x2="50" y2="250" stroke="#c7d2fe" strokeWidth="1.5" strokeDasharray="3 4" />
                  <line x1="150" y1="150" x2="150" y2="250" stroke="#c7d2fe" strokeWidth="1.5" strokeDasharray="3 4" />
                  <line x1="150" y1="150" x2="250" y2="250" stroke="#c7d2fe" strokeWidth="1.5" strokeDasharray="3 4" />
                </svg>

                <div className="ncc-topology__grid">
                  {NODES.slice(0, 4).map((node) => (
                    <div className="ncc-topology__node" key={node.alias}>
                      <span className="ncc-topology__node-name">{node.alias}</span>
                      <span className={`ncc-topology__node-status ${node.status === 'Offline' ? 'ncc-topology__node-status--offline' : ''}`}>
                        <span className={`ncc-topology__dot ${node.status === 'Offline' ? 'ncc-topology__dot--offline' : ''}`} />
                        {node.status}
                      </span>
                      <span className="ncc-topology__node-addr">
                        {node.nodeIp}:{node.port}
                      </span>
                    </div>
                  ))}

                  <div className="ncc-topology__hub">
                    <img src={dtakLogo} alt="" className="ncc-topology__hub-logo" />
                    <span>DTAK</span>
                  </div>

                  {NODES.slice(4, 8).map((node) => (
                    <div className="ncc-topology__node" key={node.alias}>
                      <span className="ncc-topology__node-name">{node.alias}</span>
                      <span className={`ncc-topology__node-status ${node.status === 'Offline' ? 'ncc-topology__node-status--offline' : ''}`}>
                        <span className={`ncc-topology__dot ${node.status === 'Offline' ? 'ncc-topology__dot--offline' : ''}`} />
                        {node.status}
                      </span>
                      <span className="ncc-topology__node-addr">
                        {node.nodeIp}:{node.port}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="ncc-topology__footnote">+{NODES_TOTAL - NODES.length} more nodes across the network</div>
              </div>
            </div>

            <div className="ncc-stack">
              <div className="ncc-panel">
                <div className="ncc-panel__header">
                  <div className="ncc-panel__header-left">
                    <div className="ncc-panel__icon">
                      <ArrowLeftRight size={18} />
                    </div>
                    <div>
                      <h2 className="ncc-panel__title">Network Insights</h2>
                      <p className="ncc-panel__subtitle">Key highlights from network activity</p>
                    </div>
                  </div>
                </div>

                <div className="ncc-insights">
                  <div className="ncc-insight-tile">
                    <span className="ncc-insight-tile__icon" style={{ backgroundColor: 'rgba(143, 191, 63, 0.14)', color: NCC_GREEN }}>
                      <TrendingUp size={16} />
                    </span>
                    <div className="ncc-insight-tile__value">{peakTxn.value} transactions</div>
                    <div className="ncc-insight-tile__label">Peak transaction activity</div>
                    <div className="ncc-insight-tile__meta">{peakTxn.label}</div>
                  </div>
                  <div className="ncc-insight-tile">
                    <span className="ncc-insight-tile__icon" style={{ backgroundColor: 'rgba(107, 143, 112, 0.16)', color: NCC_MUTED_GREEN }}>
                      <UsersRound size={16} />
                    </span>
                    <div className="ncc-insight-tile__value">{peakCredential.value} credentials</div>
                    <div className="ncc-insight-tile__label">Highest credential issuance</div>
                    <div className="ncc-insight-tile__meta">{peakCredential.label}</div>
                  </div>
                  <div className="ncc-insight-tile">
                    <span className="ncc-insight-tile__icon" style={{ backgroundColor: 'rgba(242, 169, 59, 0.14)', color: NCC_AMBER }}>
                      <Clock size={16} />
                    </span>
                    <div className="ncc-insight-tile__value">{NODES[0].uptime.split(',')[0]}</div>
                    <div className="ncc-insight-tile__label">Network uptime</div>
                    <div className="ncc-insight-tile__meta">and counting</div>
                  </div>
                </div>
              </div>

              <div className="ncc-panel">
                <div className="ncc-panel__header">
                  <div className="ncc-panel__header-left">
                    <div className="ncc-panel__icon">
                      <ClipboardList size={18} />
                    </div>
                    <div>
                      <h2 className="ncc-panel__title">Recent Ledger Activity</h2>
                      <p className="ncc-panel__subtitle">Latest transactions on the network</p>
                    </div>
                  </div>
                  <span className="ncc-view-all">
                    View all <ArrowUpRight size={13} />
                  </span>
                </div>

                <table className="ncc-ledger-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Type</th>
                      <th>Transaction ID</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RECENT_LEDGER.map((row) => (
                      <tr key={row.seq}>
                        <td>{row.seq}</td>
                        <td>
                          <span className="ncc-ledger-badge" style={{ backgroundColor: `${row.color}18`, color: row.color }}>
                            {row.type}
                          </span>
                        </td>
                        <td className="ncc-ledger-table__id">{row.txnId}</td>
                        <td className="ncc-ledger-table__time">{row.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Last Transaction detail (existing panel, kept for the copyable full txn id) */}
          <div className="ncc-panel">
            <div className="ncc-panel__header">
              <div className="ncc-panel__header-left">
                <div className="ncc-panel__icon">
                  <ArrowLeftRight size={18} />
                </div>
                <div>
                  <h2 className="ncc-panel__title">Last Transaction</h2>
                  <p className="ncc-panel__subtitle">Most recent ledger entry</p>
                </div>
              </div>
            </div>

            <div className="ncc-txn-id-row">
              <div className="ncc-txn-id-row__left">
                <span className="ncc-txn-id-row__label">Txn Id</span>
                <span className="ncc-txn-id-row__value">{txnId}</span>
              </div>
              <button type="button" className="ncc-copy-btn" onClick={handleCopyTxn} title="Copy transaction ID">
                <Copy size={15} />
              </button>
            </div>
            {copied && <div style={{ fontSize: 12, color: NCC_GREEN, marginTop: -8, marginBottom: 8 }}>Copied!</div>}

            <div className="ncc-txn-grid">
              <div className="ncc-txn-field">
                <div className="ncc-txn-field__label">Tx Date</div>
                <div className="ncc-txn-field__value">2026-09-14 09:00:02</div>
              </div>
              <div className="ncc-txn-field">
                <div className="ncc-txn-field__label">Tx Type</div>
                <div className="ncc-txn-field__value ncc-txn-field__value--link">NYM</div>
              </div>
              <div className="ncc-txn-field">
                <div className="ncc-txn-field__label">Tx Sq No</div>
                <div className="ncc-txn-field__value">{TRANSACTIONS_TOTAL}</div>
              </div>
              <div className="ncc-txn-field">
                <div className="ncc-txn-field__label">Time Ago</div>
                <div className="ncc-txn-field__value">25 mins, 16 secs ago</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
