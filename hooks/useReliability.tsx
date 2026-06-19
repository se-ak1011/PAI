/**
 * useReliability
 * Fetches and computes a customer reliability score for a given customer ID.
 * Only meaningful for contractor/both accounts — do not call for customer-only views.
 *
 * Reliability levels:
 *   Reliable     → avg ≥ 4.0  and  would_work_again_pct ≥ 70
 *   Mixed History → avg ≥ 2.8
 *   Caution       → avg < 2.8  or  would_work_again_pct < 40
 */
import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/template/core';

// Reliability colours aligned to the industrial palette (no traffic-light primaries)
export const RELIABILITY_COLOURS = {
  Reliable:       '#4F8A63',   // success green
  'Mixed History': '#B08D57',  // aged brass
  Caution:        '#B85757',   // error red
} as const;

export type ReliabilityLevel = keyof typeof RELIABILITY_COLOURS;

export interface ReliabilityScore {
  level: ReliabilityLevel;
  totalReviews: number;
  avgOverall: number;
  wouldWorkAgainPct: number | null;
  commonTags: string[];
  categories: {
    communication: number | null;
    payment_reliability: number | null;
    project_preparedness: number | null;
    scope_stability: number | null;
    respectful_behaviour: number | null;
  };
}

export function computeReliabilityLevel(avg: number, wouldWorkPct: number | null): ReliabilityLevel {
  if (avg >= 4.0 && (wouldWorkPct === null || wouldWorkPct >= 70)) return 'Reliable';
  if (avg >= 2.8 && (wouldWorkPct === null || wouldWorkPct >= 40)) return 'Mixed History';
  return 'Caution';
}

export function useReliability(customerId: string | null | undefined) {
  const [score, setScore] = useState<ReliabilityScore | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!customerId) { setScore(null); return; }

    setLoading(true);
    const supabase = getSupabaseClient();

    supabase
      .from('customer_reliability_scores')
      .select('*')
      .eq('customer_id', customerId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data || data.total_reviews === 0) {
          setScore(null);
        } else {
          const avg = parseFloat(data.avg_overall_rating) || 0;
          const wouldWorkPct = data.would_work_again_pct != null
            ? parseFloat(data.would_work_again_pct)
            : null;
          setScore({
            level: computeReliabilityLevel(avg, wouldWorkPct),
            totalReviews: data.total_reviews,
            avgOverall: avg,
            wouldWorkAgainPct: wouldWorkPct,
            commonTags: data.common_tags || [],
            categories: {
              communication:        data.avg_communication != null ? parseFloat(data.avg_communication) : null,
              payment_reliability:  data.avg_payment_reliability != null ? parseFloat(data.avg_payment_reliability) : null,
              project_preparedness: data.avg_project_preparedness != null ? parseFloat(data.avg_project_preparedness) : null,
              scope_stability:      data.avg_scope_stability != null ? parseFloat(data.avg_scope_stability) : null,
              respectful_behaviour: data.avg_respectful_behaviour != null ? parseFloat(data.avg_respectful_behaviour) : null,
            },
          });
        }
        setLoading(false);
      });
  }, [customerId]);

  return { score, loading };
}
