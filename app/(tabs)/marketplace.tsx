import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MarketplaceCard } from '@/components/feature/MarketplaceCard';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { useJobs } from '@/hooks/useJobs';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { MOCK_CONTRACTORS_PUBLIC } from '@/services/mockData';
import { MaterialIcons } from '@expo/vector-icons';
import { RoleSwitcherBar } from './_layout';

const TABS = ['Find Work', 'Tradespeople', 'Messages'] as const;
type Tab = typeof TABS[number];

const BUDGET_FILTERS = [
  { label: 'Any', min: 0, max: Infinity },
  { label: 'Under £500', min: 0, max: 500 },
  { label: '£500–2k', min: 500, max: 2000 },
  { label: '£2k–10k', min: 2000, max: 10000 },
  { label: '£10k+', min: 10000, max: Infinity },
];

export default function MarketplaceScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { jobPosts } = useJobs();
  const { activeRole, isDualAccount, isContractorAccount } = useRole();
  const [tab, setTab] = useState<Tab>('Find Work');
  const [search, setSearch] = useState('');
  const [tradeFilter, setTradeFilter] = useState('All');
  const [budgetFilter, setBudgetFilter] = useState(BUDGET_FILTERS[0]);

  const trades = ['All', 'Electrical', 'Plumbing', 'Carpentry', 'Painting', 'Roofing'];
  const userCity = user?.city?.toLowerCase();

  const filteredPosts = jobPosts
    .filter(p => p.status === 'open')
    .filter(p => tradeFilter === 'All' || p.trade === tradeFilter)
    .filter(p => p.budget >= budgetFilter.min && p.budget <= budgetFilter.max)
    .filter(p => search === '' || p.title.toLowerCase().includes(search.toLowerCase()) || (p.city ?? '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (!userCity) return 0;
      const aLocal = (a.city ?? '').toLowerCase().includes(userCity);
      const bLocal = (b.city ?? '').toLowerCase().includes(userCity);
      if (aLocal && !bLocal) return -1;
      if (!aLocal && bLocal) return 1;
      return 0;
    });

  const filteredContractors = MOCK_CONTRACTORS_PUBLIC
    .filter((c: any) => tradeFilter === 'All' || c.trades?.includes(tradeFilter))
    .filter((c: any) => {
      if (budgetFilter.max !== Infinity && c.hourly_rate_from) {
        return c.hourly_rate_from <= budgetFilter.max;
      }
      return true;
    })
    .filter((c: any) => search === '' || c.display_name?.toLowerCase().includes(search.toLowerCase()) || c.city?.toLowerCase().includes(search.toLowerCase()))
    .sort((a: any, b: any) => {
      if (!userCity) return 0;
      const aLocal = (a.city ?? '').toLowerCase().includes(userCity);
      const bLocal = (b.city ?? '').toLowerCase().includes(userCity);
      if (aLocal && !bLocal) return -1;
      if (!aLocal && bLocal) return 1;
      return 0;
    });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.title}>Social</Text>
        <Pressable style={styles.bellBtn}>
          <MaterialIcons name="notifications-none" size={22} color={Colors.textSecondary} />
        </Pressable>
      </View>
      <View style={styles.topDivider} />

      {/* Tab switch */}
      <View style={styles.tabOuter}>
        <FlatList
          horizontal
          data={TABS}
          keyExtractor={i => i}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabList}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.tab, tab === item && styles.tabActive]}
              onPress={() => setTab(item)}
            >
              <Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item}</Text>
            </Pressable>
          )}
        />
      </View>

      {tab === 'Messages' ? (
        <View style={styles.messagesEmpty}>
          <View style={styles.messagesCard}>
            <MaterialIcons name="chat-bubble-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.messagesTitle}>Messages live on each job</Text>
            <Text style={styles.messagesSub}>
              Conversations are tied to the job they are about. Open a job to chat with the other party.
            </Text>
          </View>
        </View>
      ) : (
        <>
          {/* Search */}
          <View style={styles.searchRow}>
            <MaterialIcons name="search" size={18} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder={tab === 'Find Work' ? 'Search jobs...' : 'Search tradespeople...'}
              placeholderTextColor={Colors.textMuted}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 ? (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <MaterialIcons name="close" size={16} color={Colors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          {/* Trade filters */}
          <View style={styles.filtersOuter}>
            <FlatList
              horizontal
              data={trades}
              keyExtractor={i => i}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterList}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.chip, tradeFilter === item && styles.chipActive]}
                  onPress={() => setTradeFilter(item)}
                >
                  <Text style={[styles.chipText, tradeFilter === item && styles.chipTextActive]}>{item}</Text>
                </Pressable>
              )}
            />
          </View>

          {/* Budget / Rate filters */}
          <View style={[styles.filtersOuter, { marginTop: -6, marginBottom: Spacing.xs }]}>
            <FlatList
              horizontal
              data={BUDGET_FILTERS}
              keyExtractor={i => i.label}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterList}
              ListHeaderComponent={
                <View style={styles.filterGroupLabel}>
                  <MaterialIcons name="attach-money" size={14} color={Colors.textMuted} />
                  <Text style={styles.filterGroupLabelText}>
                    {tab === 'Find Work' ? 'Budget:' : 'Rate:'}
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.chip, budgetFilter.label === item.label && styles.chipActive]}
                  onPress={() => setBudgetFilter(item)}
                >
                  <Text style={[styles.chipText, budgetFilter.label === item.label && styles.chipTextActive]}>{item.label}</Text>
                </Pressable>
              )}
            />
          </View>

          {tab === 'Find Work' ? (
            <FlatList
              data={filteredPosts}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                <Text style={styles.resultCount}>
                  {filteredPosts.length} open {tradeFilter !== 'All' ? tradeFilter.toLowerCase() : ''} job{filteredPosts.length !== 1 ? 's' : ''}{userCity ? ` · near ${user?.city}` : ''}
                </Text>
              }
              ListEmptyComponent={
                <View style={styles.empty}>
                  <MaterialIcons name="work-off" size={40} color={Colors.textMuted} />
                  <Text style={styles.emptyText}>No matching jobs found</Text>
                </View>
              }
              renderItem={({ item }) => (
                <MarketplaceCard
                  post={item}
                  onPress={() => router.push({ pathname: '/marketplace-job', params: { id: item.id } })}
                />
              )}
            />
          ) : (
            <FlatList
              data={filteredContractors}
              keyExtractor={(item: any) => item.id}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                <Text style={styles.resultCount}>
                  {filteredContractors.length} tradesperson{filteredContractors.length !== 1 ? 's' : ''} found{userCity ? ` · near ${user?.city}` : ''}
                </Text>
              }
              renderItem={({ item }: { item: any }) => (
                <Pressable
                  style={styles.contractorCard}
                  onPress={() => router.push({ pathname: '/contractor-profile', params: { id: item.id } })}
                >
                  <View style={styles.contractorIconWrap}>
                    <MaterialIcons name="construction" size={22} color={Colors.primaryGlow} />
                  </View>
                  <View style={styles.contractorInfo}>
                    <Text style={styles.contractorName}>{item.display_name}</Text>
                    <Text style={styles.contractorBusiness}>{item.business_name || item.trades?.[0] || ''}</Text>
                    <View style={styles.contractorMeta}>
                      {item.rating ? (
                        <View style={styles.metaItem}>
                          <MaterialIcons name="star" size={13} color={Colors.warning} />
                          <Text style={styles.metaText}>{item.rating}</Text>
                        </View>
                      ) : null}
                      <View style={styles.metaItem}>
                        <MaterialIcons name="location-on" size={13} color={Colors.textMuted} />
                        <Text style={styles.metaText}>{item.city}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.contractorRight}>
                    <Text style={styles.rateLabel}>FROM</Text>
                    <Text style={styles.rate}>£{item.hourly_rate_from}</Text>
                    <Text style={styles.rateUnit}>/day</Text>
                  </View>
                </Pressable>
              )}
            />
          )}
        </>
      )}

      <RoleSwitcherBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, paddingBottom: 12 },
  title: { ...Typography.brandMD },
  bellBtn: { padding: 4 },
  topDivider: { height: 1, backgroundColor: Colors.border },
  tabOuter: { minHeight: 52 },
  tabList: { paddingHorizontal: Spacing.md, gap: 8, alignItems: 'center', paddingVertical: 8 },
  tab: {
    paddingHorizontal: 18, height: 36, borderRadius: Radius.pill,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { ...Typography.labelMD, color: Colors.textSecondary },
  tabTextActive: { color: Colors.textInverse, fontWeight: '600' },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    marginHorizontal: Spacing.md, paddingHorizontal: 14, height: 46, marginBottom: Spacing.sm,
  },
  searchInput: { flex: 1, ...Typography.bodyMD, color: Colors.textPrimary },
  filtersOuter: { minHeight: 44 },
  filterList: { paddingHorizontal: Spacing.md, gap: 8, alignItems: 'center', paddingVertical: 4 },
  filterGroupLabel: { flexDirection: 'row', alignItems: 'center', gap: 3, marginRight: 4 },
  filterGroupLabelText: { ...Typography.labelXS, color: Colors.textMuted },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.pill, backgroundColor: Colors.cardAlt, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { ...Typography.labelMD, color: Colors.textSecondary },
  chipTextActive: { color: Colors.textInverse, fontWeight: '600' },
  resultCount: { ...Typography.labelSM, marginBottom: Spacing.sm },
  list: { padding: Spacing.md, paddingTop: Spacing.xs, paddingBottom: 120 },
  empty: { alignItems: 'center', paddingTop: Spacing.xxl, gap: 12 },
  emptyText: { ...Typography.bodyMD, color: Colors.textMuted },
  messagesEmpty: { flex: 1, padding: Spacing.md },
  messagesCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    padding: 32, alignItems: 'center', gap: 14,
  },
  messagesTitle: { ...Typography.headingMD, textAlign: 'center' },
  messagesSub: { ...Typography.bodyMD, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  contractorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    padding: 14, marginBottom: Spacing.sm,
  },
  contractorIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.primaryDim, alignItems: 'center', justifyContent: 'center',
  },
  contractorInfo: { flex: 1, gap: 3 },
  contractorName: { ...Typography.dataMD },
  contractorBusiness: { ...Typography.labelSM },
  contractorMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { ...Typography.labelSM },
  contractorRight: { alignItems: 'flex-end', gap: 2 },
  rateLabel: { ...Typography.labelXS },
  rate: { ...Typography.dataLG },
  rateUnit: { ...Typography.labelSM },
});
