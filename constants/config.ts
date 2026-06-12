export const APP_NAME = 'PAI';
export const APP_TAGLINE = 'Your trades business, sorted.';

// ─── Subscription ───────────────────────────────────────────
// Customers: always free
// Contractors / Both: 14-day free trial → £25/month flat fee
export const SUBSCRIPTION = {
  TRIAL_DAYS: 14,
  MONTHLY_FEE_GBP: 25,
  CONTRACTOR_TOOLS: [
    'AI quoting & invoicing',
    'Tax Pot tracker',
    'Job tracking pipeline',
    'Marketplace applications',
    'Contractor public profile',
    'Availability calendar',
    'Payouts via Stripe',
  ],
};

export const TAX_RATES = {
  CIS: 0.20,
  SELF_EMPLOYED: 0.30,
};

export const TAX_RATE_LABELS = {
  CIS: 'CIS (20%)',
  SELF_EMPLOYED: 'Self-Employed (30%)',
};

export const TRADE_CATEGORIES = [
  'Painting',
  'Plumbing',
  'Electrical',
  'Carpentry',
  'General Labour',
  'Bricklaying',
  'Roofing',
  'Flooring',
  'Tiling',
  'Landscaping',
  'Other',
];

export const INCOME_CATEGORIES = [
  'Painting',
  'Plumbing',
  'Electrical',
  'Carpentry',
  'General Labour',
  'Roofing',
  'Tiling',
  'Other',
];

// Job lifecycle statuses (contractor private jobs)
export const JOB_STATUSES = {
  DRAFT: 'draft',
  QUOTED: 'quoted',
  SENT: 'sent',
  ACCEPTED: 'accepted',
  IN_PROGRESS: 'in_progress',
  CONTRACTOR_DONE: 'contractor_marked_done',
  INVOICED: 'invoiced',
  PAID: 'paid',
  CANCELLED: 'cancelled',
};

export const JOB_STATUS_ACTIONS: Record<string, { label: string; next: string }> = {
  draft: { label: 'Send Quote', next: 'sent' },
  sent: { label: 'Mark Accepted', next: 'accepted' },
  accepted: { label: 'Start Job', next: 'in_progress' },
  in_progress: { label: 'Mark Complete', next: 'contractor_marked_done' },
  contractor_marked_done: { label: 'Send Invoice', next: 'invoiced' },
  invoiced: { label: 'Mark as Paid', next: 'paid' },
};

export const JOB_POST_STATUSES = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

// ─── Dev mode ───────────────────────────────────────────────
// Set to true only during local development to show mock data
export const DEV_MODE = false;
