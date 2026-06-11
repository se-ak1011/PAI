import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { AuthContext } from '@/contexts/AuthContext';

export type ActiveRole = 'contractor' | 'customer' | 'profile';

interface RoleContextType {
  activeRole: ActiveRole;
  setActiveRole: (role: ActiveRole) => void;
  isDualAccount: boolean;
  isContractorAccount: boolean;
  isCustomerAccount: boolean;
}

export const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const auth = useContext(AuthContext);
  const user = auth?.user ?? null;

  const accountType = user?.account_type ?? 'contractor';
  const isDualAccount = accountType === 'both';
  const isContractorAccount = accountType === 'contractor' || accountType === 'both';
  const isCustomerAccount = accountType === 'customer' || accountType === 'both';

  const defaultRole: ActiveRole =
    accountType === 'customer' ? 'customer' : 'contractor';

  const [activeRole, setActiveRole] = useState<ActiveRole>(defaultRole);

  // Reset role when user changes
  useEffect(() => {
    if (user) {
      const def: ActiveRole = user.account_type === 'customer' ? 'customer' : 'contractor';
      setActiveRole(def);
    }
  }, [user?.id, user?.account_type]);

  return (
    <RoleContext.Provider value={{
      activeRole,
      setActiveRole,
      isDualAccount,
      isContractorAccount,
      isCustomerAccount,
    }}>
      {children}
    </RoleContext.Provider>
  );
}
