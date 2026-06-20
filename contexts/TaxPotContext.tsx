import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { withTimeout } from '@/utils/asyncTimeout';
import { deferUntilAfterFirstPaint, getDeferredSupabaseClient, type DeferredSupabaseClient } from '@/utils/deferredSupabase';

export interface ManualIncomeEntry {
  id: string;
  contractor_id: string;
  amount: number;
  date: string;
  customer_name: string | null;
  category: string;
  payment_status: 'paid' | 'unpaid';
  tax_rate: number;
  tax_set_aside: number;
  created_at: string;
  source: 'manual';
}

export interface PAIIncomeEntry {
  id: string;
  job_id: string;
  contractor_id: string;
  customer_id: string;
  customer_name: string;
  amount: number;
  date_completed: string;
  tax_rate: number;
  tax_set_aside: number;
  net_payout: number;
  created_at: string;
  source: 'pai';
}

export type IncomeEntry = ManualIncomeEntry | PAIIncomeEntry;

export interface TaxSummary {
  totalSetAside: number;
  paiIncomeTotal: number;
  manualIncomeTotal: number;
  totalEarnings: number;
  yearlyProjection: number;
  estimatedTax: number;
  monthlySetAside: number;
}

interface TaxPotContextType {
  manualIncome: ManualIncomeEntry[];
  paiIncome: PAIIncomeEntry[];
  allIncome: IncomeEntry[];
  summary: TaxSummary;
  taxRate: number;
  loading: boolean;
  setTaxRate: (rate: number) => void;
  addManualIncome: (entry: Omit<ManualIncomeEntry, 'id' | 'created_at' | 'tax_set_aside'>) => Promise<void>;
  deleteManualIncome: (id: string) => Promise<void>;
  addPAIJobIncome: (opts: { job_id: string; job_title: string; customer_name: string; amount: number; date_completed: string }) => Promise<void>;
  refresh: () => Promise<void>;
}

export const TaxPotContext = createContext<TaxPotContextType | undefined>(undefined);

const TAX_SYNC_TIMEOUT_MS = 8000;

function calcSummary(
  manual: ManualIncomeEntry[],
  pai: PAIIncomeEntry[],
  taxRate: number
): TaxSummary {
  const paidManual = manual.filter(i => i.payment_status === 'paid');
  const manualTotal = paidManual.reduce((s, i) => s + i.amount, 0);
  const paiTotal = pai.reduce((s, i) => s + i.amount, 0);
  const totalEarnings = manualTotal + paiTotal;

  const manualSetAside = paidManual.reduce((s, i) => s + i.tax_set_aside, 0);
  const paiSetAside = pai.reduce((s, i) => s + i.tax_set_aside, 0);
  const totalSetAside = manualSetAside + paiSetAside;

  // UK tax year runs Apr 6 – Apr 5. Estimate months elapsed from Apr 6.
  const now = new Date();
  const taxYearStart = new Date(now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1, 3, 6);
  const msElapsed = now.getTime() - taxYearStart.getTime();
  const monthsElapsed = Math.max(1, msElapsed / (1000 * 60 * 60 * 24 * 30.44));
  const monthlyRate = totalEarnings / monthsElapsed;
  const yearlyProjection = monthlyRate * 12;
  const estimatedTax = yearlyProjection * (taxRate / 100);
  const monthlySetAside = estimatedTax / 12;

  return {
    totalSetAside,
    paiIncomeTotal: paiTotal,
    manualIncomeTotal: manualTotal,
    totalEarnings,
    yearlyProjection,
    estimatedTax,
    monthlySetAside,
  };
}

export function TaxPotProvider({ children }: { children: ReactNode }) {
  const auth = useContext(AuthContext);
  const user = auth?.user ?? null;

  const [manualIncome, setManualIncome] = useState<ManualIncomeEntry[]>([]);
  const [paiIncome, setPaiIncome] = useState<PAIIncomeEntry[]>([]);
  const [taxRate, setTaxRateState] = useState(30);
  const [loading, setLoading] = useState(false);

  const [supabase, setSupabase] = useState<DeferredSupabaseClient | null>(null);

  useEffect(() => {
    if (!user) return;

    let canceled = false;
    const cancelDeferredStartup = deferUntilAfterFirstPaint(() => {
      if (canceled) return;
      getDeferredSupabaseClient()
        .then((client) => {
          if (!canceled) {
            setSupabase(client);
          }
        })
        .catch((error) => {
          console.warn('[TaxPotContext] Supabase client unavailable; skipping background sync:', error);
        });
    });

    return () => {
      canceled = true;
      cancelDeferredStartup();
    };
  }, [user?.id]);

  // Always define refresh as a hook so it is called unconditionally on every render.
  const refresh = useCallback(async () => {
    if (!supabase) return;
    if (!user || (user.account_type !== 'contractor' && user.account_type !== 'both')) return;
    setLoading(true);
    try {
      const [{ data, error }, { data: paiData }] = await Promise.all([
        withTimeout(
          supabase
            .from('manual_income')
            .select('*')
            .eq('contractor_id', user.id)
            .order('date', { ascending: false }),
          TAX_SYNC_TIMEOUT_MS,
          `[TaxPotContext] Timed out syncing manual income after ${TAX_SYNC_TIMEOUT_MS}ms`
        ),
        withTimeout(
          supabase
            .from('private_jobs')
            .select('id, title, customer, total, paid_at, tax_rate')
            .eq('contractor_id', user.id)
            .eq('status', 'paid')
            .not('paid_at', 'is', null),
          TAX_SYNC_TIMEOUT_MS,
          `[TaxPotContext] Timed out syncing PAI income after ${TAX_SYNC_TIMEOUT_MS}ms`
        ),
      ]);

      if (!error && data) {
        setManualIncome(data.map(i => ({ ...i, source: 'manual' as const })));
      }

      const paiEntries: PAIIncomeEntry[] = (paiData ?? []).map((j: any) => {
        const tr = j.tax_rate ?? taxRate;
        const tax_set_aside = Math.round(j.total * (tr / 100) * 100) / 100;
        return {
          id: `pai-${j.id}`,
          job_id: j.id,
          contractor_id: user.id,
          customer_id: '',
          customer_name: j.customer || '',
          amount: j.total,
          date_completed: j.paid_at,
          tax_rate: tr,
          tax_set_aside,
          net_payout: j.total - tax_set_aside,
          created_at: j.paid_at,
          source: 'pai' as const,
        };
      });
      setPaiIncome(paiEntries);
    } catch (error) {
      console.warn('[TaxPotContext] Startup sync failed:', error);
    } finally {
      // Sync tax_rate from profile, even if remote income sync failed.
      if (user.tax_rate) setTaxRateState(user.tax_rate);
      setLoading(false);
    }
  }, [supabase, user?.id]);

  // Always call useEffect unconditionally; guard the body for the null-supabase case.
  useEffect(() => {
    if (!supabase) return;
    if (!user) {
      setManualIncome([]);
      return;
    }
    if (user.tax_rate) setTaxRateState(user.tax_rate);
    refresh();
  }, [supabase, user?.id, refresh]);

  // Conditional render for when Supabase is unavailable — placed after all hooks.
  if (!supabase) {
    return (
      <TaxPotContext.Provider value={{
        manualIncome: [],
        paiIncome: [],
        allIncome: [],
        summary: calcSummary([], [], taxRate),
        taxRate,
        loading: false,
        setTaxRate: (rate: number) => setTaxRateState(rate),
        addManualIncome: async () => {},
        deleteManualIncome: async () => {},
        addPAIJobIncome: async () => {},
        refresh: async () => {},
      }}>
        {children}
      </TaxPotContext.Provider>
    );
  }

  const setTaxRate = async (rate: number) => {
    setTaxRateState(rate);
    if (user) {
      await supabase.from('user_profiles').update({ tax_rate: rate }).eq('id', user.id);
    }
  };

  const addManualIncome = async (entry: Omit<ManualIncomeEntry, 'id' | 'created_at' | 'tax_set_aside'>) => {
    if (!user) return;
    const tax_set_aside = Math.round(entry.amount * (entry.tax_rate / 100) * 100) / 100;
    const payload = {
      contractor_id: user.id,
      amount: entry.amount,
      date: entry.date,
      customer_name: entry.customer_name || null,
      category: entry.category,
      payment_status: entry.payment_status,
      tax_rate: entry.tax_rate,
      tax_set_aside,
    };
    const { data, error } = await supabase
      .from('manual_income')
      .insert(payload)
      .select()
      .single();
    if (!error && data) {
      setManualIncome(prev => [{ ...data, source: 'manual' as const }, ...prev]);
    }
  };

  const deleteManualIncome = async (id: string) => {
    const { error } = await supabase.from('manual_income').delete().eq('id', id);
    if (!error) {
      setManualIncome(prev => prev.filter(i => i.id !== id));
    }
  };

  // Called when a private job is marked as paid — adds it to PAI income without double-counting
  const addPAIJobIncome = async (opts: { job_id: string; job_title: string; customer_name: string; amount: number; date_completed: string }) => {
    const existingId = `pai-${opts.job_id}`;
    if (paiIncome.find(p => p.id === existingId)) return; // Already tracked
    const tr = taxRate;
    const tax_set_aside = Math.round(opts.amount * (tr / 100) * 100) / 100;
    const entry: PAIIncomeEntry = {
      id: existingId,
      job_id: opts.job_id,
      contractor_id: user?.id || '',
      customer_id: '',
      customer_name: opts.customer_name,
      amount: opts.amount,
      date_completed: opts.date_completed,
      tax_rate: tr,
      tax_set_aside,
      net_payout: opts.amount - tax_set_aside,
      created_at: opts.date_completed,
      source: 'pai' as const,
    };
    setPaiIncome(prev => [entry, ...prev]);
  };

  const allIncome: IncomeEntry[] = [
    ...paiIncome,
    ...manualIncome,
  ].sort((a, b) => {
    const dateA = 'date_completed' in a ? a.date_completed : a.date;
    const dateB = 'date_completed' in b ? b.date_completed : b.date;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });

  const summary = calcSummary(manualIncome, paiIncome, taxRate);

  return (
    <TaxPotContext.Provider value={{
      manualIncome,
      paiIncome,
      allIncome,
      summary,
      taxRate,
      loading,
      setTaxRate,
      addManualIncome,
      deleteManualIncome,
      addPAIJobIncome,
      refresh,
    }}>
      {children}
    </TaxPotContext.Provider>
  );
}
