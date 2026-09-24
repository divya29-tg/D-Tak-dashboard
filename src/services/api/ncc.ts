const NCC_BASE_URL = import.meta.env.VITE_NCC_API_BASE_URL || 'https://nccbackend.staging.trustgrid.com';
const NCC_NETWORK_ID = import.meta.env.VITE_NCC_NETWORK_ID || '76';
// Temporary: static JWT from .env until NCC login is wired up.
const NCC_TOKEN = import.meta.env.VITE_NCC_TOKEN || '';

async function nccRequest<T>(endpoint: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${NCC_BASE_URL}${endpoint}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      // NCC backend expects the raw token, not "Bearer <token>".
      Authorization: NCC_TOKEN,
      ...init.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`NCC ${endpoint} failed: HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

const postNetwork = <T>(endpoint: string) =>
  nccRequest<T>(endpoint, { method: 'POST', body: JSON.stringify({ networkId: NCC_NETWORK_ID }) });

const getLedgerCount = async (endpoint: string) =>
  (await nccRequest<{ result: { txCount: number } }>(`${endpoint}/${NCC_NETWORK_ID}`)).result.txCount;

export type NccGroupBy = 'day' | 'week' | 'month';

export interface NccDateCount {
  date: string; // YYYY-MM-DD (bucket start)
  count: number;
}

export interface NccServiceLifecycle {
  created: NccDateCount[];
  published: NccDateCount[];
}

type RawDateCount = { date: string; count: string };

const parseDateCounts = (rows: RawDateCount[]): NccDateCount[] =>
  rows.map((r) => ({ date: r.date.slice(0, 10), count: Number(r.count) }));

export interface NccLedgerTx {
  seqNo: number;
  type: string; // ledger typeName, e.g. NYM, SCHEMA, CLAIM_DEF
  txnId: string;
  txnTime: string; // ISO timestamp
}

interface RawLedgerTx {
  imeta: { seqNo: number };
  idata: {
    expansion: {
      idata: {
        txn: { typeName: string };
        txnMetadata: { seqNo: number; txnId: string; txnTime: string };
      };
    };
  };
}

export interface NccPoolNode {
  alias: string;
  nodeIp: string;
  nodePort: number;
  services: string[];
  did: string;
}

interface RawPoolTx {
  idata: {
    expansion: {
      idata: {
        txn: {
          data: {
            dest: string;
            data: { alias: string; node_ip: string; node_port: number; services?: string[] };
          };
        };
      };
    };
  };
}

// Pool_info lists nodes as [name, replicaIndex] pairs; accept plain names too.
type RawNodeRef = string | [string, ...unknown[]];

interface RawValidatorInfo {
  Node_info?: { Name?: string; Mode?: string; Metrics?: { uptime?: number } };
  Pool_info?: { Reachable_nodes?: RawNodeRef[] };
  Software?: { 'indy-node'?: string };
}

export interface NccValidatorStatus {
  name: string;
  mode: string | null;
  uptimeSecs: number | null;
  indyNodeVersion: string | null;
}

export interface NccNetworkStatus {
  ready: boolean;
  syncing: boolean;
  validators: NccValidatorStatus[];
  /** Node names any validator reports as reachable. */
  reachable: string[];
}

const nodeRefName = (ref: RawNodeRef) => (Array.isArray(ref) ? ref[0] : ref);

export interface NccKpiCounts {
  transactions: number | null;
  services: number | null;
  claimDefinitions: number | null;
  schemas: number | null;
  issuers: number | null;
  verifiers: number | null;
}

export const nccService = {
  getIssuerCount: async () => (await postNetwork<{ IssuerCount: number }>('/issuer/count')).IssuerCount,
  getServiceCount: async () => (await postNetwork<{ ServiceCount: number }>('/service/count')).ServiceCount,
  getVerifierCount: async () => (await postNetwork<{ VerifierCount: number }>('/verifier/count')).VerifierCount,
  getTransactionCount: () => getLedgerCount('/ledger/getDomainTxsCount'),
  getSchemaCount: () => getLedgerCount('/ledger/getDomainSchemaTxsCount'),
  getClaimDefinitionCount: () => getLedgerCount('/ledger/getDomainClainDefTxsCount'),

  /** New holders per bucket in [startDate, endDate]; buckets with no holders are omitted by the API. */
  getHolderCounts: async (startDate: string, endDate: string, groupBy: NccGroupBy): Promise<NccDateCount[]> => {
    const params = new URLSearchParams({ startDate, endDate, groupBy });
    const data = await nccRequest<{ result: RawDateCount[] }>(`/holder/${NCC_NETWORK_ID}/count?${params}`);
    return parseDateCounts(data.result);
  },

  /** Credentials issued per bucket in [startDate, endDate]; empty buckets are omitted. */
  getIssuedCredentialCounts: async (startDate: string, endDate: string, groupBy: NccGroupBy): Promise<NccDateCount[]> => {
    const params = new URLSearchParams({ networkId: NCC_NETWORK_ID, startDate, endDate, groupBy });
    const data = await nccRequest<{ result: RawDateCount[] }>(`/issuer/issuedCredential/count?${params}`);
    return parseDateCounts(data.result);
  },

  /** Latest domain-ledger transactions, newest first (the API returns the most recent 50). */
  getDomainTxs: async (): Promise<NccLedgerTx[]> => {
    const data = await nccRequest<{ result: RawLedgerTx[] }>(`/ledger/getDomainTxs/${NCC_NETWORK_ID}`);
    return data.result.map((r) => {
      const { txn, txnMetadata } = r.idata.expansion.idata;
      return { seqNo: r.imeta.seqNo, type: txn.typeName, txnId: txnMetadata.txnId, txnTime: txnMetadata.txnTime };
    });
  },

  /** Nodes registered in the pool ledger. */
  getPoolNodes: async (): Promise<NccPoolNode[]> => {
    const data = await nccRequest<{ result: RawPoolTx[] }>(`/ledger/getPoolTxs/${NCC_NETWORK_ID}`);
    return data.result
      .map((r) => {
        const { dest, data: node } = r.idata.expansion.idata.txn.data;
        return { alias: node.alias, nodeIp: node.node_ip, nodePort: node.node_port, services: node.services ?? [], did: dest };
      })
      .sort((a, b) => a.alias.localeCompare(b.alias, undefined, { numeric: true }));
  },

  /** Per-validator uptime/status as reported by the network's validator-info. */
  getNetworkStatus: async (): Promise<NccNetworkStatus> => {
    const data = await nccRequest<{ result: { ready: boolean; syncing: boolean; validators: RawValidatorInfo[] } }>(
      `/ledger/getUptime/${NCC_NETWORK_ID}`,
      { method: 'POST' }
    );
    const { ready, syncing, validators } = data.result;
    const reachable = new Set<string>();
    validators.forEach((v) => v.Pool_info?.Reachable_nodes?.forEach((ref) => reachable.add(nodeRefName(ref))));
    return {
      ready,
      syncing,
      validators: validators
        .filter((v) => v.Node_info?.Name)
        .map((v) => ({
          name: v.Node_info!.Name!,
          mode: v.Node_info?.Mode ?? null,
          uptimeSecs: v.Node_info?.Metrics?.uptime ?? null,
          indyNodeVersion: v.Software?.['indy-node'] ?? null,
        })),
      reachable: [...reachable],
    };
  },

  /** Services created and published per bucket in [startDate, endDate]; empty buckets are omitted. */
  getServiceLifecycleCounts: async (
    startDate: string,
    endDate: string,
    groupBy: NccGroupBy
  ): Promise<NccServiceLifecycle> => {
    const params = new URLSearchParams({ networkId: NCC_NETWORK_ID, startDate, endDate, groupBy });
    const data = await nccRequest<{ result: { created: RawDateCount[]; published: RawDateCount[] } }>(
      `/issuer/services/count?${params}`
    );
    return { created: parseDateCounts(data.result.created), published: parseDateCounts(data.result.published) };
  },

  /** Fetches all KPI counts in parallel; a failed endpoint yields null instead of failing the rest. */
  getKpiCounts: async (): Promise<NccKpiCounts> => {
    const results = await Promise.allSettled([
      nccService.getTransactionCount(),
      nccService.getServiceCount(),
      nccService.getClaimDefinitionCount(),
      nccService.getSchemaCount(),
      nccService.getIssuerCount(),
      nccService.getVerifierCount(),
    ]);
    const [transactions, services, claimDefinitions, schemas, issuers, verifiers] = results.map((r) =>
      r.status === 'fulfilled' ? r.value : null
    );
    return { transactions, services, claimDefinitions, schemas, issuers, verifiers };
  },
};
