import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PCard } from '@/components/ui/PCard';
import { PBadge } from '@/components/ui/PBadge';
import { Colors, Typography, Spacing } from '@/constants/theme';
import { PrivateJob } from '@/contexts/JobsContext';

interface JobCardProps {
  job: PrivateJob;
  onPress: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  quoted: 'Quoted',
  invoiced: 'Invoiced',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

export function JobCard({ job, onPress }: JobCardProps) {
  return (
    <PCard onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{job.title}</Text>
          <Text style={styles.customer}>{job.customer}</Text>
        </View>
        <View style={styles.right}>
          <Text style={styles.total}>
            {job.job_type === 'hourly' && job.hourly_rate
              ? `£${job.hourly_rate}/hr`
              : `£${job.total.toLocaleString()}`}
          </Text>
          <PBadge label={STATUS_LABELS[job.status] || job.status} variant={job.status as any} />
        </View>
      </View>
      <View style={styles.meta}>
        <Text style={styles.metaText}>{job.created_at}</Text>
        {job.job_type === 'hourly' ? <Text style={styles.hourlyBadge}>⏱ HOURLY</Text> : null}
        {job.source_job_post_id ? <Text style={styles.sourceBadge}>PAI Job</Text> : null}
      </View>
    </PCard>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: Spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  info: { flex: 1 },
  title: { ...Typography.dataMD, marginBottom: 2 },
  customer: { ...Typography.bodySM },
  right: { alignItems: 'flex-end', gap: 6 },
  total: { ...Typography.dataLG, color: Colors.textPrimary },
  meta: { flexDirection: 'row', marginTop: 10, gap: 10 },
  metaText: { ...Typography.labelSM },
  sourceBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.primaryGlow,
    backgroundColor: Colors.primaryDim,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  hourlyBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.info,
    backgroundColor: Colors.infoDim,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
});
