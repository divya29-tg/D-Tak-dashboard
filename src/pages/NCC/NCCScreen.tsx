import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
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
  Globe,
  Hash,
  Copy,
  Calendar,
  HelpCircle,
} from 'lucide-react';
import { ROUTES } from '@/app/router/routes';
import dtakLogo from '@/assets/dtak-logo.png';
import { getAdminProfile } from '@/utils/adminProfile';
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

const STAT_CARDS = [
  { icon: Building2, value: 10, label: 'Issuers' },
  { icon: ShieldCheck, value: 1, label: 'Verifiers' },
  { icon: ArrowLeftRight, value: 25, label: 'Services' },
  { icon: FileText, value: 259, label: 'Schema Count' },
  { icon: ClipboardList, value: 261, label: 'Claim Definition Count' },
  { icon: Share2, value: 2944, label: 'All Transactions' },
];

interface NodeInfo {
  alias: string;
  port: number;
  nodeIp: string;
  service: string;
  did: string;
  uptime: string;
}

const NODES: NodeInfo[] = [
  { alias: 'Node1', port: 9701, nodeIp: '10.160.0.8', service: 'VALIDATOR', did: 'Gk3nWpXtRVYcPiab9s2Q', uptime: '482 days, 2 hours' },
  { alias: 'Node2', port: 9703, nodeIp: '10.160.0.8', service: 'VALIDATOR', did: 'EbP4aYNeTHL6q385GuVR', uptime: '482 days, 2 hours' },
  { alias: 'Node3', port: 9705, nodeIp: '10.160.0.8', service: 'VALIDATOR', did: '4cU41vWW82ArfxJXHkzP', uptime: '482 days, 2 hours' },
  { alias: 'Node4', port: 9707, nodeIp: '10.160.0.8', service: 'VALIDATOR', did: 'TWwCRQRZ2ZHMJFn9TzLp', uptime: '482 days, 2 hours' },
];

const CHART_W = 720;
const CHART_H = 240;
const CHART_PAD_L = 36;
const CHART_PAD_R = 12;
const CHART_PAD_T = 12;
const CHART_PAD_B = 28;

function RangeToggle({ value, onChange }: { value: RangeMode; onChange: (v: RangeMode) => void }) {
  const options: { id: RangeMode; label: string }[] = [
    { id: 'daily', label: 'Daily' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
  ];
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

function HolderAnalyticsChart({ labels, values }: { labels: string[]; values: number[] }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const maxVal = 60;
  const plotW = CHART_W - CHART_PAD_L - CHART_PAD_R;
  const plotH = CHART_H - CHART_PAD_T - CHART_PAD_B;

  const points = useMemo(
    () =>
      values.map((v, i) => ({
        x: CHART_PAD_L + (values.length === 1 ? plotW / 2 : (plotW * i) / (values.length - 1)),
        y: CHART_PAD_T + plotH - (v / maxVal) * plotH,
        v,
        label: labels[i],
      })),
    [values, labels, plotW, plotH]
  );

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(CHART_PAD_T + plotH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(CHART_PAD_T + plotH).toFixed(1)} Z`;

  const gridValues = [0, 10, 20, 30, 40, 50, 60];

  const showTooltip = (p: (typeof points)[number], evt: React.MouseEvent) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    setTooltip({
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top,
      title: p.label,
      rows: [{ label: 'Holder Connections', value: String(p.v), color: '#4f46e5' }],
    });
  };

  return (
    <div className="ncc-chart-wrap" ref={wrapRef} style={{ position: 'relative' }}>
      <svg
        className="ncc-svg-chart"
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        role="img"
        aria-label="Holder connections over time"
        onMouseLeave={() => setTooltip(null)}
      >
        <defs>
          <linearGradient id="ncc-holder-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridValues.map((gv) => {
          const y = CHART_PAD_T + plotH - (gv / maxVal) * plotH;
          return (
            <g key={gv}>
              <line x1={CHART_PAD_L} x2={CHART_W - CHART_PAD_R} y1={y} y2={y} stroke="#eef0f2" strokeWidth={1} strokeDasharray="3 4" />
              <text x={CHART_PAD_L - 10} y={y + 3} textAnchor="end" fontSize="10" fill="#9ca3af">
                {gv}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill="url(#ncc-holder-fill)" stroke="none" />
        <path d={linePath} fill="none" stroke="#4f46e5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={i === 0 || i === points.length - 1 ? 4 : 3}
            fill="#4f46e5"
            stroke="#ffffff"
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

function ServiceAnalyticsChart({
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

  const maxVal = Math.max(...created, ...published) * 1.25;
  const plotW = CHART_W - CHART_PAD_L - CHART_PAD_R;
  const plotH = CHART_H - CHART_PAD_T - CHART_PAD_B;
  const groupW = plotW / labels.length;
  const barW = Math.min(18, groupW / 3.2);

  const gridValues = useMemo(() => {
    const step = Math.ceil(maxVal / 4 / 5) * 5 || 5;
    return [0, step, step * 2, step * 3, step * 4];
  }, [maxVal]);
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
        { label: 'Created Service', value: String(c), color: '#4f46e5' },
        { label: 'Published Service', value: String(p), color: '#0d9488' },
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
              <line x1={CHART_PAD_L} x2={CHART_W - CHART_PAD_R} y1={y} y2={y} stroke="#eef0f2" strokeWidth={1} strokeDasharray="3 4" />
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
              <rect x={groupX - barW - 2} y={baseY - cH} width={barW} height={cH} rx={3} fill="#4f46e5" />
              <rect x={groupX + 2} y={baseY - pH} width={barW} height={pH} rx={3} fill="#0d9488" />
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

export function NCCScreen() {
  const navigate = useNavigate();
  const adminProfile = getAdminProfile();

  const [holderRange, setHolderRange] = useState<RangeMode>('monthly');
  const [serviceRange, setServiceRange] = useState<RangeMode>('weekly');
  const [fromDate] = useState('01/12/2024');
  const [toDate] = useState('14/09/2026');
  const [copied, setCopied] = useState(false);

  const holderData = HOLDER_DATASETS[holderRange];
  const serviceData = SERVICE_DATASETS[serviceRange];

  const txnId = 'f7a2c9e1b4d8365af0219cbe7a44d902e5f8c1b3a6d740fe982c1b5a03df66c';

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
              sessionStorage.removeItem('dtak_admin_id');
              sessionStorage.removeItem('dtak_admin_name');
              sessionStorage.removeItem('dtak_admin_role');
              navigate(ROUTES.LOGIN);
            }}
          >
            <span>Logout</span>
            <LogOut size={14} color="#E5484D" />
          </button>
        </div>
      </aside>

      {/* Main light-theme ledger dashboard */}
      <main className="ncc-main">
        <div className="ncc-topbar">
          <div className="ncc-topbar__left">
            <button type="button" className="ncc-back-btn" onClick={() => navigate(ROUTES.HOME)}>
              <ArrowLeft size={18} />
              <span>Back</span>
            </button>
            <h1 className="ncc-topbar__title">Gamma Consortium</h1>
          </div>
          <button type="button" className="ncc-ledger-badge">
            TrustGrid Ledger
          </button>
        </div>

        <div className="ncc-body">
          <div className="ncc-left-col">
            <div className="ncc-stats-grid">
              {STAT_CARDS.map((card) => (
                <div className="ncc-stat-card" key={card.label}>
                  <div className="ncc-stat-card__top">
                    <div className="ncc-stat-card__icon">
                      <card.icon size={20} />
                    </div>
                    <button type="button" className="ncc-stat-card__view">
                      <Share2 size={12} />
                      View
                    </button>
                  </div>
                  <div>
                    <div className="ncc-stat-card__number">{card.value.toLocaleString()}</div>
                    <div className="ncc-stat-card__label">{card.label}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="ncc-panel">
              <div className="ncc-panel__header">
                <div className="ncc-panel__header-left">
                  <div className="ncc-panel__icon">
                    <UsersRound size={18} />
                  </div>
                  <div>
                    <h2 className="ncc-panel__title">Holder Analytics</h2>
                    <p className="ncc-panel__subtitle">Number of holders over time</p>
                  </div>
                </div>
                <RangeToggle value={holderRange} onChange={setHolderRange} />
              </div>

              <div className="ncc-date-row">
                <div className="ncc-date-field">
                  <span className="ncc-date-field__label">From</span>
                  <span className="ncc-date-input">
                    <Calendar size={14} />
                    {fromDate}
                  </span>
                </div>
                <div className="ncc-date-field">
                  <span className="ncc-date-field__label">To</span>
                  <span className="ncc-date-input">
                    <Calendar size={14} />
                    {toDate}
                  </span>
                </div>
              </div>

              <div className="ncc-legend-row">
                <span className="ncc-legend-dot" style={{ backgroundColor: '#4f46e5' }} />
                Holder Connections
              </div>

              <HolderAnalyticsChart labels={holderData.labels} values={holderData.values} />
            </div>

            <div className="ncc-panel">
              <div className="ncc-panel__header">
                <div className="ncc-panel__header-left">
                  <div className="ncc-panel__icon">
                    <Settings2 size={18} />
                  </div>
                  <div>
                    <h2 className="ncc-panel__title">Service Analytics</h2>
                    <p className="ncc-panel__subtitle">Created Service vs Published Service</p>
                  </div>
                </div>
                <RangeToggle value={serviceRange} onChange={setServiceRange} />
              </div>

              <div className="ncc-legend-row">
                <span className="ncc-legend-dot" style={{ backgroundColor: '#4f46e5' }} />
                Created Service
                <span className="ncc-legend-dot" style={{ backgroundColor: '#0d9488', marginLeft: 14 }} />
                Published Service
              </div>

              <ServiceAnalyticsChart labels={serviceData.labels} created={serviceData.created} published={serviceData.published} />
            </div>

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
                  <span className="ncc-txn-id-row__label">
                    <Hash size={13} /> Txn Id
                  </span>
                  <span className="ncc-txn-id-row__value">{txnId}</span>
                </div>
                <button type="button" className="ncc-copy-btn" onClick={handleCopyTxn} title="Copy transaction ID">
                  <Copy size={15} />
                </button>
              </div>
              {copied && <div style={{ fontSize: 12, color: '#0d9488', marginTop: -8, marginBottom: 8 }}>Copied!</div>}

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
                  <div className="ncc-txn-field__value">2944</div>
                </div>
                <div className="ncc-txn-field">
                  <div className="ncc-txn-field__label">Time Ago</div>
                  <div className="ncc-txn-field__value">25 mins, 16 secs ago</div>
                </div>
              </div>
            </div>
          </div>

          <div className="ncc-right-col">
            <h2 className="ncc-right-col__title">Network Health</h2>
            <p className="ncc-right-col__subtitle">Nodes: {NODES.length}</p>

            {NODES.map((node) => (
              <div className="ncc-node-card" key={node.alias}>
                <div className="ncc-node-card__header">
                  <span className="ncc-node-card__globe">
                    <Globe size={15} />
                  </span>
                  <span className="ncc-node-card__name">{node.alias}</span>
                </div>
                <div className="ncc-node-card__grid">
                  <div>
                    <div className="ncc-node-field__label">Alias</div>
                    <div className="ncc-node-field__value">{node.alias}</div>
                  </div>
                  <div>
                    <div className="ncc-node-field__label">Node IP</div>
                    <div className="ncc-node-field__value">{node.nodeIp}</div>
                  </div>
                  <div>
                    <div className="ncc-node-field__label">Port</div>
                    <div className="ncc-node-field__value">{node.port}</div>
                  </div>
                  <div>
                    <div className="ncc-node-field__label">Service</div>
                    <div className="ncc-node-field__value">{node.service}</div>
                  </div>
                  <div className="ncc-node-card__grid--full">
                    <div className="ncc-node-field__label">DID</div>
                    <div className="ncc-node-field__value ncc-node-field__value--mono">{node.did}</div>
                  </div>
                  <div className="ncc-node-card__grid--full">
                    <div className="ncc-node-field__label">Uptime</div>
                    <div className="ncc-node-field__value">{node.uptime}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button type="button" className="ncc-help-btn" title="Help">
          <HelpCircle size={24} />
        </button>
      </main>
    </div>
  );
}
