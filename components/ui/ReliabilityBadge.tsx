/**
 * ReliabilityBadge
 * Compact, muted indicator shown to contractors before accepting/applying to work.
 * Sizes: 'sm' (dot + label inline), 'md' (card with breakdown)
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Typography, Radius, Colors } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { RELIABILITY_COLOURS, type ReliabilityScore, type ReliabilityLevel } from '@/hooks/useReliability';

// Human-readable tag labels
const TAG_LABELS: Record<string, string> = {
  paid_on_time: 'Paid on time',
  clear_communication: 'Clear communication',
  scope_stayed_consistent: 'Scope stayed consistent',
  prepared_before_arrival: 'Prepared before arrival',
  respectful_and_easy: 'Respectful and easy',
  payment_delayed: 'Payment delayed',
  scope_changed_repeatedly: 'Scope changed',
  poor_communication: 'Poor communication',
  access_issues: 'Access issues',
  dispute_raised: 'Dispute raised',
  cancelled_late: 'Cancelled late',
  unclear_job_details: 'Unclear job details',
};

const NEGATIVE_KEYS = [
  'payment_delayed', 'scope_changed_repeatedly', 'poor_communication',
  'access_issues', 'dispute_raised', 'cancelled_late', 'unclear_job_details',
];

interface Props {
  score: ReliabilityScore | null;
  size?: 'sm' | 'md';
}

export function ReliabilityBadge({ score, size = 'sm' }: Props) {
  if (!score) {
    return (
      <View style={[styles.row, { gap: 5 }]}>
        <View style={[styles.dot, { backgroundColor: Colors.textMuted + '55' }]} />
        <Text style={styles.noDataText}>No reliability data yet</Text>
      </View>
    );
  }

  const colour = RELIABILITY_COLOURS[score.level];

  if (size === 'sm') {
    return (
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: colour }]} />
        <Text style={styles.smLabel}>Client Reliability</Text>
        <Text style={[styles.smLevel, { color: colour }]}>{score.level}</Text>
      </View>
    );
  }

  // md — detailed card
  const positiveTags = score.commonTags.filter(t => !NEGATIVE_KEYS.includes(t));
  const negativeTags = score.commonTags.filter(t => NEGATIVE_KEYS.includes(t));

  return (
    <View style={styles.card}>
      {/* Header row */}
      <View style={styles.cardHeader}>
        <View style={[styles.dot, { backgroundColor: colour }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.cardLabel}>Client Reliability</Text>
          <Text style={[styles.cardLevel, { color: colour }]}>{score.level}</Text>
        </View>
        <View style={styles.ratingPill}>
          <MaterialIcons name="star" size={12} color={Colors.warning} />
          <Text style={styles.ratingText}>{score.avgOverall.toFixed(1)}</Text>
          <Text style={styles.ratingCount}>({score.totalReviews})</Text>
        </View>
      </View>

      {/* Would-work-again */}
      {score.wouldWorkAgainPct !== null ? (
        <View style={styles.metaRow}>
          <MaterialIcons name="repeat" size={12} color={Colors.textMuted} />
          <Text style={styles.metaText}>
            {score.wouldWorkAgainPct}% of contractors would work with again
          </Text>
        </View>
      ) : null}

      {/* Category breakdown (only if any rated) */}
      {Object.values(score.categories).some(v => v !== null) ? (
        <View style={styles.categories}>
          {Object.entries(score.categories).map(([key, val]) => {
            if (val === null) return null;
            const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            const pct = ((val - 1) / 4) * 100;
            return (
              <View key={key} style={styles.catRow}>
                <Text style={styles.catLabel}>{label}</Text>
                <View style={styles.catBarBg}>
                  <View style={[styles.catBarFill, { width: `${pct}%` as any, backgroundColor: colour }]} />
                </View>
                <Text style={styles.catVal}>{val.toFixed(1)}</Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {/* Common tags */}
      {(positiveTags.length > 0 || negativeTags.length > 0) ? (
        <View style={styles.tags}>
          {positiveTags.slice(0, 3).map(t => (
            <View key={t} style={[styles.tag, styles.tagPositive]}>
              <Text style={[styles.tagText, { color: Colors.success }]}>{TAG_LABELS[t] || t}</Text>
            </View>
          ))}
          {negativeTags.slice(0, 2).map(t => (
            <View key={t} style={[styles.tag, styles.tagNegative]}>
              <Text style={[styles.tagText, { color: Colors.error }]}>{TAG_LABELS[t] || t}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Disclaimer */}
      <Text style={styles.disclaimer}>
        Based on completed platform activity and contractor feedback.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  noDataText: { ...Typography.labelSM, color: Colors.textMuted },
  smLabel: { ...Typography.labelSM, color: Colors.textMuted },
  smLevel: { ...Typography.labelSM, fontWeight: '600' },

  // Card
  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardLabel: { ...Typography.labelXS, color: Colors.textMuted },
  cardLevel: { ...Typography.dataMD, fontWeight: '700' },
  ratingPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.cardAlt, paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border,
  },
  ratingText: { ...Typography.labelSM, fontWeight: '700' },
  ratingCount: { ...Typography.labelSM, color: Colors.textMuted },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { ...Typography.labelSM, color: Colors.textMuted, flex: 1 },

  categories: { gap: 8 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catLabel: { ...Typography.labelSM, color: Colors.textSecondary, width: 130 },
  catBarBg: { flex: 1, height: 4, backgroundColor: Colors.cardAlt, borderRadius: 2, overflow: 'hidden' },
  catBarFill: { height: 4, borderRadius: 2 },
  catVal: { ...Typography.labelXS, color: Colors.textMuted, width: 24, textAlign: 'right' },

  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: Radius.pill,
    borderWidth: 1,
  },
  tagPositive: { backgroundColor: Colors.successDim, borderColor: Colors.success + '55' },
  tagNegative: { backgroundColor: Colors.errorDim, borderColor: Colors.error + '55' },
  tagText: { fontSize: 11, fontWeight: '500' },

  disclaimer: { ...Typography.labelXS, color: Colors.textMuted },
});
