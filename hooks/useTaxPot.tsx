import { useContext } from 'react';
import { TaxPotContext } from '@/contexts/TaxPotContext';

export function useTaxPot() {
  const context = useContext(TaxPotContext);
  if (!context) throw new Error('useTaxPot must be used within TaxPotProvider');
  return context;
}
