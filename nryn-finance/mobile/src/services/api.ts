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

  // ── AI Financial Copilot Endpoints ──
  copilotChat: (message: string, history: any[] = []) =>
    request<{ ok: boolean; reply: string; insights?: any; suggestedFollowUps?: string[] }>('/copilot/chat', {
      method: 'POST',
      body: JSON.stringify({ message, history }),
    }),
  getSafeSpend: (month?: string) =>
    request<{
      ok: boolean;
      month: string;
      currentDay: number;
      daysRemaining: number;
      dailySafeSpendINR: number;
      todaySpentINR: number;
      todayRemainingINR: number;
      burnStatus: 'green' | 'amber' | 'red';
      projectedRunoutDate: string | null;
      insightMessage: string;
    }>(`/copilot/safe-to-spend${month ? `?month=${month}` : ''}`),
  getAnomalies: () =>
    request<{ ok: boolean; count: number; anomalies: any[] }>('/copilot/anomalies'),
  getSubscriptions: () =>
    request<{
      ok: boolean;
      count: number;
      totalMonthlyRecurringINR: number;
      totalAnnualCostINR: number;
      potentialAnnualSavingsINR: number;
      subscriptions: any[];
    }>('/copilot/subscriptions'),
  simulateLoan: (params: {
    principalAmount: number;
    annualInterestRate: number;
    tenureMonths: number;
    currentEmi?: number;
    extraMonthlyPrepayment: number;
  }) =>
    request<{
      ok: boolean;
      principalINR: number;
      baselineEmiINR: number;
      totalInterestSavedINR: number;
      monthsSaved: number;
      yearsSaved: number;
      newTenureMonths: number;
      recommendation: string;
    }>('/copilot/loan-simulator', { method: 'POST', body: JSON.stringify(params) }),
  getTaxRadar: () =>
    request<{
      ok: boolean;
      financialYear: string;
      section80C: any;
      section80D: any;
      totalDeductionClaimedINR: number;
      potentialTaxSavingsINR: number;
      actionableTip: string;
    }>('/copilot/tax-radar'),
  getRecommendations: (month?: string) =>
    request<{
      ok: boolean;
      month: string;
      count: number;
      totalSpentINR: number;
      totalPotentialSavingsINR: number;
      topMerchants: { name: string; amountINR: number; count: number; category: string }[];
      recommendations: {
        id: string;
        type: string;
        severity: 'high' | 'medium' | 'info';
        icon: string;
        merchantName?: string;
        category?: string;
        totalSpentINR: number;
        orderCount?: number;
        percentOfTotal?: number;
        comparisonText?: string;
        title: string;
        reason: string;
        aiSuggestion: string;
        potentialSavingsINR: number;
        actionTag: string;
      }[];
    }>(`/copilot/recommendations${month ? `?month=${month}` : ''}`),
};

export const rupees = (paise: number) => (paise || 0) / 100;
export const formatINR = (paise: number, opts: { decimals?: boolean } = {}) =>
  `₹${rupees(paise).toLocaleString('en-IN', {
    minimumFractionDigits: opts.decimals ? 2 : 0,
    maximumFractionDigits: opts.decimals ? 2 : 0,
  })}`;
