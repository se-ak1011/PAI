import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import type { ActiveRole } from '@/contexts/RoleContext';

// ─────────────────────────────────────────────
// Role Switcher Bar (dual accounts only)
// ─────────────────────────────────────────────
export function RoleSwitcherBar({ currentTab }: { currentTab?: string }) {
  const { activeRole, setActiveRole, isDualAccount } = useRole();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  if (!isDualAccount) return null;

  const isOnProfileTab = currentTab === 'profile';

  const roles: { id: ActiveRole | 'profile_nav'; label: string; icon: any }[] = [
    { id: 'contractor', label: 'Contractor', icon: 'construction' },
    { id: 'profile_nav', label: 'Profile', icon: 'account-circle' },
    { id: 'customer', label: 'Customer', icon: 'person' },
  ];

  const handlePress = (id: ActiveRole | 'profile_nav') => {
    if (id === 'profile_nav') {
      router.navigate('/(tabs)/profile');
    } else {
      setActiveRole(id as ActiveRole);
      // If we're on the profile tab and switching role, go back to dashboard
      if (isOnProfileTab) router.navigate('/(tabs)');
    }
  };

  const isProfileActive = (id: ActiveRole | 'profile_nav') => {
    if (id === 'profile_nav') return isOnProfileTab;
    if (isOnProfileTab) return false;
    return activeRole === id;
  };

  return (
    <View style={[styles.roleSwitcher, { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }]}>
      <View style={styles.roleSwitcherInner}>
        {roles.map(r => {
          const isActive = isProfileActive(r.id);
          return (
            <Pressable
              key={r.id}
              style={[styles.roleBtn, isActive && styles.roleBtnActive]}
              onPress={() => handlePress(r.id)}
            >
              <MaterialIcons
                name={r.icon}
                size={16}
                color={isActive ? Colors.textInverse : Colors.textMuted}
              />
              <Text style={[styles.roleBtnText, isActive && styles.roleBtnTextActive]}>
                {r.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
// Tab Layout
// ─────────────────────────────────────────────
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { activeRole, isDualAccount, isContractorAccount, isCustomerAccount } = useRole();

  const accountType = user?.account_type ?? 'contractor';

  // For dual accounts, the bottom tabs change with active role
  // For single-role accounts, static tabs
  const showContractorTabs = isDualAccount
    ? (activeRole === 'contractor' || activeRole === 'profile')
    : isContractorAccount;

  const showCustomerTabs = isDualAccount
    ? activeRole === 'customer'
    : isCustomerAccount;

  const tabBarStyle = {
    height: Platform.select({ ios: insets.bottom + 60, android: insets.bottom + 60, default: 70 }),
    paddingTop: 8,
    paddingBottom: Platform.select({ ios: insets.bottom + 8, android: insets.bottom + 8, default: 8 }),
    backgroundColor: Colors.bg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: Colors.primaryGlow,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '500', letterSpacing: 0.5, textTransform: 'uppercase' },
      }}
    >
      {/* DASHBOARD — always visible */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="dashboard" size={size} color={color} />,
        }}
      />

      {/* JOBS */}
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Jobs',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons
              name={showContractorTabs ? 'work' : 'assignment'}
              size={size}
              color={color}
            />
          ),
        }}
      />

      {/* TAX POT — contractor only */}
      <Tabs.Screen
        name="taxpot"
        options={{
          title: 'Tax Pot',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="savings" size={size} color={color} />,
          href: showContractorTabs ? undefined : null,
        }}
      />

      {/* MARKETPLACE */}
      <Tabs.Screen
        name="marketplace"
        options={{
          title: 'Marketplace',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="people" size={size} color={color} />,
        }}
      />

      {/* PROFILE — always accessible, hidden from tab bar for dual accounts (accessed via role switcher) */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="person" size={size} color={color} />,
          href: !isDualAccount ? undefined : null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  roleSwitcher: {
    backgroundColor: Colors.bg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  roleSwitcherInner: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 4,
    gap: 2,
  },
  roleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: Radius.pill,
  },
  roleBtnActive: { backgroundColor: Colors.primary },
  roleBtnText: { ...Typography.btnSM, color: Colors.textMuted },
  roleBtnTextActive: { color: Colors.textInverse },
});
