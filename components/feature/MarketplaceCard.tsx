import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { PCard } from '@/components/ui/PCard';
import { PBadge } from '@/components/ui/PBadge';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { JobPost } from '@/contexts/JobsContext';
import { MaterialIcons } from '@expo/vector-icons';

interface MarketplaceCardProps {
  post: JobPost;
  onPress: () => void;
}

export function MarketplaceCard({ post, onPress }: MarketplaceCardProps) {
  return (
    <PCard onPress={onPress} noPadding style={styles.card}>
      <Image
        source={{ uri: post.photo_url ?? undefined }}
        style={styles.image}
        contentFit="cover"
        transition={200}
      />
      <View style={styles.body}>
        <View style={styles.topRow}>
          <PBadge label={post.status} variant={post.status as any} />
          <Text style={styles.trade}>{post.trade}</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>{post.title}</Text>
        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <MaterialIcons name="location-on" size={12} color={Colors.textMuted} />
            <Text style={styles.metaText}>{post.city}, {post.postcode_area}</Text>
          </View>
          <View style={styles.metaItem}>
            <MaterialIcons name="people" size={12} color={Colors.textMuted} />
            <Text style={styles.metaText}>{post.applications} applied</Text>
          </View>
        </View>
        <View style={styles.footer}>
          <View>
            <Text style={styles.budgetLabel}>BUDGET</Text>
            <Text style={styles.budget}>£{post.budget.toLocaleString()}</Text>
          </View>
          <View style={styles.clientRow}>
            <Image
              source={{ uri: post.client_avatar }}
              style={styles.avatar}
              contentFit="cover"
              transition={100}
            />
            <Text style={styles.clientName}>{post.client_name}</Text>
          </View>
        </View>
      </View>
    </PCard>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: Spacing.sm, overflow: 'hidden' },
  image: { width: '100%', height: 160 },
  body: { padding: 14, gap: 8 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trade: { ...Typography.labelXS, color: Colors.primaryLight },
  title: { ...Typography.headingMD, lineHeight: 24 },
  meta: { flexDirection: 'row', gap: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { ...Typography.labelSM },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  budgetLabel: { ...Typography.labelXS },
  budget: { ...Typography.dataLG, color: Colors.success },
  clientRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 24, height: 24, borderRadius: 12 },
  clientName: { ...Typography.labelSM, color: Colors.textSecondary },
});
