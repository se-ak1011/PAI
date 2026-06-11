import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { PButton } from '@/components/ui/PButton';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { MOCK_CONTRACTORS_PUBLIC, MOCK_REVIEWS } from '@/services/mockData';
import { useAlert } from '@/template';
import { MaterialIcons } from '@expo/vector-icons';

export default function ContractorProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { showAlert } = useAlert();

  const contractor = MOCK_CONTRACTORS_PUBLIC.find(c => c.id === id) || MOCK_CONTRACTORS_PUBLIC[0];

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <MaterialIcons
        key={i}
        name={i < Math.floor(rating) ? 'star' : i < rating ? 'star-half' : 'star-border'}
        size={16}
        color={Colors.warning}
      />
    ));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textSecondary} />
        </Pressable>
        <Text style={styles.navTitle}>Profile</Text>
        <Pressable hitSlop={8}>
          <MaterialIcons name="share" size={22} color={Colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Hero */}
        <View style={styles.heroSection}>
          <Image source={{ uri: contractor.avatar }} style={styles.avatar} contentFit="cover" transition={200} />
          <View style={styles.heroInfo}>
            <Text style={styles.name}>{contractor.display_name}</Text>
            <Text style={styles.business}>{contractor.business_name}</Text>
            <View style={styles.ratingRow}>
              <View style={styles.stars}>{renderStars(contractor.rating)}</View>
              <Text style={styles.ratingText}>{contractor.rating} ({contractor.review_count} reviews)</Text>
            </View>
            <View style={[styles.availBadge, contractor.available ? styles.availGreen : styles.availRed]}>
              <View style={[styles.availDot, { backgroundColor: contractor.available ? Colors.success : Colors.error }]} />
              <Text style={[styles.availText, { color: contractor.available ? Colors.success : Colors.error }]}>
                {contractor.available ? 'Available for work' : 'Currently busy'}
              </Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{contractor.jobs_completed}</Text>
            <Text style={styles.statLabel}>JOBS DONE</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{contractor.review_count}</Text>
            <Text style={styles.statLabel}>REVIEWS</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: Colors.success }]}>£{contractor.hourly_rate_from}</Text>
            <Text style={styles.statLabel}>FROM/DAY</Text>
          </View>
        </View>

        {/* Location */}
        <View style={styles.infoRow}>
          <MaterialIcons name="location-on" size={18} color={Colors.textMuted} />
          <Text style={styles.infoText}>{contractor.city}, {contractor.postcode_area}</Text>
        </View>

        {/* Trades */}
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

        {/* Bio */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.bio}>{contractor.bio}</Text>
        </View>

        {/* Portfolio placeholder */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Portfolio</Text>
          <View style={styles.portfolioGrid}>
            {['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&h=300&fit=crop',
              'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=300&h=300&fit=crop',
              'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=300&h=300&fit=crop',
            ].map((uri, i) => (
              <Image key={i} source={{ uri }} style={styles.portfolioImg} contentFit="cover" transition={200} />
            ))}
          </View>
        </View>

        {/* Reviews */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reviews</Text>
          {MOCK_REVIEWS.map(review => (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <Text style={styles.reviewAuthor}>{review.author_name}</Text>
                <View style={styles.reviewStars}>
                  {Array.from({ length: review.rating }).map((_, i) => (
                    <MaterialIcons key={i} name="star" size={13} color={Colors.warning} />
                  ))}
                </View>
              </View>
              <Text style={styles.reviewComment}>{review.comment}</Text>
              <Text style={styles.reviewDate}>{review.created_at}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* CTA Footer */}
      <View style={styles.footer}>
        <Pressable
          style={styles.messageBtn}
          onPress={() => showAlert('Coming Soon', 'Messaging will be available with backend integration.')}
        >
          <MaterialIcons name="chat-bubble-outline" size={20} color={Colors.textPrimary} />
        </Pressable>
        <PButton
          label="Hire for a Job"
          onPress={() => showAlert('Coming Soon', 'Direct hiring will be available with backend integration.')}
          style={styles.hireBtn}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  navBar: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { padding: 4 },
  navTitle: { flex: 1, ...Typography.headingMD },
  scroll: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 120 },
  heroSection: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  avatar: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: Colors.primary },
  heroInfo: { flex: 1, gap: 6 },
  name: { ...Typography.brandMD },
  business: { ...Typography.labelMD, color: Colors.textSecondary },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stars: { flexDirection: 'row', gap: 2 },
  ratingText: { ...Typography.labelSM },
  availBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill, borderWidth: 1, alignSelf: 'flex-start',
  },
  availGreen: { backgroundColor: Colors.successDim, borderColor: Colors.success },
  availRed: { backgroundColor: Colors.errorDim, borderColor: Colors.error },
  availDot: { width: 6, height: 6, borderRadius: 3 },
  availText: { fontSize: 12, fontWeight: '500' },
  statsRow: {
    flexDirection: 'row', backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: 16,
  },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },
  statValue: { ...Typography.dataLG },
  statLabel: { ...Typography.labelXS },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { ...Typography.bodyMD, color: Colors.textSecondary },
  section: { gap: 12 },
  sectionTitle: { ...Typography.headingMD },
  tradeTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tradeTag: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Colors.card, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border },
  tradeTagText: { ...Typography.labelMD },
  bio: { ...Typography.bodyMD, color: Colors.textSecondary, lineHeight: 22 },
  portfolioGrid: { flexDirection: 'row', gap: 8 },
  portfolioImg: { flex: 1, height: 100, borderRadius: Radius.md, overflow: 'hidden' },
  reviewCard: { backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 8 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewAuthor: { ...Typography.dataMD },
  reviewStars: { flexDirection: 'row', gap: 2 },
  reviewComment: { ...Typography.bodyMD, color: Colors.textSecondary, lineHeight: 20 },
  reviewDate: { ...Typography.labelSM, color: Colors.textMuted },
  footer: { flexDirection: 'row', gap: 12, padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.bg },
  messageBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  hireBtn: { flex: 1 },
});
