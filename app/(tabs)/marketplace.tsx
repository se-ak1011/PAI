import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MarketplaceCard } from '@/components/feature/MarketplaceCard';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { useJobs } from '@/hooks/useJobs';
import { useAuth } from '@/hooks/useAuth';
import { TRADE_CATEGORIES } from '@/constants/config';
import { MaterialIcons } from '@expo/vector-icons';
import { RoleSwitcherBar } from './_layout';
import { PostJobModal } from '@/components/feature/PostJobModal';
import { getSupabaseClient } from '@/template';

const ALL_TABS = ['Find Work', 'Tradespeople', 'Trade Network'] as const;
type Tab = typeof ALL_TABS[number];

const BUDGET_FILTERS = [
  { label: 'Any', min: 0, max: Infinity },
  { label: 'Under £500', min: 0, max: 500 },
  { label: '£500–2k', min: 500, max: 2000 },
  { label: '£2k–10k', min: 2000, max: 10000 },
  { label: '£10k+', min: 10000, max: Infinity },
];

interface PublicContractor {
  id: string;
  display_name: string;
  business_name?: string;
  trades?: string[];
  hourly_rate_from?: number;
  hourly_rate?: number;
  city?: string;
  postcode_area?: string;
  avatar_url?: string;
  rating?: number;
  available?: boolean;
}

// ─────────────────────────────────────────────
// Trade Network Tab — contractor-to-contractor hiring
// ─────────────────────────────────────────────
function TradeNetworkTab({
  contractors,
  contractorsLoading,
  userCity,
  onPress,
}: {
  contractors: PublicContractor[];
  contractorsLoading: boolean;
  userCity?: string;
  onPress: (id: string) => void;
}) {
  return (
    <FlatList
      data={contractors}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <>
          <View style={styles.tradeNetworkBanner}>
            <View style={styles.tradeNetworkBannerIcon}>
              <MaterialIcons name="handshake" size={22} color={Colors.primaryGlow} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.tradeNetworkBannerTitle}>Contractor Network</Text>
              <Text style={styles.tradeNetworkBannerText}>
                Need another trade on a job? Find verified PAI contractors and subcontract work directly through the platform.
              </Text>
            </View>
          </View>
          <Text style={styles.resultCount}>
            {contractorsLoading ? 'Loading...' : `${contractors.length} contractor${contractors.length !== 1 ? 's' : ''} on the network`}
            {userCity && !contractorsLoading ? ` · near ${userCity}` : ''}
          </Text>
        </>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <MaterialIcons name="groups" size={40} color={Colors.textMuted} />
          <Text style={styles.emptyText}>No contractors found yet</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          style={styles.contractorCard}
          onPress={() => onPress(item.id)}
        >
          <View style={[styles.contractorIconWrap, { backgroundColor: Colors.infoDim }]}>
            <MaterialIcons name="construction" size={22} color={Colors.info} />
          </View>
          <View style={styles.contractorInfo}>
            <Text style={styles.contractorName}>{item.display_name}</Text>
            <Text style={styles.contractorBusiness}>
              {item.business_name || (item.trades || []).slice(0, 2).join(' · ') || 'Tradesperson'}
            </Text>
            <View style={styles.contractorMeta}>
              <View style={styles.metaItem}>
                <MaterialIcons name="location-on" size={13} color={Colors.textMuted} />
                <Text style={styles.metaText}>{item.city || 'No location'}</Text>
              </View>
              {item.available !== false ? (
                <View style={[styles.availDot, { backgroundColor: Colors.success + '44' }]}>
                  <Text style={[styles.availText, { color: Colors.success }]}>Available</Text>
                </View>
              ) : (
                <View style={[styles.availDot, { backgroundColor: Colors.errorDim }]}>
                  <Text style={[styles.availText, { color: Colors.error }]}>Busy</Text>
                </View>
              )}
            </View>
          </View>
          {item.hourly_rate_from ? (
            <View style={styles.contractorRight}>
              <Text style={styles.rateLabel}>DAY RATE</Text>
              <Text style={styles.rate}>£{item.hourly_rate_from}</Text>
            </View>
          ) : null}
        </Pressable>
      )}
    />
  );
}

export default function MarketplaceScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { jobPosts } = useJobs();

  // Role-based tab visibility
  // Customer-only accounts: Tradespeople only (they hire, not apply for work)
  // Contractor/both accounts: Find Work + Trade Network (contractors can also hire trades)
  // Both accounts: all three tabs
  const isContractor = user?.account_type === 'contractor' || user?.account_type === 'both';
  const isCustomer = user?.account_type === 'customer' || user?.account_type === 'both';
  const isCustomerOnly = user?.account_type === 'customer';
  const availableTabs: Tab[] = isCustomerOnly
    ? ['Tradespeople']
    : isContractor && isCustomer
    ? ['Find Work', 'Tradespeople', 'Trade Network']
    : ['Find Work', 'Trade Network'];

  const [tab, setTab] = useState<Tab>(availableTabs[0]);
  const [search, setSearch] = useState('');
  const [tradeFilter, setTradeFilter] = useState('All');
  const [budgetFilter, setBudgetFilter] = useState(BUDGET_FILTERS[0]);
  const [showPostJob, setShowPostJob] = useState(false);
  const [contractors, setContractors] = React.useState<PublicContractor[]>([]);
  const [contractorsLoading, setContractorsLoading] = React.useState(false);

  const userCity = user?.city?.toLowerCase();
  // Use saved preferences for smart sorting
  const savedTrades = user?.saved_trades || [];
  const savedPostcodes = user?.saved_postcode_areas || [];

  const allTrades = ['All', ...TRADE_CATEGORIES];

  // Load contractors from Supabase when Tradespeople tab is selected
  React.useEffect(() => {
    if (tab !== 'Tradespeople') return;
    const loadContractors = async () => {
      setContractorsLoading(true);
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, business_name, trades, hourly_rate_from, hourly_rate, city, postcode_area, avatar_url, available, flexible_pricing')
        .in('account_type', ['contractor', 'both'])
        .eq('onboarding_complete', true);

      if (!error && data) {
        setContractors(data.map(c => ({
          id: c.id,
          display_name: c.username || 'Tradesperson',
          business_name: c.business_name,
          trades: c.trades || [],
          hourly_rate_from: c.hourly_rate_from,
          hourly_rate: c.hourly_rate,
          city: c.city,
          postcode_area: c.postcode_area,
          avatar_url: c.avatar_url,
          available: c.available,
        })));
      }
      setContractorsLoading(false);
    };
    loadContractors();
  }, [tab]);

  const filteredPosts = jobPosts
    .filter(p => p.status === 'open')
    .filter(p => tradeFilter === 'All' || p.trade === tradeFilter)
    .filter(p => p.budget >= budgetFilter.min && p.budget <= budgetFilter.max)
    .filter(p => search === '' || p.title.toLowerCase().includes(search.toLowerCase()) || (p.city ?? '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      // Prioritise by saved trades, then saved postcodes, then city match
      const aTradeMatch = savedTrades.length > 0 && savedTrades.includes(a.trade);
      const bTradeMatch = savedTrades.length > 0 && savedTrades.includes(b.trade);
      if (aTradeMatch && !bTradeMatch) return -1;
      if (!aTradeMatch && bTradeMatch) return 1;
      const aPostcodeMatch = savedPostcodes.length > 0 && savedPostcodes.some(pc => (a.postcode_area ?? '').toLowerCase().startsWith(pc.toLowerCase()));
      const bPostcodeMatch = savedPostcodes.length > 0 && savedPostcodes.some(pc => (b.postcode_area ?? '').toLowerCase().startsWith(pc.toLowerCase()));
      if (aPostcodeMatch && !bPostcodeMatch) return -1;
      if (!aPostcodeMatch && bPostcodeMatch) return 1;
      if (userCity) {
        const aLocal = (a.city ?? '').toLowerCase().includes(userCity);
        const bLocal = (b.city ?? '').toLowerCase().includes(userCity);
        if (aLocal && !bLocal) return -1;
        if (!aLocal && bLocal) return 1;
      }
      return 0;
    });

  const filteredContractors = contractors
    .filter(c => tradeFilter === 'All' || (c.trades || []).includes(tradeFilter))
    .filter(c => {
      if (budgetFilter.max !== Infinity && c.hourly_rate_from) {
        return c.hourly_rate_from <= budgetFilter.max;
      }
      return true;
    })
    .filter(c => search === '' || (c.display_name ?? '').toLowerCase().includes(search.toLowerCase()) || (c.city ?? '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
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
        <Text style={styles.title}>Marketplace</Text>
        <Pressable style={styles.bellBtn}>
          <MaterialIcons name="notifications-none" size={22} color={Colors.textSecondary} />
        </Pressable>
      </View>
      <View style={styles.topDivider} />

      {/* Tab switch — only show if user has both roles */}
      {availableTabs.length > 1 ? (
      <View style={styles.tabOuter}>
        <FlatList
          horizontal
          data={availableTabs}
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
      ) : null}

      {(
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
              data={allTrades}
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

          {tab === 'Trade Network' ? (
            <TradeNetworkTab contractors={filteredContractors} contractorsLoading={contractorsLoading} userCity={user?.city} onPress={(id) => router.push({ pathname: '/contractor-profile', params: { id } })} />
          ) : tab === 'Find Work' && isContractor ? (
            <FlatList
              data={filteredPosts}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                <>
                  {savedTrades.length > 0 ? (
                    <View style={styles.preferenceNote}>
                      <MaterialIcons name="tune" size={12} color={Colors.primaryGlow} />
                      <Text style={styles.preferenceNoteText}>
                        Sorted by your saved trades: {savedTrades.join(', ')}
                      </Text>
                    </View>
                  ) : null}
                  <Text style={styles.resultCount}>
                    {filteredPosts.length} open {tradeFilter !== 'All' ? tradeFilter.toLowerCase() : ''} job{filteredPosts.length !== 1 ? 's' : ''}
                    {userCity ? ` · near ${user?.city}` : ''}
                  </Text>
                </>
              }
              ListEmptyComponent={
                <View style={styles.empty}>
                  <MaterialIcons name="work-off" size={40} color={Colors.textMuted} />
                  <Text style={styles.emptyText}>No matching jobs found</Text>
                  <Pressable style={styles.postJobBtn} onPress={() => setShowPostJob(true)}>
                    <MaterialIcons name="add" size={16} color={Colors.textInverse} />
                    <Text style={styles.postJobBtnText}>Post a Job</Text>
                  </Pressable>
                </View>
              }
              renderItem={({ item }) => (
                <MarketplaceCard
                  post={item}
                  onPress={() => router.push({ pathname: '/marketplace-job', params: { id: item.id } })}
                />
              )}
            />
          ) : tab === 'Tradespeople' ? (
            <FlatList
              data={filteredContractors}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                <Text style={styles.resultCount}>
                  {contractorsLoading ? 'Loading...' : `${filteredContractors.length} tradesperson${filteredContractors.length !== 1 ? 's' : ''} found`}
                  {userCity && !contractorsLoading ? ` · near ${user?.city}` : ''}
                </Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  style={styles.contractorCard}
                  onPress={() => router.push({ pathname: '/contractor-profile', params: { id: item.id } })}
                >
                  <View style={styles.contractorIconWrap}>
                    <MaterialIcons name="construction" size={22} color={Colors.primaryGlow} />
                  </View>
                  <View style={styles.contractorInfo}>
                    <Text style={styles.contractorName}>{item.display_name}</Text>
                    <Text style={styles.contractorBusiness}>{item.business_name || (item.trades || [])[0] || ''}</Text>
                    <View style={styles.contractorMeta}>
                      <View style={styles.metaItem}>
                        <MaterialIcons name="location-on" size={13} color={Colors.textMuted} />
                        <Text style={styles.metaText}>{item.city || 'No location'}</Text>
                      </View>
                      {item.available !== false ? (
                        <View style={[styles.availDot, { backgroundColor: Colors.success + '44' }]}>
                          <Text style={[styles.availText, { color: Colors.success }]}>Available</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  {item.hourly_rate_from ? (
                    <View style={styles.contractorRight}>
                      <Text style={styles.rateLabel}>FROM</Text>
                      <Text style={styles.rate}>£{item.hourly_rate_from}</Text>
                      <Text style={styles.rateUnit}>/day</Text>
                    </View>
                  ) : null}
                </Pressable>
              )}
            />
          ) : null}
        </>
      )}

      <RoleSwitcherBar />
      <PostJobModal visible={showPostJob} onClose={() => setShowPostJob(false)} />
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
  preferenceNote: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primaryDim, borderRadius: Radius.sm, padding: 8,
    borderWidth: 1, borderColor: Colors.primaryLight, marginBottom: 8,
  },
  preferenceNoteText: { ...Typography.labelSM, color: Colors.primaryGlow, flex: 1 },
  resultCount: { ...Typography.labelSM, marginBottom: Spacing.sm },
  list: { padding: Spacing.md, paddingTop: Spacing.xs, paddingBottom: 120 },
  empty: { alignItems: 'center', paddingTop: Spacing.xxl, gap: 12 },
  emptyText: { ...Typography.bodyMD, color: Colors.textMuted },
  postJobBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingHorizontal: 18, paddingVertical: 10, marginTop: 8,
  },
  postJobBtnText: { ...Typography.btnSM, color: Colors.textInverse },

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
  contractorMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { ...Typography.labelSM },
  availDot: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.pill },
  availText: { fontSize: 10, fontWeight: '600' },
  contractorRight: { alignItems: 'flex-end', gap: 2 },
  rateLabel: { ...Typography.labelXS },
  rate: { ...Typography.dataLG },
  rateUnit: { ...Typography.labelSM },
  // Trade Network banner
  tradeNetworkBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    backgroundColor: Colors.infoDim, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.info + '66',
    padding: 16, marginBottom: Spacing.sm,
  },
  tradeNetworkBannerIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.primaryDim, alignItems: 'center', justifyContent: 'center',
  },
  tradeNetworkBannerTitle: { ...Typography.headingMD },
  tradeNetworkBannerText: { ...Typography.labelSM, color: Colors.textSecondary, lineHeight: 18 },
});
