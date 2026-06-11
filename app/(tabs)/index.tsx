import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { useJobs } from '@/hooks/useJobs';
import { useTaxPot } from '@/hooks/useTaxPot';
import { AddIncomeModal } from '@/components/feature/AddIncomeModal';
import { CreateJobModal } from '@/components/feature/CreateJobModal';
import { MaterialIcons } from '@expo/vector-icons';
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

function getTrialDaysLeft(trialStarted?: string | null): number {
  if (!trialStarted) return 14;
  const start = new Date(trialStarted);
  const expiry = new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);
  const diff = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

// ─────────────────────────────────────────────
// Contractor Dashboard
// ─────────────────────────────────────────────
function ContractorDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { privateJobs } = useJobs();
  const { summary } = useTaxPot();
  const [showIncome, setShowIncome] = useState(false);
  const [showJob, setShowJob] = useState(false);

  const activeJobs = privateJobs.filter(j => j.status === 'active' || j.status === 'quoted');
  const invoicedJobs = privateJobs.filter(j => j.status === 'invoiced');
  const totalEarnings = privateJobs
    .filter(j => j.status === 'paid')
    .reduce((s, j) => s + j.total, 0);

  const trialDays = getTrialDaysLeft((user as any)?.trial_started_at);
  const isOnTrial = trialDays > 0;

  // "Get set up" checklist
  const setupItems = [
    { label: 'Complete your profile', done: !!(user?.city && user?.trades?.length), route: '/(tabs)/profile' },
    { label: 'Connect payouts (Stripe)', done: false, route: '/(tabs)/profile' },
    { label: 'Add availability', done: false, route: '/(tabs)/profile' },
    { label: 'Send your first quote', done: privateJobs.length > 0, route: '/(tabs)/jobs' },
  ];
  const doneCount = setupItems.filter(i => i.done).length;
  const setupProgress = doneCount / setupItems.length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />

      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.dashTitle}>Dashboard</Text>
        <Pressable style={styles.bellBtn} onPress={() => {}}>
          <MaterialIcons name="notifications-none" size={22} color={Colors.textSecondary} />
        </Pressable>
      </View>
      <View style={styles.topDivider} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Greeting */}
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

        {/* Trial/Subscription Card */}
        {isOnTrial ? (
          <View style={styles.trialCard}>
            <View style={styles.trialHeader}>
              <MaterialIcons name="auto-awesome" size={16} color={Colors.primaryGlow} />
              <Text style={styles.trialBadge}>FREE TRIAL — {trialDays} DAYS LEFT</Text>
            </View>
            <Text style={styles.trialPrice}>
              <Text style={styles.trialPound}>£</Text>25
              <Text style={styles.trialPriceSub}>/month after trial</Text>
            </Text>
            <Text style={styles.trialSubtext}>
              You keep 100% of every job — We don&apos;t take a cut!
            </Text>
            <Pressable
              style={styles.addPaymentBtn}
              onPress={() => router.push('/(tabs)/profile')}
            >
              <Text style={styles.addPaymentBtnText}>Add payment method</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Get set up checklist */}
        {doneCount < setupItems.length ? (
          <View style={styles.setupCard}>
            <View style={styles.setupHeader}>
              <Text style={styles.setupTitle}>Get set up</Text>
              <Text style={styles.setupCount}>{doneCount}/{setupItems.length} done</Text>
            </View>
            <View style={styles.setupBar}>
              <View style={[styles.setupBarFill, { width: `${setupProgress * 100}%` }]} />
            </View>
            {setupItems.map(item => (
              <Pressable key={item.label} style={styles.setupItem} onPress={() => router.push(item.route as any)}>
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

        {/* 2x2 Quick Actions */}
        <View style={styles.quickGrid}>
          <Pressable style={styles.quickBtn} onPress={() => setShowJob(true)}>
            <MaterialIcons name="add" size={26} color={Colors.primaryGlow} />
            <Text style={styles.quickLabel}>New job</Text>
          </Pressable>
          <Pressable style={styles.quickBtn} onPress={() => router.push('/(tabs)/taxpot')}>
            <MaterialIcons name="savings" size={26} color={Colors.primaryGlow} />
            <Text style={styles.quickLabel}>Set-aside</Text>
          </Pressable>
          <Pressable style={styles.quickBtn} onPress={() => router.push('/(tabs)/jobs')}>
            <MaterialIcons name="folder-open" size={26} color={Colors.primaryGlow} />
            <Text style={styles.quickLabel}>Jobs ({privateJobs.length})</Text>
          </Pressable>
          <Pressable style={styles.quickBtn} onPress={() => router.push('/(tabs)/marketplace')}>
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
            <Text style={styles.emptyCardText}>No active jobs. Tap "New job" to quote one.</Text>
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
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
// Customer Dashboard
// ─────────────────────────────────────────────
function CustomerDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { jobPosts } = useJobs();

  const myPosts = jobPosts.filter(p => p.client_id === user?.id);
  const openPosts = myPosts.filter(p => p.status === 'open');
  const activePosts = myPosts.filter(p => p.status === 'in_progress');

  const setupItems = [
    { label: 'Complete your profile', done: !!(user as any)?.customer_profile_complete, route: '/(tabs)/profile' },
    { label: 'Post your first job', done: myPosts.length > 0, route: '/(tabs)/marketplace' },
  ];
  const doneCount = setupItems.filter(i => i.done).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />

      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.dashTitle}>Dashboard</Text>
        <Pressable style={styles.bellBtn}>
          <MaterialIcons name="notifications-none" size={22} color={Colors.textSecondary} />
        </Pressable>
      </View>
      <View style={styles.topDivider} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Greeting */}
        <View style={styles.greetRow}>
          <Text style={styles.customerModeLabel}>CUSTOMER</Text>
          <Text style={styles.greetLine}>
            Hi, <Text style={styles.greetName}>{user?.display_name?.split(' ')[0]}.</Text>
          </Text>
        </View>

        {/* YOUR JOBS card */}
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

        {/* 2x2 Quick Actions */}
        <View style={styles.quickGrid}>
          <Pressable style={styles.quickBtn} onPress={() => router.push('/(tabs)/marketplace')}>
            <MaterialIcons name="add" size={26} color={Colors.primaryGlow} />
            <Text style={styles.quickLabel}>Post a job</Text>
          </Pressable>
          <Pressable style={styles.quickBtn} onPress={() => router.push('/(tabs)/jobs')}>
            <MaterialIcons name="assignment" size={26} color={Colors.primaryGlow} />
            <Text style={styles.quickLabel}>My jobs</Text>
          </Pressable>
          <Pressable style={styles.quickBtn} onPress={() => router.push('/(tabs)/marketplace')}>
            <MaterialIcons name="location-on" size={26} color={Colors.primaryGlow} />
            <Text style={styles.quickLabel}>Trades near me</Text>
          </Pressable>
          <Pressable style={styles.quickBtn} onPress={() => router.push('/(tabs)/marketplace')}>
            <MaterialIcons name="chat-bubble-outline" size={26} color={Colors.primaryGlow} />
            <Text style={styles.quickLabel}>Messages</Text>
          </Pressable>
        </View>

        {/* Get set up */}
        {doneCount < setupItems.length ? (
          <View style={styles.setupCard}>
            <View style={styles.setupHeader}>
              <Text style={styles.setupTitle}>Get set up</Text>
              <Text style={styles.setupCount}>{doneCount}/{setupItems.length} done</Text>
            </View>
            <View style={styles.setupBar}>
              <View style={[styles.setupBarFill, { width: `${(doneCount / setupItems.length) * 100}%` }]} />
            </View>
            {setupItems.map(item => (
              <Pressable key={item.label} style={styles.setupItem} onPress={() => router.push(item.route as any)}>
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

        {/* Recent activity */}
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
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
// Profile Dashboard (dual accounts only)
// ─────────────────────────────────────────────
function ProfileDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { jobPosts } = useJobs();

  const myPosts = jobPosts.filter(p => p.client_id === user?.id);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      <View style={styles.topBar}>
        <Text style={styles.dashTitle}>Profile</Text>
        <View style={styles.topBarRight}>
          <Pressable style={styles.iconBtn} onPress={() => {}}>
            <MaterialIcons name="edit" size={18} color={Colors.textSecondary} />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => router.push('/(tabs)/profile')}>
            <MaterialIcons name="settings" size={18} color={Colors.textSecondary} />
          </Pressable>
          <Pressable style={styles.bellBtn}>
            <MaterialIcons name="notifications-none" size={22} color={Colors.textSecondary} />
          </Pressable>
        </View>
      </View>
      <View style={styles.topDivider} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            {user?.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatarImg} contentFit="cover" />
            ) : (
              <MaterialIcons name="person" size={36} color={Colors.textInverse} />
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.display_name}</Text>
            <View style={styles.profileLocRow}>
              <MaterialIcons name="location-on" size={14} color={Colors.textMuted} />
              <Text style={styles.profileLoc}>{user?.city || 'Location not set'}</Text>
            </View>
          </View>
        </View>

        {/* Recent jobs */}
        <Text style={styles.sectionTitle}>Your recent jobs</Text>
        {myPosts.length === 0 ? (
          <Text style={styles.emptyInline}>You haven&apos;t posted any jobs yet.</Text>
        ) : (
          myPosts.slice(0, 3).map(p => (
            <View key={p.id} style={styles.jobRow}>
              <View style={styles.jobRowLeft}>
                <Text style={styles.jobRowTitle}>{p.title}</Text>
                <Text style={styles.jobRowSub}>{p.city}</Text>
              </View>
              <Text style={styles.jobRowAmount}>£{p.budget.toLocaleString()}</Text>
            </View>
          ))
        )}

        {/* Trades near you */}
        <Text style={[styles.sectionTitle, { marginTop: Spacing.md }]}>Trades near you</Text>
        {[
          { name: 'Alex Painter', trade: 'Painter & Decorator', city: 'London' },
          { name: 'Jordan Sparks', trade: 'Electrician', city: 'London' },
          { name: 'Riley Both', trade: 'Handyman', city: 'London' },
        ].map(c => (
          <Pressable
            key={c.name}
            style={styles.tradeCard}
            onPress={() => router.push('/(tabs)/marketplace')}
          >
            <View style={styles.tradeIconCircle}>
              <MaterialIcons name="construction" size={18} color={Colors.primaryGlow} />
            </View>
            <View style={styles.tradeInfo}>
              <Text style={styles.tradeName}>{c.name}</Text>
              <Text style={styles.tradeSub}>{c.trade}</Text>
              <View style={styles.tradeLocRow}>
                <MaterialIcons name="location-on" size={12} color={Colors.textMuted} />
                <Text style={styles.tradeLoc}>{c.city}</Text>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <RoleSwitcherBar />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
// Root — dispatch based on active role
// ─────────────────────────────────────────────
export default function DashboardScreen() {
  const { activeRole, isDualAccount } = useRole();

  if (isDualAccount) {
    if (activeRole === 'contractor') return <ContractorDashboard />;
    if (activeRole === 'customer') return <CustomerDashboard />;
    if (activeRole === 'profile') return <ProfileDashboard />;
  }

  const { user } = useAuth();
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
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dashTitle: { ...Typography.brandMD },
  bellBtn: { padding: 4 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  topDivider: { height: 1, backgroundColor: Colors.border },
  scroll: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 120 },

  // Greeting
  greetRow: { gap: 4 },
  dateLabel: { ...Typography.labelXS, color: Colors.textMuted },
  customerModeLabel: { ...Typography.labelXS, color: Colors.textMuted },
  greetLine: { fontSize: 36, fontStyle: 'italic', fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.5 },
  greetName: { color: Colors.primaryGlow },

  // Earnings card
  earningsCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    gap: 12,
  },
  earningsCardLabel: { ...Typography.labelXS },
  earningsAmount: { fontSize: 42, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -1 },
  earningsSymbol: { fontSize: 30, fontWeight: '700' },
  earningsRow: { flexDirection: 'row', gap: 40 },
  earningsSub: { ...Typography.labelXS, marginBottom: 2 },
  earningsSubVal: { ...Typography.dataMD },

  // Trial card
  trialCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    gap: 10,
  },
  trialHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trialBadge: { ...Typography.labelXS, color: Colors.primaryGlow, letterSpacing: 0.8 },
  trialPrice: { fontSize: 28, fontStyle: 'italic', fontWeight: '700', color: Colors.textPrimary },
  trialPound: { fontSize: 20 },
  trialPriceSub: { fontSize: 18, fontStyle: 'italic', fontWeight: '400', color: Colors.textSecondary },
  trialSubtext: { ...Typography.bodySM, color: Colors.textSecondary },
  addPaymentBtn: {
    height: 52,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  addPaymentBtnText: { ...Typography.btnMD, color: Colors.textInverse },

  // Setup card
  setupCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 0,
  },
  setupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  setupTitle: { ...Typography.brandSM },
  setupCount: { ...Typography.labelSM },
  setupBar: { height: 3, backgroundColor: Colors.border, borderRadius: 2, marginBottom: 14 },
  setupBarFill: { height: 3, backgroundColor: Colors.primary, borderRadius: 2 },
  setupItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 13,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  setupCheck: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  setupCheckDone: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  setupItemText: { ...Typography.bodyMD, flex: 1 },
  setupItemTextDone: { color: Colors.textMuted, textDecorationLine: 'line-through' },

  // Quick grid
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickBtn: {
    width: (width - Spacing.md * 2 - 10) / 2,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    gap: 10,
  },
  quickLabel: { ...Typography.bodyMD },

  // Section headers
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { ...Typography.brandSM },
  sectionValue: { ...Typography.dataMD, color: Colors.textSecondary },

  // Job rows
  jobRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: 14,
  },
  jobRowLeft: { flex: 1, gap: 3 },
  jobRowTitle: { ...Typography.dataMD },
  jobRowSub: { ...Typography.labelSM },
  jobRowAmount: { ...Typography.dataMD, color: Colors.success },

  // Empty states
  emptyCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: 28, alignItems: 'center',
  },
  emptyCardText: { ...Typography.bodyMD, color: Colors.textMuted, textAlign: 'center' },
  emptyInline: { ...Typography.bodyMD, color: Colors.textMuted },

  // Profile dashboard
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: 18,
  },
  profileAvatar: {
    width: 64, height: 64, borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImg: { width: 64, height: 64 },
  profileInfo: { flex: 1, gap: 6 },
  profileName: { ...Typography.brandSM },
  profileLocRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  profileLoc: { ...Typography.labelMD },

  // Trade cards
  tradeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: 16,
  },
  tradeIconCircle: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.primaryDim, alignItems: 'center', justifyContent: 'center',
  },
  tradeInfo: { flex: 1, gap: 2 },
  tradeName: { ...Typography.dataMD },
  tradeSub: { ...Typography.labelMD },
  tradeLocRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  tradeLoc: { ...Typography.labelSM },
});
