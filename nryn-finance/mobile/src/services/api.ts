import { getItem, setItem, deleteItem } from './storage';

const RAW_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://nryn-finance-wqtv.onrender.com';
export const API_BASE = RAW_BASE.replace(/\/$/, '');

const TOKEN_KEY = 'nryn_finance_token';

export const getToken = () => getItem(TOKEN_KEY);
export const setToken = (t: string) => setItem(TOKEN_KEY, t);
export const clearToken = () => deleteItem(TOKEN_KEY);

export class ApiError extends Error {
  status: number;
  body: any;
  constructor(status: number, body: any) {
    super(body?.error || `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });

  const text = await res.text();
  let body: any = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { error: text.slice(0, 120) };
    }
  }
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, b?: any) => request<T>(p, { method: 'POST', body: JSON.stringify(b ?? {}) }),
  patch: <T>(p: string, b?: any) => request<T>(p, { method: 'PATCH', body: JSON.stringify(b ?? {}) }),
  del: <T>(p: string) => request<T>(p, { method: 'DELETE' }),

  login: (email: string, password: string) => request<{ token: string; user: any }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (email: string, password: string, name?: string) => request<{ token: string; user: any }>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) }),

  budgetStatus: (month?: string) => request<any>(`/budgets/status${month ? `?month=${month}` : ''}`),
  months: () => request<{ months: any[] }>('/analytics/months'),
  transactions: (q: Record<string, string | undefined>) => {
    const s = Object.entries(q).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`).join('&');
    return request<{ transactions: any[]; nextCursor: string | null }>(`/transactions${s ? `?${s}` : ''}`);
  },
  categories: () => request<{ categories: any[] }>('/categories'),
  health: () => fetch(`${API_BASE}/api/health`).then((r) => r.json()),

  // Financial Hub & AI Document Scanning
  analyzeDocument: (data: { type: string; text?: string; fileName?: string; fileBase64?: string }) =>
    request<{ ok: boolean; source: string; type: string; data: any }>('/ai/analyze-document', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  importStatement: (data: { transactions: any[]; bankName?: string; accountMasked?: string }) =>
    request<{ ok: boolean; importedCount: number; message: string }>('/ai/statement-import', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Policies / Insurance
  getPolicies: () => request<{ policies: any[] }>('/policies'),
  createPolicy: (policy: any) => request<{ ok: boolean; policy: any }>('/policies', { method: 'POST', body: JSON.stringify(policy) }),
  deletePolicy: (id: string) => request<{ ok: boolean }>(`/policies/${id}`, { method: 'DELETE' }),

  // Accounts (Savings & Loans)
  getAccounts: () =>
    request<{ accounts: any[]; savings: any[]; loans: any[]; summary: any }>('/accounts'),
  createAccount: (acc: any) => request<{ ok: boolean; account: any }>('/accounts', { method: 'POST', body: JSON.stringify(acc) }),
  deleteAccount: (id: string) => request<{ ok: boolean }>(`/accounts/${id}`, { method: 'DELETE' }),

  // Cash Expense
  createCashExpense: (expense: { amount: number; merchantName?: string; note?: string; category?: string; occurredAt?: string }) =>
    request<{ ok: boolean; transaction: any }>('/cash-expense', { method: 'POST', body: JSON.stringify(expense) }),

  // AI Smart Recommendations
  getRecommendations: () =>
    request<{ ok: boolean; count: number; recommendations: any[] }>('/ai/recommendations'),
};

export const rupees = (paise: number) => (paise || 0) / 100;
export const formatINR = (paise: number, opts: { decimals?: boolean } = {}) =>
  `₹${rupees(paise).toLocaleString('en-IN', {
    minimumFractionDigits: opts.decimals ? 2 : 0,
    maximumFractionDigits: opts.decimals ? 2 : 0,
  })}`;
