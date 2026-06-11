import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { JobCard } from '@/components/feature/JobCard';
import { CreateJobModal } from '@/components/feature/CreateJobModal';
import { PBadge } from '@/components/ui/PBadge';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { useJobs } from '@/hooks/useJobs';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { RoleSwitcherBar } from './_layout';

const STATUS_FILTERS = ['All', 'Draft', 'Active', 'Invoiced', 'Paid'];

export default function JobsScreen() {
  const router = useRouter();
  const { privateJobs } = useJobs();
  const [filter, setFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);

  const filteredJobs = filter === 'All'
    ? privateJobs
    : privateJobs.filter(j => j.status === filter.toLowerCase());

  const totalValue = privateJobs.reduce((s, j) => s + j.total, 0);
  const paidValue = privateJobs.filter(j => j.status === 'paid').reduce((s, j) => s + j.total, 0);

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

      {/* Stat strip */}
      <View style={styles.statStrip}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{privateJobs.filter(j => j.status === 'active').length}</Text>
          <Text style={styles.statLabel}>ACTIVE</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: Colors.warning }]}>{privateJobs.filter(j => j.status === 'invoiced').length}</Text>
          <Text style={styles.statLabel}>INVOICED</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: Colors.success }]}>£{paidValue.toLocaleString()}</Text>
          <Text style={styles.statLabel}>COLLECTED</Text>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterOuter}>
        <FlatList
          horizontal
          data={STATUS_FILTERS}
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
  emptySubtitle: { ...Typography.bodyMD, color: Colors.textMuted },
  emptyBtn: {
    marginTop: 8, paddingHorizontal: 24, paddingVertical: 12,
    backgroundColor: Colors.primary, borderRadius: Radius.md,
  },
  emptyBtnText: { ...Typography.btnMD, color: Colors.textInverse },
});
