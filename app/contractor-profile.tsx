import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { PButton } from '@/components/ui/PButton';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { useAlert } from '@/template';
import { useAuth } from '@/hooks/useAuth';
import { getSupabaseClient } from '@/template';
import { MaterialIcons } from '@expo/vector-icons';

const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ─── Read-only availability grid ────────────────────────────
function AvailabilityGrid({ days }: { days: string[] }) {
  return (
    <View style={gridStyles.row}>
      {ALL_DAYS.map(d => {
        const on = days.includes(d);
        return (
          <View key={d} style={[gridStyles.cell, on ? gridStyles.cellOn : gridStyles.cellOff]}>
            <Text style={[gridStyles.label, on ? gridStyles.labelOn : gridStyles.labelOff]}>{d}</Text>
            <View style={[gridStyles.dot, on ? gridStyles.dotOn : gridStyles.dotOff]} />
          </View>
        );
      })}
    </View>
  );
}

const gridStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  cell: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: Radius.md, borderWidth: 1, gap: 6,
  },
  cellOn: { backgroundColor: Colors.primaryDim, borderColor: Colors.primaryLight },
  cellOff: { backgroundColor: Colors.cardAlt, borderColor: Colors.border },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  labelOn: { color: Colors.primaryGlow },
  labelOff: { color: Colors.textMuted },
  dot: { width: 5, height: 5, borderRadius: 3 },
  dotOn: { backgroundColor: Colors.primaryGlow },
  dotOff: { backgroundColor: Colors.textMuted + '44' },
});

// ─── Main screen ─────────────────────────────────────────────
interface ContractorData {
  id: string;
  username: string;
  business_name?: string;
  bio?: string;
  trades?: string[];
  hourly_rate_from?: number;
  city?: string;
  postcode_area?: string;
  avatar_url?: string;
  available?: boolean;
  website?: string;
  availability_days?: string[];
  created_at?: string;
}

export default function ContractorProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { showAlert } = useAlert();
  const [contractor, setContractor] = useState<ContractorData | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const supabase = getSupabaseClient();

    const fetchData = async () => {
      const [profileRes, reviewsRes] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('id, username, business_name, bio, trades, hourly_rate_from, city, postcode_area, avatar_url, available, website, availability_days, created_at')
          .eq('id', id)
          .single(),
        supabase
          .from('reviews')
          .select('*, author:author_id(username)')
          .eq('subject_id', id)
          .eq('mode', 'customer_to_contractor')
          .order('created_at', { ascending: false }),
      ]);

      if (profileRes.data) {
        setContractor(profileRes.data);
      }
      if (reviewsRes.data) {
        setReviews(reviewsRes.data.map((r: any) => ({
          ...r,
          author_name: r.author?.username || 'Customer',
        })));
      }
      setLoading(false);
    };

    fetchData();
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primaryGlow} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!contractor) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <Text style={styles.notFound}>Contractor not found</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backLink}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const avgRating = reviews.length > 0
    ? reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length
    : 0;

  const availDays = contractor.availability_days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  const renderStars = (rating: number) =>
    Array.from({ length: 5 }).map((_, i) => (
      <MaterialIcons
        key={i}
        name={i < Math.floor(rating) ? 'star' : i < rating ? 'star-half' : 'star-border'}
        size={16}
        color={Colors.warning}
      />
    ));

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textSecondary} />
        </Pressable>
        <Text style={styles.navTitle}>Profile</Text>
        <Pressable hitSlop={8} onPress={() => showAlert('Share', 'Share link coming soon.')}>
          <MaterialIcons name="share" size={22} color={Colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Hero */}
        <View style={styles.heroSection}>
          {contractor.avatar_url ? (
            <Image source={{ uri: contractor.avatar_url }} style={styles.avatar} contentFit="cover" transition={200} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <MaterialIcons name="person" size={36} color={Colors.textInverse} />
            </View>
          )}
          <View style={styles.heroInfo}>
            <Text style={styles.name}>{contractor.username || 'Tradesperson'}</Text>
            {contractor.business_name ? (
              <Text style={styles.business}>{contractor.business_name}</Text>
            ) : null}
            {contractor.created_at ? (
              <Text style={styles.memberSince}>
                Member since {new Date(contractor.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </Text>
            ) : null}
            {avgRating > 0 ? (
              <View style={styles.ratingRow}>
                <View style={styles.stars}>{renderStars(avgRating)}</View>
                <Text style={styles.ratingText}>{avgRating.toFixed(1)} ({reviews.length} reviews)</Text>
              </View>
            ) : (
              <Text style={styles.noReviews}>No reviews yet</Text>
            )}
            <View style={[styles.availBadge, contractor.available !== false ? styles.availGreen : styles.availRed]}>
              <View style={[styles.availDot, { backgroundColor: contractor.available !== false ? Colors.success : Colors.error }]} />
              <Text style={[styles.availText, { color: contractor.available !== false ? Colors.success : Colors.error }]}>
                {contractor.available !== false ? 'Available for work' : 'Currently busy'}
              </Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{reviews.length}</Text>
            <Text style={styles.statLabel}>REVIEWS</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: Colors.success }]}>
              {contractor.hourly_rate_from ? `£${contractor.hourly_rate_from}` : '—'}
            </Text>
            <Text style={styles.statLabel}>DAY RATE</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{(contractor.trades || []).length}</Text>
            <Text style={styles.statLabel}>TRADES</Text>
          </View>
        </View>

        {/* Location */}
        {(contractor.city || contractor.postcode_area) ? (
          <View style={styles.infoRow}>
            <MaterialIcons name="location-on" size={16} color={Colors.textMuted} />
            <Text style={styles.infoText}>
              {[contractor.city, contractor.postcode_area].filter(Boolean).join(', ')}
            </Text>
          </View>
        ) : null}

        {/* Trades */}
        {contractor.trades && contractor.trades.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trades</Text>
            <View style={styles.tradeTags}>
              {contractor.trades.map(t => (
                <View key={t} style={styles.tradeTag}>
                  <Text style={styles.tradeTagText}>{t}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Bio */}
        {contractor.bio ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bio}>{contractor.bio}</Text>
          </View>
        ) : null}

        {/* Availability calendar */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Availability</Text>
            <Text style={styles.sectionSub}>Typical working week</Text>
          </View>
          <View style={styles.calendarCard}>
            <AvailabilityGrid days={availDays} />
            <Text style={styles.calendarNote}>
              {availDays.length === 0
                ? 'No availability set'
                : `Usually available ${availDays.length} day${availDays.length !== 1 ? 's' : ''} per week`}
            </Text>
            <View style={styles.availLegend}>
              <View style={styles.availLegendItem}>
                <View style={[styles.availLegendDot, { backgroundColor: Colors.primaryGlow }]} />
                <Text style={styles.availLegendText}>Available</Text>
              </View>
              <View style={styles.availLegendItem}>
                <View style={[styles.availLegendDot, { backgroundColor: Colors.textMuted + '44' }]} />
                <Text style={styles.availLegendText}>Not available</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Portfolio placeholder */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Portfolio</Text>
          <View style={styles.portfolioGrid}>
            {[
              'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&h=300&fit=crop',
              'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=300&h=300&fit=crop',
              'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=300&h=300&fit=crop',
            ].map((uri, i) => (
              <Image key={i} source={{ uri }} style={styles.portfolioImg} contentFit="cover" transition={200} />
            ))}
          </View>
        </View>

        {/* Website */}
        {contractor.website ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Links</Text>
            <View style={styles.linkRow}>
              <MaterialIcons name="link" size={16} color={Colors.primaryGlow} />
              <Text style={styles.linkText}>{contractor.website}</Text>
            </View>
          </View>
        ) : null}

        {/* Reviews */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reviews ({reviews.length})</Text>
          {reviews.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No reviews yet.</Text>
            </View>
          ) : (
            reviews.map((r: any) => (
              <View key={r.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewAuthor}>{r.author_name}</Text>
                  <View style={styles.reviewStars}>
                    {Array.from({ length: r.rating }).map((_: any, i: number) => (
                      <MaterialIcons key={i} name="star" size={13} color={Colors.warning} />
                    ))}
                  </View>
                </View>
                {r.comment ? <Text style={styles.reviewComment}>{r.comment}</Text> : null}
                <Text style={styles.reviewDate}>
                  {new Date(r.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* CTA Footer */}
      <View style={styles.footer}>
        <Pressable
          style={styles.messageBtn}
          onPress={() => showAlert('Coming Soon', 'Messaging will be available soon.')}
        >
          <MaterialIcons name="chat-bubble-outline" size={20} color={Colors.textPrimary} />
        </Pressable>
        <PButton
          label="Hire for a Job"
          onPress={() => showAlert('Coming Soon', 'Direct hiring will be available soon.')}
          style={styles.hireBtn}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  notFound: { ...Typography.headingMD },
  backLink: { ...Typography.labelMD, color: Colors.primaryLight },
  navBar: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { padding: 4 },
  navTitle: { flex: 1, ...Typography.headingMD },
  scroll: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 120 },
  heroSection: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  avatar: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: Colors.primary },
  avatarFallback: { backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  heroInfo: { flex: 1, gap: 6 },
  name: { ...Typography.brandMD },
  business: { ...Typography.labelMD, color: Colors.textSecondary },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stars: { flexDirection: 'row', gap: 2 },
  ratingText: { ...Typography.labelSM },
  noReviews: { ...Typography.labelSM, color: Colors.textMuted },
  availBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill, borderWidth: 1, alignSelf: 'flex-start' },
  availGreen: { backgroundColor: Colors.successDim, borderColor: Colors.success },
  availRed: { backgroundColor: Colors.errorDim, borderColor: Colors.error },
  availDot: { width: 6, height: 6, borderRadius: 3 },
  availText: { fontSize: 12, fontWeight: '500' },
  statsRow: { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: 16 },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },
  statValue: { ...Typography.dataLG },
  statLabel: { ...Typography.labelXS },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { ...Typography.bodyMD, color: Colors.textSecondary },
  section: { gap: 12 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { ...Typography.headingMD },
  sectionSub: { ...Typography.labelSM, color: Colors.textMuted },
  tradeTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tradeTag: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Colors.card, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border },
  tradeTagText: { ...Typography.labelMD },
  bio: { ...Typography.bodyMD, color: Colors.textSecondary, lineHeight: 22 },
  // Availability calendar card
  calendarCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1,
    borderColor: Colors.border, padding: 16, gap: 12,
  },
  memberSince: { ...Typography.labelSM, color: Colors.textMuted },
  calendarNote: { ...Typography.labelSM, color: Colors.textMuted, textAlign: 'center' },
  availLegend: { flexDirection: 'row', gap: 16, paddingTop: 2 },
  availLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  availLegendDot: { width: 7, height: 7, borderRadius: 4 },
  availLegendText: { fontSize: 11, color: Colors.textMuted, fontWeight: '500' as const },
  portfolioGrid: { flexDirection: 'row', gap: 8 },
  portfolioImg: { flex: 1, height: 100, borderRadius: Radius.md, overflow: 'hidden' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: 14 },
  linkText: { ...Typography.bodyMD, color: Colors.textSecondary, flex: 1 },
  reviewCard: { backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 8 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewAuthor: { ...Typography.dataMD },
  reviewStars: { flexDirection: 'row', gap: 2 },
  reviewComment: { ...Typography.bodyMD, color: Colors.textSecondary, lineHeight: 20 },
  reviewDate: { ...Typography.labelSM, color: Colors.textMuted },
  emptyCard: { backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: 20, alignItems: 'center' },
  emptyText: { ...Typography.bodyMD, color: Colors.textMuted },
  footer: { flexDirection: 'row', gap: 12, padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.bg },
  messageBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  hireBtn: { flex: 1 },
});
