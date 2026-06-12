import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { JobCard } from '@/components/feature/JobCard';
import { CreateJobModal } from '@/components/feature/CreateJobModal';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { useJobs } from '@/hooks/useJobs';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { RoleSwitcherBar } from './_layout';
import { PostJobModal } from '@/components/feature/PostJobModal';

const CONTRACTOR_FILTERS = ['All', 'Draft', 'Sent', 'Active', 'Invoiced', 'Paid'];
const CUSTOMER_FILTERS = ['All', 'Open', 'In Progress', 'Completed'];

export default function JobsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { activeRole, isDualAccount, isContractorAccount } = useRole();
  const { privateJobs, jobPosts } = useJobs();
  const [filter, setFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);

  const showingContractor = isDualAccount
    ? activeRole === 'contractor'
    : isContractorAccount;

  if (showingContractor) {
    const statusMap: Record<string, string[]> = {
      All: [],
      Draft: ['draft'],
      Sent: ['sent'],
      Active: ['accepted', 'in_progress', 'contractor_marked_done'],
      Invoiced: ['invoiced'],
      Paid: ['paid'],
    };
    const statusList = statusMap[filter] ?? [];
    const filteredJobs = statusList.length === 0
      ? privateJobs
      : privateJobs.filter(j => statusList.includes(j.status));

    const totalValue = privateJobs.reduce((s, j) => s + j.total, 0);
    const paidValue = privateJobs.filter(j => j.status === 'paid').reduce((s, j) => s + j.total, 0);
    const activeCount = privateJobs.filter(j => ['accepted', 'in_progress', 'contractor_marked_done'].includes(j.status)).length;
    const invoicedCount = privateJobs.filter(j => j.status === 'invoiced').length;

    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>My Jobs</Text>
            <Text style={styles.subtitle}>{privateJobs.length} total · £{totalValue.toLocaleString()} value</Text>
          </View>
          <Pressable style={styles.addBtn} onPress={() => setShowModal(true)}>
            <MaterialIcons name="add" size={22} color={Colors.textInverse} />
          </Pressable>
        </View>

        <View style={styles.statStrip}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{activeCount}</Text>
            <Text style={styles.statLabel}>ACTIVE</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.warning }]}>{invoicedCount}</Text>
            <Text style={styles.statLabel}>INVOICED</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.success }]}>£{paidValue.toLocaleString()}</Text>
            <Text style={styles.statLabel}>COLLECTED</Text>
          </View>
        </View>

        <View style={styles.filterOuter}>
          <FlatList
            horizontal
            data={CONTRACTOR_FILTERS}
            keyExtractor={item => item}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterList}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.filterChip, filter === item && styles.filterChipActive]}
                onPress={() => setFilter(item)}
              >
                <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</Text>
              </Pressable>
            )}
          />
        </View>

        <FlatList
          data={filteredJobs}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Image source={require('@/assets/images/empty-jobs.png')} style={styles.emptyImg} contentFit="contain" />
              <Text style={styles.emptyTitle}>No {filter !== 'All' ? filter.toLowerCase() : ''} jobs</Text>
              <Text style={styles.emptySubtitle}>Create a job to get started</Text>
              <Pressable style={styles.emptyBtn} onPress={() => setShowModal(true)}>
                <Text style={styles.emptyBtnText}>Create Job</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <JobCard
              job={item}
              onPress={() => router.push({ pathname: '/job-detail', params: { id: item.id } })}
            />
          )}
        />

        <CreateJobModal visible={showModal} onClose={() => setShowModal(false)} />
        <RoleSwitcherBar />
      </SafeAreaView>
    );
  }

  // Customer jobs view
  const myPosts = jobPosts.filter(p => p.client_id === user?.id);
  const statusMap: Record<string, string[]> = {
    All: [],
    Open: ['open'],
    'In Progress': ['in_progress'],
    Completed: ['completed'],
  };
  const statusList = statusMap[filter] ?? [];
  const filteredPosts = statusList.length === 0 ? myPosts : myPosts.filter(p => statusList.includes(p.status));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>My Jobs</Text>
          <Text style={styles.subtitle}>{myPosts.length} posted</Text>
        </View>
        <Pressable style={styles.addBtn} onPress={() => setShowModal(true)}>
          <MaterialIcons name="add" size={22} color={Colors.textInverse} />
        </Pressable>
      </View>

      <View style={styles.filterOuter}>
        <FlatList
          horizontal
          data={CUSTOMER_FILTERS}
          keyExtractor={item => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.filterChip, filter === item && styles.filterChipActive]}
              onPress={() => setFilter(item)}
            >
              <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</Text>
            </Pressable>
          )}
        />
      </View>

      <FlatList
        data={filteredPosts}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons name="work-off" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No jobs yet</Text>
            <Text style={styles.emptySubtitle}>Post a job to get quotes from local tradespeople</Text>
            <Pressable style={styles.emptyBtn} onPress={() => setShowModal(true)}>
              <Text style={styles.emptyBtnText}>Post a Job</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.postCard}
            onPress={() => router.push({ pathname: '/marketplace-job', params: { id: item.id } })}
          >
            <View style={styles.postCardLeft}>
              <Text style={styles.postCardTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.postCardSub}>{item.trade} · {item.city} · {item.applications} quotes</Text>
              <View style={[styles.postStatusBadge, item.status === 'open' && styles.postStatusOpen]}>
                <Text style={styles.postStatusText}>{item.status.replace('_', ' ').toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.postBudget}>£{item.budget.toLocaleString()}</Text>
          </Pressable>
        )}
      />

      <PostJobModal visible={showModal} onClose={() => setShowModal(false)} />
      <RoleSwitcherBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: Spacing.md, paddingBottom: Spacing.sm,
  },
  title: { ...Typography.brandMD },
  subtitle: { ...Typography.labelMD, color: Colors.textSecondary, marginTop: 2 },
  addBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  statStrip: {
    flexDirection: 'row', backgroundColor: Colors.card,
    marginHorizontal: Spacing.md, borderRadius: Radius.md, borderWidth: 1,
    borderColor: Colors.border, padding: 12, marginBottom: Spacing.sm,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { ...Typography.dataLG },
  statLabel: { ...Typography.labelXS },
  statDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },
  filterOuter: { minHeight: 52, marginBottom: Spacing.xs },
  filterList: { paddingHorizontal: Spacing.md, gap: 8, alignItems: 'center' },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.pill,
    backgroundColor: Colors.cardAlt, borderWidth: 1, borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { ...Typography.labelMD, color: Colors.textSecondary },
  filterTextActive: { color: Colors.textInverse, fontWeight: '600' },
  list: { padding: Spacing.md, paddingTop: Spacing.xs, paddingBottom: 100 },
  empty: { alignItems: 'center', paddingTop: Spacing.xxl, gap: 12 },
  emptyImg: { width: 160, height: 160 },
  emptyTitle: { ...Typography.headingMD },
  emptySubtitle: { ...Typography.bodyMD, color: Colors.textMuted, textAlign: 'center' },
  emptyBtn: {
    marginTop: 8, paddingHorizontal: 24, paddingVertical: 12,
    backgroundColor: Colors.primary, borderRadius: Radius.md,
  },
  emptyBtnText: { ...Typography.btnMD, color: Colors.textInverse },
  // Customer post cards
  postCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    padding: 16, marginBottom: Spacing.sm,
  },
  postCardLeft: { flex: 1, gap: 5 },
  postCardTitle: { ...Typography.dataMD },
  postCardSub: { ...Typography.labelSM },
  postStatusBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: Radius.pill, borderWidth: 1,
    backgroundColor: Colors.cardAlt, borderColor: Colors.border,
  },
  postStatusOpen: { backgroundColor: Colors.primaryDim, borderColor: Colors.primary },
  postStatusText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, color: Colors.textSecondary },
  postBudget: { ...Typography.dataLG, color: Colors.success },
});
