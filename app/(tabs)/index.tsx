import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { useAuth, getTrialDaysLeft, isSubscriptionActive } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { useJobs } from '@/hooks/useJobs';
import { useTaxPot } from '@/hooks/useTaxPot';
import { AddIncomeModal } from '@/components/feature/AddIncomeModal';
import { CreateJobModal } from '@/components/feature/CreateJobModal';
import { PostJobModal } from '@/components/feature/PostJobModal';
import { MaterialIcons } from '@expo/vector-icons';
import { useAlert } from '@/template/ui';
import { RoleSwitcherBar } from './_layout';

const { width } = Dimensions.get('window');

function getDayGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Morning,';
  if (h < 17) return 'Hey,';
  return 'Evening,';
}

function getDateLabel(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).toUpperCase();
}

// ─────────────────────────────────────────────
// Contractor Dashboard
// ─────────────────────────────────────────────
function ContractorDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { privateJobs } = useJobs();
  const { summary } = useTaxPot();
  const { showAlert } = useAlert();
  const [showIncome, setShowIncome] = useState(false);
  const [showJob, setShowJob] = useState(false);

  const activeJobs = privateJobs.filter(j => ['active', 'in_progress', 'accepted'].includes(j.status));
  const invoicedJobs = privateJobs.filter(j => j.status === 'invoiced');
  const totalEarnings = privateJobs
    .filter(j => j.status === 'paid')
    .reduce((s, j) => s + j.total, 0);

  const trialDays = getTrialDaysLeft(user);
  const subActive = isSubscriptionActive(user);
  const isOnTrial = user?.subscription_status === 'free_trial' && trialDays > 0;

  const setupItems = [
    {
      label: 'Complete your profile',
      done: !!(user?.city && user?.trades?.length),
      route: '/(tabs)/profile',
    },
    {
      label: 'Add your rates',
      done: !!(user?.hourly_rate_from || user?.hourly_rate),
      route: '/(tabs)/profile',
    },
    {
      label: 'Connect payouts (Stripe)',
      done: false,
      route: '/(tabs)/profile',
    },
    {
      label: 'Send your first quote',
      done: privateJobs.length > 0,
      route: '/(tabs)/jobs',
    },
  ];
  const doneCount = setupItems.filter(i => i.done).length;
  const setupProgress = doneCount / setupItems.length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      <View style={styles.topBar}>
        <Text style={styles.dashTitle}>Dashboard</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.bellBtn} onPress={() => router.push('/messages')}>
            <MaterialIcons name="chat-bubble-outline" size={21} color={Colors.textSecondary} />
          </Pressable>
          <Pressable style={styles.bellBtn} onPress={() => showAlert('Notifications', 'No new notifications.')}>
            <MaterialIcons name="notifications-none" size={22} color={Colors.textSecondary} />
          </Pressable>
        </View>
      </View>
      <View style={styles.topDivider} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.greetRow}>
          <Text style={styles.dateLabel}>{getDateLabel()}</Text>
          <Text style={styles.greetLine}>
            {getDayGreeting()} <Text style={styles.greetName}>{user?.display_name?.split(' ')[0]}.</Text>
          </Text>
        </View>

        {/* Earnings Card */}
        <View style={styles.earningsCard}>
          <Text style={styles.earningsCardLabel}>EARNINGS · {new Date().getFullYear()}</Text>
          <Text style={styles.earningsAmount}>
            <Text style={styles.earningsSymbol}>£</Text>
            {totalEarnings.toFixed(2)}
          </Text>
          <View style={styles.earningsRow}>
            <View>
              <Text style={styles.earningsSub}>EST. SET-ASIDE</Text>
              <Text style={styles.earningsSubVal}>£{summary.totalSetAside.toFixed(2)}</Text>
            </View>
            <View>
              <Text style={styles.earningsSub}>ACTIVE JOBS</Text>
              <Text style={styles.earningsSubVal}>{activeJobs.length}</Text>
            </View>
          </View>
        </View>

        {/* Subscription setup now happens in onboarding — only surface a
            payment-failed alert here, not the trial promo card. */}
        {user?.subscription_status === 'past_due' ? (
          <View style={[styles.trialCard, { borderColor: Colors.error }]}>
            <View style={styles.trialHeader}>
              <MaterialIcons name="warning" size={16} color={Colors.error} />
              <Text style={[styles.trialBadge, { color: Colors.error }]}>PAYMENT DUE</Text>
            </View>
            <Text style={styles.trialSubtext}>Your subscription payment failed. Update your payment method to continue using contractor tools.</Text>
            <Pressable style={[styles.addPaymentBtn, { backgroundColor: Colors.error }]} onPress={() => router.navigate('/(tabs)/profile')}>
              <Text style={styles.addPaymentBtnText}>Update payment method</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Get set up */}
        {doneCount < setupItems.length ? (
          <View style={styles.setupCard}>
            <View style={styles.setupHeader}>
              <Text style={styles.setupTitle}>Get set up</Text>
              <Text style={styles.setupCount}>{doneCount}/{setupItems.length} done</Text>
            </View>
            <View style={styles.setupBar}>
              <View style={[styles.setupBarFill, { width: `${setupProgress * 100}%` as any }]} />
            </View>
            {setupItems.map(item => (
              <Pressable key={item.label} style={styles.setupItem} onPress={() => router.navigate(item.route as any)}>
                <View style={[styles.setupCheck, item.done && styles.setupCheckDone]}>
                  {item.done ? <MaterialIcons name="check" size={12} color={Colors.textInverse} /> : null}
                </View>
                <Text style={[styles.setupItemText, item.done && styles.setupItemTextDone]}>
                  {item.label}
                </Text>
                <MaterialIcons name="chevron-right" size={18} color={Colors.textMuted} />
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* Quick Actions */}
        <View style={styles.quickGrid}>
          <Pressable style={styles.quickBtn} onPress={() => setShowJob(true)}>
            <MaterialIcons name="add" size={26} color={Colors.primaryGlow} />
            <Text style={styles.quickLabel}>New job</Text>
          </Pressable>
          <Pressable style={styles.quickBtn} onPress={() => router.navigate('/(tabs)/taxpot')}>
            <MaterialIcons name="savings" size={26} color={Colors.primaryGlow} />
            <Text style={styles.quickLabel}>Set-aside</Text>
          </Pressable>
          <Pressable style={styles.quickBtn} onPress={() => router.navigate('/(tabs)/jobs')}>
            <MaterialIcons name="folder-open" size={26} color={Colors.primaryGlow} />
            <Text style={styles.quickLabel}>Jobs ({privateJobs.length})</Text>
          </Pressable>
          <Pressable style={styles.quickBtn} onPress={() => router.navigate('/(tabs)/marketplace')}>
            <MaterialIcons name="people" size={26} color={Colors.primaryGlow} />
            <Text style={styles.quickLabel}>Marketplace</Text>
          </Pressable>
        </View>

        {/* Active Jobs */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Active jobs</Text>
          <Text style={styles.sectionValue}>£{activeJobs.reduce((s, j) => s + j.total, 0).toFixed(2)}</Text>
        </View>
        {activeJobs.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyCardText}>No active jobs. Tap “New job” to quote one.</Text>
          </View>
        ) : (
          activeJobs.slice(0, 3).map(j => (
            <Pressable
              key={j.id}
              style={styles.jobRow}
              onPress={() => router.push({ pathname: '/job-detail', params: { id: j.id } })}
            >
              <View style={styles.jobRowLeft}>
                <Text style={styles.jobRowTitle} numberOfLines={1}>{j.title}</Text>
                <Text style={styles.jobRowSub}>{j.customer} · {j.status}</Text>
              </View>
              <Text style={styles.jobRowAmount}>£{j.total.toLocaleString()}</Text>
            </Pressable>
          ))
        )}

        {/* Recent Invoices */}
        <View style={[styles.sectionRow, { marginTop: Spacing.md }]}>
          <Text style={styles.sectionTitle}>Recent invoices</Text>
        </View>
        {invoicedJobs.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyCardText}>No invoices yet.</Text>
          </View>
        ) : (
          invoicedJobs.slice(0, 3).map(j => (
            <Pressable
              key={j.id}
              style={styles.jobRow}
              onPress={() => router.push({ pathname: '/job-detail', params: { id: j.id } })}
            >
              <View style={styles.jobRowLeft}>
                <Text style={styles.jobRowTitle} numberOfLines={1}>{j.title}</Text>
                <Text style={styles.jobRowSub}>{j.customer}</Text>
              </View>
              <Text style={[styles.jobRowAmount, { color: Colors.warning }]}>£{j.total.toLocaleString()}</Text>
            </Pressable>
          ))
        )}
      </ScrollView>

      <RoleSwitcherBar />
      <AddIncomeModal visible={showIncome} onClose={() => setShowIncome(false)} />
      <CreateJobModal visible={showJob} onClose={() => setShowJob(false)} />
    </View>
  );
}

// ─────────────────────────────────────────────
// Customer Dashboard
// ─────────────────────────────────────────────
function CustomerDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { jobPosts } = useJobs();
  const { showAlert } = useAlert();
  const [showPostJob, setShowPostJob] = useState(false);

  const myPosts = jobPosts.filter(p => p.client_id === user?.id);
  const openPosts = myPosts.filter(p => p.status === 'open');
  const activePosts = myPosts.filter(p => p.status === 'in_progress');

  const setupItems = [
    { label: 'Complete your profile', done: !!(user as any)?.customer_profile_complete, route: '/(tabs)/profile' },
    { label: 'Post your first job', done: myPosts.length > 0, route: '/(tabs)/marketplace' },
  ];
  const doneCount = setupItems.filter(i => i.done).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      <View style={styles.topBar}>
        <Text style={styles.dashTitle}>Dashboard</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.bellBtn} onPress={() => router.push('/messages')}>
            <MaterialIcons name="chat-bubble-outline" size={21} color={Colors.textSecondary} />
          </Pressable>
          <Pressable style={styles.bellBtn} onPress={() => showAlert('Notifications', 'No new notifications.')}>
            <MaterialIcons name="notifications-none" size={22} color={Colors.textSecondary} />
          </Pressable>
        </View>
      </View>
      <View style={styles.topDivider} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.greetRow}>
          <Text style={styles.customerModeLabel}>CUSTOMER</Text>
          <Text style={styles.greetLine}>
            Hi, <Text style={styles.greetName}>{user?.display_name?.split(' ')[0]}.</Text>
          </Text>
        </View>

        <View style={styles.earningsCard}>
          <Text style={styles.earningsCardLabel}>YOUR JOBS</Text>
          <Text style={styles.earningsAmount}>{myPosts.length}</Text>
          <View style={styles.earningsRow}>
            <View>
              <Text style={styles.earningsSub}>OPEN</Text>
              <Text style={styles.earningsSubVal}>{openPosts.length}</Text>
            </View>
            <View>
              <Text style={styles.earningsSub}>IN PROGRESS</Text>
              <Text style={styles.earningsSubVal}>{activePosts.length}</Text>
            </View>
          </View>
        </View>

        <View style={styles.quickGrid}>
          <Pressable style={styles.quickBtn} onPress={() => setShowPostJob(true)}>
            <MaterialIcons name="add" size={26} color={Colors.primaryGlow} />
            <Text style={styles.quickLabel}>Post a job</Text>
          </Pressable>
          <Pressable style={styles.quickBtn} onPress={() => router.navigate('/(tabs)/jobs')}>
            <MaterialIcons name="assignment" size={26} color={Colors.primaryGlow} />
            <Text style={styles.quickLabel}>My jobs</Text>
          </Pressable>
          <Pressable style={styles.quickBtn} onPress={() => router.navigate('/(tabs)/marketplace')}>
            <MaterialIcons name="location-on" size={26} color={Colors.primaryGlow} />
            <Text style={styles.quickLabel}>Trades near me</Text>
          </Pressable>
          <Pressable style={styles.quickBtn} onPress={() => router.navigate('/(tabs)/marketplace')}>
            <MaterialIcons name="storefront" size={26} color={Colors.primaryGlow} />
            <Text style={styles.quickLabel}>Find trades</Text>
          </Pressable>
        </View>

        {doneCount < setupItems.length ? (
          <View style={styles.setupCard}>
            <View style={styles.setupHeader}>
              <Text style={styles.setupTitle}>Get set up</Text>
              <Text style={styles.setupCount}>{doneCount}/{setupItems.length} done</Text>
            </View>
            <View style={styles.setupBar}>
              <View style={[styles.setupBarFill, { width: `${(doneCount / setupItems.length) * 100}%` as any }]} />
            </View>
            {setupItems.map(item => (
              <Pressable key={item.label} style={styles.setupItem} onPress={() => router.navigate(item.route as any)}>
                <View style={[styles.setupCheck, item.done && styles.setupCheckDone]}>
                  {item.done ? <MaterialIcons name="check" size={12} color={Colors.textInverse} /> : null}
                </View>
                <Text style={[styles.setupItemText, item.done && styles.setupItemTextDone]}>
                  {item.label}
                </Text>
                <MaterialIcons name="chevron-right" size={18} color={Colors.textMuted} />
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Recent activity</Text>
        </View>
        {myPosts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyCardText}>No jobs yet. Post one to get quotes from local trades.</Text>
          </View>
        ) : (
          myPosts.slice(0, 4).map(p => (
            <Pressable
              key={p.id}
              style={styles.jobRow}
              onPress={() => router.push({ pathname: '/marketplace-job', params: { id: p.id } })}
            >
              <View style={styles.jobRowLeft}>
                <Text style={styles.jobRowTitle} numberOfLines={1}>{p.title}</Text>
                <Text style={styles.jobRowSub}>{p.city} · {p.applications} quotes</Text>
              </View>
              <Text style={styles.jobRowAmount}>£{p.budget.toLocaleString()}</Text>
            </Pressable>
          ))
        )}
      </ScrollView>

      <RoleSwitcherBar />
      <PostJobModal visible={showPostJob} onClose={() => setShowPostJob(false)} />
    </View>
  );
}

// ─────────────────────────────────────────────
// Root — dispatch based on active role
// ─────────────────────────────────────────────
export default function DashboardScreen() {
  const { activeRole, isDualAccount } = useRole();
  const { user } = useAuth();

  if (isDualAccount) {
    if (activeRole === 'contractor') return <ContractorDashboard />;
    if (activeRole === 'customer') return <CustomerDashboard />;
  }

  if (user?.account_type === 'customer') return <CustomerDashboard />;
  return <ContractorDashboard />;
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 12,
  },
  dashTitle: { ...Typography.brandMD },
  bellBtn: { padding: 4 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topDivider: { height: 1, backgroundColor: Colors.border },
  scroll: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 120 },
  greetRow: { gap: 4 },
  dateLabel: { ...Typography.labelXS, color: Colors.textMuted },
  customerModeLabel: { ...Typography.labelXS, color: Colors.textMuted },
  greetLine: { fontSize: 30, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.6 },
  greetName: { color: Colors.primaryGlow },
  earningsCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: 20, gap: 12,
  },
  earningsCardLabel: { ...Typography.labelXS },
  earningsAmount: { fontSize: 40, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -1 },
  earningsSymbol: { fontSize: 30, fontWeight: '700' },
  earningsRow: { flexDirection: 'row', gap: 40 },
  earningsSub: { ...Typography.labelXS, marginBottom: 2 },
  earningsSubVal: { ...Typography.dataMD },
  trialCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: 20, gap: 10,
  },
  trialHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trialBadge: { ...Typography.labelXS, color: Colors.primaryGlow, letterSpacing: 0.8 },
  trialPrice: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  trialPound: { fontSize: 20 },
  trialPriceSub: { fontSize: 18, fontWeight: '500', color: Colors.textSecondary },
  trialSubtext: { ...Typography.bodySM, color: Colors.textSecondary },
  addPaymentBtn: {
    height: 52, backgroundColor: Colors.primary, borderRadius: Radius.lg,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  addPaymentBtnText: { ...Typography.btnMD, color: Colors.textInverse },
  setupCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: 18, gap: 0,
  },
  setupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  setupTitle: { ...Typography.brandSM },
  setupCount: { ...Typography.labelSM },
  setupBar: { height: 3, backgroundColor: Colors.border, borderRadius: 2, marginBottom: 14 },
  setupBarFill: { height: 3, backgroundColor: Colors.primary, borderRadius: 2 },
  setupItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 13, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  setupCheck: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  setupCheckDone: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  setupItemText: { ...Typography.bodyMD, flex: 1 },
  setupItemTextDone: { color: Colors.textMuted, textDecorationLine: 'line-through' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickBtn: {
    width: (width - Spacing.md * 2 - 10) / 2,
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: 20, gap: 10,
  },
  quickLabel: { ...Typography.bodyMD },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { ...Typography.brandSM },
  sectionValue: { ...Typography.dataMD, color: Colors.textSecondary },
  jobRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: 14,
  },
  jobRowLeft: { flex: 1, gap: 3 },
  jobRowTitle: { ...Typography.dataMD },
  jobRowSub: { ...Typography.labelSM },
  jobRowAmount: { ...Typography.dataMD, color: Colors.success },
  emptyCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: 28, alignItems: 'center',
  },
  emptyCardText: { ...Typography.bodyMD, color: Colors.textMuted, textAlign: 'center' },
});
