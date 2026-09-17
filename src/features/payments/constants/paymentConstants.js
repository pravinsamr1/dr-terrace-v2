/**
 * Payments Feature Constants & Fallback Values
 */

export const PAYMENT_DEFAULTS = {
  TOTAL_PROJECT_COST: 59000,
  TOTAL_PAYMENT: 100000,
  MILESTONE_RATIOS: {
    INITIAL: 0.50,
    MID_TERM: 0.40,
    FINAL: 0.10,
  },
  DEFAULT_RECEIPT_DATE: '25-07-2026',
  DEFAULT_PAYMENT_METHOD: 'UPI',
  PAYMENT_METHODS: ['UPI', 'Cash', 'Bank Transfer', 'Cheque'],
  STAGES: {
    INITIAL: 'Initial Payment (50%)',
    MID_TERM: 'Mid-Term Payment (40%)',
    FINAL: 'Final Payment (10%)',
    FULL: 'Full Payment (100%)',
  },
};
