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
// Separates account MODE (Contractor / Customer)
// from page navigation — Profile lives in the tab bar.
// ─────────────────────────────────────────────
export function RoleSwitcherBar({ currentTab }: { currentTab?: string }) {
  const { activeRole, setActiveRole, isDualAccount } = useRole();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  if (!isDualAccount) return null;

  const modes: { id: ActiveRole; label: string; icon: any; sub: string }[] = [
    { id: 'contractor', label: 'Contractor mode', icon: 'construction', sub: 'Work & income' },
    { id: 'customer', label: 'Customer mode', icon: 'person', sub: 'Hire tradespeople' },
  ];

  const handlePress = (id: ActiveRole) => {
    setActiveRole(id);
    // Navigate to dashboard so content reflects the new mode
    if (currentTab !== 'profile') router.navigate('/(tabs)');
  };

  return (
    <View style={[styles.roleSwitcher, { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }]}>
      <Text style={styles.roleSwitcherLabel}>ACTIVE MODE</Text>
      <View style={styles.roleSwitcherInner}>
        {modes.map(r => {
          const isActive = activeRole === r.id;
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
              <View style={{ flex: 1 }}>
                <Text style={[styles.roleBtnText, isActive && styles.roleBtnTextActive]}>
                  {r.label}
                </Text>
                <Text style={[styles.roleBtnSub, isActive && styles.roleBtnSubActive]}>
                  {r.sub}
                </Text>
              </View>
              {isActive ? (
                <MaterialIcons name="check" size={14} color={Colors.textInverse} />
              ) : null}
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

  const showContractorTabs = isDualAccount
    ? activeRole === 'contractor'
    : isContractorAccount;

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
          title: 'Market',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="storefront" size={size} color={color} />,
        }}
      />

      {/* PROFILE — always visible in tab bar for ALL account types */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="person" size={size} color={color} />,
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
    gap: 6,
  },
  roleSwitcherLabel: {
    ...Typography.labelXS,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  roleSwitcherInner: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 4,
    gap: 4,
  },
  roleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.md,
  },
  roleBtnActive: { backgroundColor: Colors.primary },
  roleBtnText: { ...Typography.btnSM, color: Colors.textMuted },
  roleBtnTextActive: { color: Colors.textInverse },
  roleBtnSub: { fontSize: 10, color: Colors.textMuted, fontWeight: '400' as const, marginTop: 1 },
  roleBtnSubActive: { color: Colors.primaryLight },
});
