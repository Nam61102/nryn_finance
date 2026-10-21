import { Platform } from 'react-native';
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
  me: () => request<{ user: any }>('/auth/me'),
  resetPassword: (email: string, newPassword: string) => request<{ ok: boolean; message: string }>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ email, newPassword }) }),
  seedDemo: () => request<{ ok: boolean; queued: number; parsed: any }>('/ingest/seed-demo', { method: 'POST', body: '{}' }),
  resetData: () => request<{ ok: boolean; deletedTransactions: number; deletedMessages: number; message: string }>('/ingest/reset-data', { method: 'POST', body: '{}' }),
  pasteSms: (text: string, sender?: string) => request<{ ok: boolean; accepted: number; duplicates: number; rejected: number; parsed: any; transactions: any[] }>('/ingest/paste-sms', { method: 'POST', body: JSON.stringify({ text, sender }) }),

  budgetSuggestion: () => request<any>('/budgets/suggestion'),
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
    request<{ ok: boolean; reply: string; blocks?: any[]; insights?: any; suggestedFollowUps?: string[] }>('/copilot/chat', {
      method: 'POST',
      body: JSON.stringify({ message, history }),
    }),
  copilotChatStream: async (
    message: string,
    history: any[] = [],
    callbacks: {
      onDelta?: (text: string) => void;
      onBlocks?: (blocks: any[]) => void;
      onDone?: (data: { suggestedFollowUps?: string[]; source?: string }) => void;
      onError?: (err: Error) => void;
    },
    signal?: AbortSignal
  ) => {
    const token = await getToken();
    try {
      const res = await fetch(`${API_BASE}/api/copilot/chat/stream`, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message, history }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Stream request failed (${res.status}): ${errText}`);
      }

      if (res.body && typeof (res.body as any).getReader === 'function') {
        const reader = (res.body as any).getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let currentEvent = 'message';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(':')) continue;
            if (trimmed.startsWith('event: ')) {
              currentEvent = trimmed.slice(7).trim();
            } else if (trimmed.startsWith('data: ')) {
              try {
                const data = JSON.parse(trimmed.slice(6));
                if (currentEvent === 'delta' && data.text) {
                  callbacks.onDelta?.(data.text);
                } else if (currentEvent === 'blocks' && data.blocks) {
                  callbacks.onBlocks?.(data.blocks);
                } else if (currentEvent === 'done') {
                  callbacks.onDone?.(data);
                } else if (currentEvent === 'error') {
                  callbacks.onError?.(new Error(data.error || 'Server error'));
                }
              } catch (_) {}
            }
          }
        }
      } else {
        const fallbackRes = await api.copilotChat(message, history);
        if (fallbackRes.blocks) callbacks.onBlocks?.(fallbackRes.blocks);
        if (fallbackRes.reply) callbacks.onDelta?.(fallbackRes.reply);
        callbacks.onDone?.({ suggestedFollowUps: fallbackRes.suggestedFollowUps });
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        callbacks.onError?.(err);
      }
      throw err;
    }
  },
  getSafeSpend: (month?: string) =>
    request<{
      ok: boolean;
      hasBudget?: boolean;
      month: string;
      currentDay: number;
      daysRemaining: number;
      dailySafeSpendINR: number;
      todaySpentINR: number;
      todayRemainingINR: number;
      totalBudgetINR?: number;
      totalSpentSoFarINR?: number;
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
      empty?: boolean;
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
      financialYearLabel?: string;
      regimeUnknown?: boolean;
      taxRegime?: 'new' | 'old' | null;
      notApplicable?: boolean;
      empty?: boolean;
      message?: string;
      section80C: any;
      section80D: any;
      totalDeductionClaimedINR: number;
      potentialTaxSavingsINR: number | null;
      actionableTip: string;
    }>('/copilot/tax-radar'),
  setTaxRegime: (taxRegime: 'new' | 'old' | null) =>
    request<{ ok: boolean; user: any }>('/auth/tax-regime', {
      method: 'PATCH',
      body: JSON.stringify({ taxRegime }),
    }),
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
  getAgentBriefing: (month?: string) =>
    request<{
      ok: boolean;
      user: { name: string; greeting: string };
      statusPill: {
        state: 'optimal' | 'warning' | 'alert';
        label: string;
        healthScore: number;
        auditedCount: number;
        anomaliesCount: number;
        statusMessage: string;
        lastAuditedAt: string;
      };
      briefing: {
        headline: string;
        narrative: string;
        metrics: {
          totalSpentPaise: number;
          totalSpentINR: number;
          safeDailyINR: number;
          budgetTotalINR: number;
          budgetRemainingINR: number;
          auditedTxnsCount: number;
          activeSubscriptionsCount: number;
          recurringMonthlyINR: number;
          velocityPct: number;
          velocityDirection: 'down' | 'up' | 'flat';
          daysRemaining: number;
        };
        highlights: { id: string; label: string; value: string; subtext: string }[];
        quickPrompts: string[];
      };
    }>(`/copilot/briefing${month ? `?month=${month}` : ''}`),
  simulatePurchase: (params: {
    amount: number;
    category?: string;
    item?: string;
    month?: string;
  }) =>
    request<{
      ok: boolean;
      purchase: {
        item: string;
        category: string;
        amountINR: number;
        amountPaise: number;
      };
      verdict: {
        status: 'SAFE' | 'CAUTION' | 'DEFICIT_RISK';
        badge: string;
        badgeColor: string;
        title: string;
        summary: string;
        recommendation: string;
        isAffordable: boolean;
      };
      metrics: {
        daysRemaining: number;
        hasConfiguredBudget: boolean;
        totalBudgetINR: number;
        current: {
          spentINR: number;
          remainingBudgetINR: number;
          dailySafeINR: number;
          budgetUsagePercent: number;
        };
        projected: {
          spentINR: number;
          remainingBudgetINR: number;
          dailySafeINR: number;
          budgetUsagePercent: number;
          dailyDropINR: number;
          dailyDropPercent: number;
        };
        categoryAnalysis: {
          category: string;
          currentSpentINR: number;
          projectedSpentINR: number;
          categoryBudgetINR: number;
          isOverbudget: boolean;
        };
      };
      actionPlan: {
        suggestedDelayDays: number;
        dailySavingsOffsetINR: number;
        installment3MoINR: number;
      };
      simulatedAt: string;
    }>('/copilot/simulate-purchase', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  transcribeVoice: async (
    audioUri: string,
    mimeType: string = 'audio/m4a',
    filename: string = 'recording.m4a'
  ): Promise<{
    ok: boolean;
    text: string;
    language: 'mr' | 'hi' | 'en';
    languageName: string;
    provider?: string;
  }> => {
    const token = await getToken();
    const formData = new FormData();

    if (Platform.OS === 'web') {
      const response = await fetch(audioUri);
      const blob = await response.blob();
      formData.append('audio', blob, filename);
    } else {
      formData.append('audio', {
        uri: audioUri,
        name: filename,
        type: mimeType,
      } as any);
    }

    const res = await fetch(`${API_BASE}/api/copilot/voice/transcribe`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiError(res.status, data);
    }
    return data;
  },
};

export const rupees = (paise: number) => (paise || 0) / 100;
export const formatINR = (paise: number, opts: { decimals?: boolean } = {}) =>
  `₹${rupees(paise).toLocaleString('en-IN', {
    minimumFractionDigits: opts.decimals ? 2 : 0,
    maximumFractionDigits: opts.decimals ? 2 : 0,
  })}`;
