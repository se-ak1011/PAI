export const APP_NAME = 'PAI';
export const APP_TAGLINE = 'Your trades business, sorted.';

// ─── Stripe fee configuration ───────────────────────────────
// Configurable so fee changes never require a rebuild.
// Stripe UK standard: 1.5% + 20p domestic cards (adjust as needed)
export const STRIPE_FEES = {
  processing_fee_percentage: 0.015,  // 1.5%
  processing_fee_fixed_pence: 20,    // 20p in pence
};

// Helper: calculate checkout total with transparent Stripe fee
// Returns amounts in £ (not pence)
export function calculateCheckoutTotal(contractorQuoteGBP: number): {
  contractorQuote: number;
  stripeFee: number;
  totalDue: number;
} {
  const fee =
    contractorQuoteGBP * STRIPE_FEES.processing_fee_percentage +
    STRIPE_FEES.processing_fee_fixed_pence / 100;
  return {
    contractorQuote: contractorQuoteGBP,
    stripeFee: Math.round(fee * 100) / 100,
    totalDue: Math.round((contractorQuoteGBP + fee) * 100) / 100,
  };
}

// ─── Platform principles (display in UI) ────────────────────
export const PLATFORM_PRINCIPLES = {
  NO_COMMISSION:
    'PAI does not take a percentage of your jobs. Your quotes remain your quotes.',
  SUBSCRIPTION_ONLY:
    "PAI earns through contractor subscriptions only — not commissions.",
  AI_ASSIST_ONLY:
    'AI assists with estimate generation only. Contractors remain responsible for reviewing and approving all quotes.',
  NOT_A_PARTY:
    'PAI is not a party to service agreements between customers and contractors.',
  STRIPE_PROCESSING:
    'Stripe processes payments securely. Processing fees are shown before payment confirmation.',
  ESTIMATE_DISCLAIMER:
    'Estimates are generated using contractor profile information and project details. Final pricing, availability and scope remain subject to contractor review and approval.',
  CUSTOMER_ACCEPTANCE:
    "I understand that the contractor's final approved quote forms the basis of the service agreement, and that payment processing fees are charged separately and displayed before payment.",
};

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
