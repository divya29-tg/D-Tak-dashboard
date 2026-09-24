import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Users,
  MapPin,
  UserCheck,
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
  ArrowUpRight,
  Boxes,
  Globe,
} from 'lucide-react';
import { ROUTES } from '@/app/router/routes';
import dtakLogo from '@/assets/dtak-logo.png';
import trustgridLogo from '@/assets/trustgrid-logo.png';
import { getAdminProfile } from '@/utils/adminProfile';
import { useAuth } from '@/app/router/AppRouter';
import { nccService, type NccDateCount, type NccKpiCounts, type NccLedgerTx, type NccNetworkStatus, type NccPoolNode, type NccServiceLifecycle } from '@/services/api/ncc';
import './NCCScreen.css';

type RangeMode = 'daily' | 'weekly' | 'monthly';

const EMPTY_KPI_COUNTS: NccKpiCounts = {
  transactions: null,
  services: null,
  claimDefinitions: null,
  schemas: null,
  issuers: null,
  verifiers: null,
};

const formatCount = (n: number | null) => (n === null ? '—' : n.toLocaleString());

// DTAK design-token colors (see the --ncc-* CSS variables in NCCScreen.css).
const NCC_GREEN = '#8fbf3f';
const NCC_PURPLE = '#a78bfa';
const NCC_MUTED_GREEN = '#6b8f70';
const NCC_AMBER = '#f2a93b';
const NCC_BLUE = '#3b82f6';
const NCC_RED = '#e5484d';
const NCC_TEXT_SECONDARY = '#9ca3af';
const NCC_TEXT_TERTIARY = '#6b7280';

const NCC_EXPLORER_URL = (import.meta.env.VITE_NCC_EXPLORER_URL || 'https://explorer.staging.trustgrid.com').replace(/\/$/, '');
const NCC_EXPLORER_LEDGER = import.meta.env.VITE_NCC_EXPLORER_LEDGER || 'TrustGridDev';
const NCC_EXPLORER_HOME_URL = `${NCC_EXPLORER_URL}/home/${NCC_EXPLORER_LEDGER}`;

/** Explorer domain-ledger tx list, optionally filtered to the given tx type names (e.g. SCHEMA). */
const explorerTxsUrl = (txNames: string[] = []) =>
  `${NCC_EXPLORER_URL}/txs/${NCC_EXPLORER_LEDGER}/domain?${new URLSearchParams({
    page: '1',
    pageSize: '50',
    filterTxNames: JSON.stringify(txNames),
    sortFromRecent: 'true',
  })}`;

const STAT_CARDS = [
  { icon: Share2, key: 'transactions' as const, explorerUrl: explorerTxsUrl(), label: 'Transactions', trend: '18%', color: NCC_GREEN, bg: 'rgba(143, 191, 63, 0.14)', spark: [12, 15, 14, 18, 22, 20, 25, 28, 26, 31] },
  { icon: Building2, key: 'services' as const, explorerUrl: null, label: 'Services', trend: '8%', color: NCC_PURPLE, bg: 'rgba(167, 139, 250, 0.14)', spark: [20, 22, 21, 24, 23, 26, 28, 27, 30, 32] },
  { icon: ClipboardList, key: 'claimDefinitions' as const, explorerUrl: explorerTxsUrl(['CLAIM_DEF']), label: 'Claim Definitions', trend: '6%', color: NCC_AMBER, bg: 'rgba(242, 169, 59, 0.14)', spark: [30, 29, 31, 33, 32, 35, 34, 37, 39, 38] },
  { icon: FileText, key: 'schemas' as const, explorerUrl: explorerTxsUrl(['SCHEMA']), label: 'Schemas', trend: '4%', color: NCC_MUTED_GREEN, bg: 'rgba(107, 143, 112, 0.16)', spark: [40, 41, 40, 42, 44, 43, 45, 46, 45, 47] },
  { icon: ShieldCheck, key: 'issuers' as const, explorerUrl: null, label: 'Issuers', trend: '7%', color: NCC_BLUE, bg: 'rgba(59, 130, 246, 0.14)', spark: [4, 5, 5, 6, 6, 7, 8, 8, 9, 10] },
  { icon: UserCheck, key: 'verifiers' as const, explorerUrl: null, label: 'Verifier', trend: null, color: NCC_TEXT_SECONDARY, bg: 'rgba(156, 163, 175, 0.12)', spark: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
];

type NodeStatus = 'Operational' | 'Offline' | 'Unknown';

interface NodeInfo extends NccPoolNode {
  uptimeSecs: number | null;
  status: NodeStatus;
}

/** Pool-ledger nodes joined with validator-info: reachable → Operational. */
function buildNodes(pool: NccPoolNode[], network: NccNetworkStatus | null): NodeInfo[] {
  const reachable = new Set(network?.reachable ?? []);
  return pool.map((node) => ({
    ...node,
    uptimeSecs: network?.validators.find((v) => v.name === node.alias)?.uptimeSecs ?? null,
    status: !network ? 'Unknown' : reachable.has(node.alias) ? 'Operational' : 'Offline',
  }));
}

/** "492 days, 4 hours" from a number of seconds. */
function formatUptime(secs: number | null) {
  if (secs === null) return '—';
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;
  const days = Math.floor(secs / 86_400);
  const hours = Math.floor((secs % 86_400) / 3_600);
  if (days > 0) return `${plural(days, 'day')}, ${plural(hours, 'hour')}`;
  return `${plural(hours, 'hour')}, ${plural(Math.floor((secs % 3_600) / 60), 'min')}`;
}

// Topology is a 3x3 grid with the DTAK hub in cell 4; nodes fill the ring
// cells, using the top/left/right/bottom cross first when there are few.
const TOPOLOGY_HUB_CELL = 4;
const TOPOLOGY_CROSS_CELLS = [1, 3, 5, 7];
const TOPOLOGY_RING_CELLS = [0, 1, 2, 3, 5, 6, 7, 8];
const TOPOLOGY_MAX_NODES = TOPOLOGY_RING_CELLS.length;

function topologyCells(nodes: NodeInfo[]): (NodeInfo | 'hub' | null)[] {
  const shown = nodes.slice(0, TOPOLOGY_MAX_NODES);
  const slots = shown.length <= TOPOLOGY_CROSS_CELLS.length ? TOPOLOGY_CROSS_CELLS : TOPOLOGY_RING_CELLS;
  const cells: (NodeInfo | 'hub' | null)[] = Array.from({ length: 9 }, () => null);
  cells[TOPOLOGY_HUB_CELL] = 'hub';
  shown.forEach((node, i) => {
    cells[slots[i]] = node;
  });
  return cells;
}

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

// Network Adoption, Credential Activity + Service Lifecycle: fetch daily counts once over a long
// range and bucket them client-side, so Daily/Weekly/Monthly share one request.
const NCC_HISTORY_START_DATE = '2024-12-01';
const HOLDER_WINDOW: Record<RangeMode, number> = { daily: 14, weekly: 8, monthly: 6 };
const SERVICE_WINDOW: Record<RangeMode, number> = { daily: 7, weekly: 6, monthly: 6 };
const CREDENTIAL_WINDOW: Record<RangeMode, number> = { daily: 14, weekly: 8, monthly: 6 };

const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);

/** UTC start of the i-th bucket back from the one containing `today` (day, Monday-start week, or month). */
function bucketStart(today: Date, mode: RangeMode, stepsBack: number): Date {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const d = today.getUTCDate();
  if (mode === 'monthly') return new Date(Date.UTC(y, m - stepsBack, 1));
  if (mode === 'weekly') return new Date(Date.UTC(y, m, d - ((today.getUTCDay() + 6) % 7) - stepsBack * 7));
  return new Date(Date.UTC(y, m, d - stepsBack));
}

/** The last `size` buckets ending with the one containing `today`, as ISO start/end dates plus axis labels. */
function buildBuckets(mode: RangeMode, today: Date, size: number) {
  const starts = Array.from({ length: size + 1 }, (_, i) => bucketStart(today, mode, size - 1 - i));
  return starts.slice(0, size).map((s, i) => ({
    start: toIsoDate(s),
    end: toIsoDate(starts[i + 1]),
    label:
      mode === 'monthly'
        ? s.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
        : `${s.getUTCMonth() + 1}/${s.getUTCDate()}`,
  }));
}

const countInRange = (rows: NccDateCount[], from: string | null, to: string) =>
  sumOf(rows.filter((r) => (from === null || r.date >= from) && r.date < to).map((r) => r.count));

/** Cumulative holder total at the end of each bucket. */
function buildHolderSeries(daily: NccDateCount[], mode: RangeMode, today: Date) {
  const buckets = buildBuckets(mode, today, HOLDER_WINDOW[mode]);
  return { labels: buckets.map((b) => b.label), values: buckets.map((b) => countInRange(daily, null, b.end)) };
}

/** Credentials issued within each bucket. */
function buildCredentialSeries(daily: NccDateCount[], mode: RangeMode, today: Date) {
  const buckets = buildBuckets(mode, today, CREDENTIAL_WINDOW[mode]);
  return { labels: buckets.map((b) => b.label), values: buckets.map((b) => countInRange(daily, b.start, b.end)) };
}

/** Services created / published within each bucket. */
function buildServiceSeries(lifecycle: NccServiceLifecycle, mode: RangeMode, today: Date) {
  const buckets = buildBuckets(mode, today, SERVICE_WINDOW[mode]);
  return {
    labels: buckets.map((b) => b.label),
    created: buckets.map((b) => countInRange(lifecycle.created, b.start, b.end)),
    published: buckets.map((b) => countInRange(lifecycle.published, b.start, b.end)),
  };
}


// Display label + color per ledger typeName; anything unlisted falls under "Other".
const TXN_TYPE_META: Record<string, { label: string; color: string }> = {
  NYM: { label: 'NYM', color: NCC_GREEN },
  SCHEMA: { label: 'Schema', color: NCC_PURPLE },
  CLAIM_DEF: { label: 'Claim Definition', color: NCC_AMBER },
  ATTRIB: { label: 'Attribute', color: NCC_MUTED_GREEN },
  REVOC_REG_DEF: { label: 'Revocation Registry', color: NCC_RED },
  REVOC_REG_ENTRY: { label: 'Revocation Entry', color: NCC_RED },
};
const txnTypeMeta = (type: string) => TXN_TYPE_META[type] ?? { label: type, color: NCC_TEXT_TERTIARY };

/** Segment per transaction type, largest first. */
function buildDistribution(txs: NccLedgerTx[]) {
  const counts = new Map<string, number>();
  txs.forEach((t) => counts.set(t.type, (counts.get(t.type) ?? 0) + 1));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, value]) => ({ ...txnTypeMeta(type), value }));
}

const TXN_ACTIVITY_HOURS = 24;
const TXN_ACTIVITY_BUCKET_HOURS = 2;
const HOUR_MS = 3_600_000;

/** Transactions per 2-hour bucket over the last 24 hours, ending at the current hour. */
function buildTxnActivity(txs: NccLedgerTx[], now: Date) {
  const end = Math.ceil(now.getTime() / HOUR_MS) * HOUR_MS;
  const size = TXN_ACTIVITY_HOURS / TXN_ACTIVITY_BUCKET_HOURS;
  const starts = Array.from({ length: size }, (_, i) => end - (size - i) * TXN_ACTIVITY_BUCKET_HOURS * HOUR_MS);
  const values = starts.map((start) => {
    const stop = start + TXN_ACTIVITY_BUCKET_HOURS * HOUR_MS;
    return txs.filter((t) => {
      const time = Date.parse(t.txnTime);
      return time >= start && time < stop;
    }).length;
  });
  const labels = starts.map((start) => {
    const d = new Date(start);
    return `${String(d.getHours()).padStart(2, '0')}:00`;
  });
  // The API only returns the latest 50 txs, so if the oldest one is inside the
  // window, earlier buckets may be missing transactions.
  const oldest = txs[txs.length - 1];
  const complete = !oldest || Date.parse(oldest.txnTime) < starts[0];
  return { labels, values, complete };
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const formatTxnDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};

/** "25 mins, 16 secs ago" style relative time. */
function formatTimeAgo(iso: string, now: number, withSeconds = false) {
  const secs = Math.max(0, Math.floor((now - Date.parse(iso)) / 1000));
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;
  if (secs < 60) return `${plural(secs, 'sec')} ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return withSeconds ? `${plural(mins, 'min')}, ${plural(secs % 60, 'sec')} ago` : `${plural(mins, 'min')} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return withSeconds ? `${plural(hours, 'hour')}, ${plural(mins % 60, 'min')} ago` : `${plural(hours, 'hour')} ago`;
  return `${plural(Math.floor(hours / 24), 'day')} ago`;
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

  const [holderRange, setHolderRange] = useState<RangeMode>('monthly');
  const [serviceRange, setServiceRange] = useState<RangeMode>('weekly');
  const [credentialRange, setCredentialRange] = useState<RangeMode>('weekly');
  const [environment, setEnvironment] = useState('Staging');
  const [copied, setCopied] = useState(false);
  const [kpiCounts, setKpiCounts] = useState<NccKpiCounts>(EMPTY_KPI_COUNTS);
  const [holderDaily, setHolderDaily] = useState<NccDateCount[] | null>(null);
  const [serviceLifecycle, setServiceLifecycle] = useState<NccServiceLifecycle | null>(null);
  const [credentialDaily, setCredentialDaily] = useState<NccDateCount[] | null>(null);
  const [ledgerTxs, setLedgerTxs] = useState<NccLedgerTx[] | null>(null);
  const [poolNodes, setPoolNodes] = useState<NccPoolNode[] | null>(null);
  const [networkStatus, setNetworkStatus] = useState<NccNetworkStatus | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    nccService.getKpiCounts().then((counts) => {
      if (!cancelled) setKpiCounts(counts);
    });
    nccService
      .getHolderCounts(NCC_HISTORY_START_DATE, toIsoDate(new Date()), 'day')
      .then((rows) => {
        if (!cancelled) setHolderDaily(rows);
      })
      .catch((err) => console.error('Failed to load holder counts', err));
    nccService
      .getServiceLifecycleCounts(NCC_HISTORY_START_DATE, toIsoDate(new Date()), 'day')
      .then((lifecycle) => {
        if (!cancelled) setServiceLifecycle(lifecycle);
      })
      .catch((err) => console.error('Failed to load service lifecycle counts', err));
    nccService
      .getIssuedCredentialCounts(NCC_HISTORY_START_DATE, toIsoDate(new Date()), 'day')
      .then((rows) => {
        if (!cancelled) setCredentialDaily(rows);
      })
      .catch((err) => console.error('Failed to load issued credential counts', err));
    nccService
      .getDomainTxs()
      .then((txs) => {
        if (!cancelled) setLedgerTxs(txs);
      })
      .catch((err) => console.error('Failed to load domain transactions', err));
    nccService
      .getPoolNodes()
      .then((nodes) => {
        if (!cancelled) setPoolNodes(nodes);
      })
      .catch((err) => console.error('Failed to load pool nodes', err));
    nccService
      .getNetworkStatus()
      .then((status) => {
        if (!cancelled) setNetworkStatus(status);
      })
      .catch((err) => console.error('Failed to load network status', err));
    return () => {
      cancelled = true;
    };
  }, []);

  // Keeps the "time ago" labels current.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const txnData = useMemo(() => buildTxnActivity(ledgerTxs ?? [], new Date()), [ledgerTxs]);
  const distribution = useMemo(() => buildDistribution(ledgerTxs ?? []), [ledgerTxs]);
  const lastTxn = ledgerTxs?.[0] ?? null;

  const nodes = useMemo(() => buildNodes(poolNodes ?? [], networkStatus), [poolNodes, networkStatus]);
  const nodesOnline = nodes.filter((n) => n.status === 'Operational').length;
  const nodesLabel = poolNodes && networkStatus ? `${nodesOnline} / ${nodes.length}` : poolNodes ? `— / ${nodes.length}` : '—';
  const allNodesUp = poolNodes !== null && networkStatus !== null && nodesOnline === nodes.length;
  const networkUptimeSecs = networkStatus?.validators.length
    ? Math.max(...networkStatus.validators.map((v) => v.uptimeSecs ?? 0))
    : null;
  const topology = topologyCells(nodes);
  const holderData = useMemo(
    () => buildHolderSeries(holderDaily ?? [], holderRange, new Date()),
    [holderDaily, holderRange]
  );
  const serviceData = useMemo(
    () => buildServiceSeries(serviceLifecycle ?? { created: [], published: [] }, serviceRange, new Date()),
    [serviceLifecycle, serviceRange]
  );
  const credentialData = useMemo(
    () => buildCredentialSeries(credentialDaily ?? [], credentialRange, new Date()),
    [credentialDaily, credentialRange]
  );

  // Headline totals + trends recomputed per panel from whichever range is
  // currently selected there, so switching Daily/Weekly/Monthly (or
  // 24H/7D/30D/3M/1Y) visibly changes more than just the chart shape.
  const txnPeriodTotal = useMemo(() => sumOf(txnData.values), [txnData]);

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
    if (!lastTxn) return;
    try {
      await navigator.clipboard.writeText(lastTxn.txnId);
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
                {!networkStatus ? 'Checking…' : allNodesUp ? 'Operational' : 'Degraded'}
              </div>
              <p className="ncc-banner__desc">
                {!networkStatus || !poolNodes
                  ? 'Checking network node status…'
                  : allNodesUp
                    ? 'All network nodes are responding normally.'
                    : `${nodes.length - nodesOnline} of ${nodes.length} nodes are not reachable.`}
              </p>

              <div className="ncc-banner__metrics">
                <div className="ncc-banner__metric">
                  <div className="ncc-banner__metric-value">{nodesLabel}</div>
                  <div className="ncc-banner__metric-label">Nodes Online</div>
                </div>
                <div className="ncc-banner__metric">
                  <div className="ncc-banner__metric-value">{formatUptime(networkUptimeSecs)}</div>
                  <div className="ncc-banner__metric-label">Network Uptime</div>
                </div>
                <div className="ncc-banner__metric">
                  <div className="ncc-banner__metric-value">#{lastTxn ? lastTxn.seqNo : formatCount(kpiCounts.transactions)}</div>
                  <div className="ncc-banner__metric-label">Latest Transaction</div>
                </div>
                <div className="ncc-banner__metric">
                  <div className="ncc-banner__metric-value">{lastTxn ? formatTimeAgo(lastTxn.txnTime, now) : '—'}</div>
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

              <a className="ncc-banner__explorer-btn" href={NCC_EXPLORER_HOME_URL} target="_blank" rel="noopener noreferrer">
                <img src={trustgridLogo} alt="" className="ncc-banner__explorer-logo" />
                <span className="ncc-banner__explorer-text">
                  <span className="ncc-banner__explorer-title">TrustGrid Ledger</span>
                  <span className="ncc-banner__explorer-sub">Open explorer</span>
                </span>
                <ArrowUpRight size={15} />
              </a>

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
                  <div className="ncc-stat-card__top-right">
                    {card.trend ? (
                      <span className="ncc-stat-card__trend">
                        <TrendingUp size={11} />
                        {card.trend}
                      </span>
                    ) : (
                      <span className="ncc-stat-card__trend ncc-stat-card__trend--flat">—</span>
                    )}
                    {card.explorerUrl && (
                      <a
                        className="ncc-stat-card__link"
                        href={card.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`View ${card.label} in the TrustGrid Ledger Explorer`}
                        aria-label={`View ${card.label} in the TrustGrid Ledger Explorer`}
                      >
                        <ArrowUpRight size={14} />
                      </a>
                    )}
                  </div>
                </div>
                <div>
                  <div className="ncc-stat-card__number">{formatCount(kpiCounts[card.key])}</div>
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
                    <p className="ncc-panel__subtitle">Transactions in the last 24 hours</p>
                  </div>
                </div>
              </div>

              <div className="ncc-panel__headline">
                <span className="ncc-panel__headline-value">{ledgerTxs ? txnPeriodTotal.toLocaleString() : '—'}</span>
                <span className="ncc-panel__headline-label">
                  {txnData.complete ? 'transactions in the last 24h' : `of the latest ${ledgerTxs?.length ?? 0} transactions`}
                </span>
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
                    <p className="ncc-panel__subtitle">
                      Breakdown by type of the latest {ledgerTxs ? ledgerTxs.length : '—'} transactions
                    </p>
                  </div>
                </div>
              </div>

              <DonutChart segments={distribution} centerValue={ledgerTxs ? String(ledgerTxs.length) : '—'} centerLabel="Latest Txns" />
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
                <span className="ncc-panel__headline-value">{holderDaily ? totalHolders.toLocaleString() : '—'}</span>
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
                <span className="ncc-panel__headline-value">{credentialDaily ? credentialPeriodTotal.toLocaleString() : '—'}</span>
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
                    {serviceLifecycle ? servicePeriodCreated : '—'}
                  </div>
                  <div className="ncc-lifecycle-numbers__label">Created</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="ncc-lifecycle-numbers__value" style={{ color: NCC_PURPLE }}>
                    {serviceLifecycle ? servicePeriodPublished : '—'}
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
                  {nodesLabel} Nodes Connected
                </span>
              </div>

              <div className="ncc-topology">
                <svg className="ncc-topology__lines" viewBox="0 0 300 300" preserveAspectRatio="none" aria-hidden>
                  {topology.map((cell, i) =>
                    cell && cell !== 'hub' ? (
                      <line
                        key={i}
                        x1="150"
                        y1="150"
                        x2={(i % 3) * 100 + 50}
                        y2={Math.floor(i / 3) * 100 + 50}
                        stroke="#c7d2fe"
                        strokeWidth="1.5"
                        strokeDasharray="3 4"
                      />
                    ) : null
                  )}
                </svg>

                <div className="ncc-topology__grid">
                  {topology.map((cell, i) => {
                    if (cell === 'hub') {
                      return (
                        <div className="ncc-topology__hub" key="hub">
                          <img src={dtakLogo} alt="" className="ncc-topology__hub-logo" />
                          <span>DTAK</span>
                        </div>
                      );
                    }
                    if (!cell) return <div className="ncc-topology__empty" key={i} aria-hidden />;
                    const statusMod = cell.status === 'Operational' ? '' : ` ncc-topology__node-status--${cell.status.toLowerCase()}`;
                    const dotMod = cell.status === 'Operational' ? '' : ` ncc-topology__dot--${cell.status.toLowerCase()}`;
                    return (
                      <div className="ncc-topology__node" key={cell.alias} title={`DID ${cell.did} · uptime ${formatUptime(cell.uptimeSecs)}`}>
                        <span className="ncc-topology__node-name">{cell.alias}</span>
                        <span className={`ncc-topology__node-status${statusMod}`}>
                          <span className={`ncc-topology__dot${dotMod}`} />
                          {cell.status}
                        </span>
                        <span className="ncc-topology__node-addr">
                          {cell.nodeIp}:{cell.nodePort}
                        </span>
                        <span className="ncc-topology__node-addr">
                          {cell.services.join(', ') || '—'} · up {formatUptime(cell.uptimeSecs)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {nodes.length > TOPOLOGY_MAX_NODES && (
                  <div className="ncc-topology__footnote">+{nodes.length - TOPOLOGY_MAX_NODES} more nodes across the network</div>
                )}
                {!poolNodes && <div className="ncc-topology__footnote">Loading nodes…</div>}
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
                    <div className="ncc-insight-tile__value">{formatUptime(networkUptimeSecs).split(',')[0]}</div>
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
                  <a className="ncc-view-all" href={explorerTxsUrl()} target="_blank" rel="noopener noreferrer">
                    View all <ArrowUpRight size={13} />
                  </a>
                </div>

                <div className="ncc-ledger-table-wrap">
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
                    {(ledgerTxs ?? []).map((tx) => {
                      const meta = txnTypeMeta(tx.type);
                      return (
                        <tr key={tx.seqNo}>
                          <td>{tx.seqNo}</td>
                          <td>
                            <span className="ncc-ledger-badge" style={{ backgroundColor: `${meta.color}18`, color: meta.color }}>
                              {meta.label}
                            </span>
                          </td>
                          <td className="ncc-ledger-table__id" title={tx.txnId}>{tx.txnId}</td>
                          <td className="ncc-ledger-table__time" title={formatTxnDate(tx.txnTime)}>
                            {formatTimeAgo(tx.txnTime, now)}
                          </td>
                        </tr>
                      );
                    })}
                    {!ledgerTxs && (
                      <tr>
                        <td colSpan={4}>Loading transactions…</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                </div>
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
                <span className="ncc-txn-id-row__value">{lastTxn?.txnId ?? '—'}</span>
              </div>
              <button type="button" className="ncc-copy-btn" onClick={handleCopyTxn} title="Copy transaction ID">
                <Copy size={15} />
              </button>
            </div>
            {copied && <div style={{ fontSize: 12, color: NCC_GREEN, marginTop: -8, marginBottom: 8 }}>Copied!</div>}

            <div className="ncc-txn-grid">
              <div className="ncc-txn-field">
                <div className="ncc-txn-field__label">Tx Date</div>
                <div className="ncc-txn-field__value">{lastTxn ? formatTxnDate(lastTxn.txnTime) : '—'}</div>
              </div>
              <div className="ncc-txn-field">
                <div className="ncc-txn-field__label">Tx Type</div>
                <div className="ncc-txn-field__value ncc-txn-field__value--link">{lastTxn ? txnTypeMeta(lastTxn.type).label : '—'}</div>
              </div>
              <div className="ncc-txn-field">
                <div className="ncc-txn-field__label">Tx Sq No</div>
                <div className="ncc-txn-field__value">{lastTxn?.seqNo ?? '—'}</div>
              </div>
              <div className="ncc-txn-field">
                <div className="ncc-txn-field__label">Time Ago</div>
                <div className="ncc-txn-field__value">{lastTxn ? formatTimeAgo(lastTxn.txnTime, now, true) : '—'}</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
