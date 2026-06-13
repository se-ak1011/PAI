-- ============================================================================
-- customer_reliability_scores (VIEW)
-- ============================================================================
-- Consumed by hooks/useReliability.tsx via:
--   .from('customer_reliability_scores').select('*').eq('customer_id', id).maybeSingle()
--
-- Aggregates published contractor_to_customer reviews into one row per customer.
-- Columns expected by the hook (all numeric values are read with parseFloat):
--   customer_id, total_reviews, avg_overall_rating, would_work_again_pct,
--   common_tags (text[]), avg_communication, avg_payment_reliability,
--   avg_project_preparedness, avg_scope_stability, avg_respectful_behaviour
--
-- Category scores live in reviews.categories (jsonb), e.g.
--   { "communication": 5, "payment_reliability": 4, ... }
--
-- This is intentionally a (non-invoker) view so contractors can read aggregate
-- reliability scores about customers without direct read access to the
-- underlying reviews rows (which may contain private_note). Access is granted
-- to authenticated/anon below; the raw reviews table stays RLS-protected.
-- ============================================================================

create or replace view public.customer_reliability_scores as
with base as (
  select *
  from public.reviews
  where mode = 'contractor_to_customer'
    and status = 'published'
),
tag_counts as (
  select subject_id, tag, count(*) as cnt
  from base, unnest(tags) as tag
  group by subject_id, tag
),
top_tags as (
  select subject_id, array_agg(tag order by cnt desc, tag) as common_tags
  from tag_counts
  group by subject_id
)
select
  b.subject_id                                                              as customer_id,
  count(*)::int                                                             as total_reviews,
  round(avg(b.rating)::numeric, 2)                                         as avg_overall_rating,
  round(
    100.0 * avg(
      case
        when b.would_work_again is true  then 1.0
        when b.would_work_again is false then 0.0
      end
    ), 0
  )                                                                         as would_work_again_pct,
  round(avg((b.categories ->> 'communication')::numeric), 2)               as avg_communication,
  round(avg((b.categories ->> 'payment_reliability')::numeric), 2)         as avg_payment_reliability,
  round(avg((b.categories ->> 'project_preparedness')::numeric), 2)        as avg_project_preparedness,
  round(avg((b.categories ->> 'scope_stability')::numeric), 2)             as avg_scope_stability,
  round(avg((b.categories ->> 'respectful_behaviour')::numeric), 2)        as avg_respectful_behaviour,
  coalesce(t.common_tags, '{}')                                            as common_tags
from base b
left join top_tags t on t.subject_id = b.subject_id
group by b.subject_id, t.common_tags;

grant select on public.customer_reliability_scores to anon, authenticated;
