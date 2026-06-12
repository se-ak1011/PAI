import { useContext } from 'react';
import { AuthContext } from '@/contexts/AuthContext';

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export type { UserProfile, UserRole, SubscriptionStatus } from '@/contexts/AuthContext';
export { getTrialDaysLeft, isContractorTrialActive, isSubscriptionActive } from '@/contexts/AuthContext';
