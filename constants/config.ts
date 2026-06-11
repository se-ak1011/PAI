export const APP_NAME = 'PAI';
export const APP_TAGLINE = 'Your trades business, sorted.';

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
  'Other',
];

export const JOB_STATUSES = {
  DRAFT: 'draft',
  QUOTED: 'quoted',
  ACTIVE: 'active',
  INVOICED: 'invoiced',
  PAID: 'paid',
  CANCELLED: 'cancelled',
};

export const JOB_POST_STATUSES = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

export const SUBSCRIPTION_PLANS = [
  { id: 'free', name: 'Free', price: 0, features: ['3 active jobs', 'Basic quoting', 'Tax pot tracker'] },
  { id: 'pro', name: 'Pro', price: 19.99, features: ['Unlimited jobs', 'AI quoting', 'Priority marketplace', 'Invoice PDF export', 'Advanced analytics'] },
  { id: 'elite', name: 'Elite', price: 39.99, features: ['Everything in Pro', 'Featured profile', 'Dedicated support', 'Custom branding'] },
];
