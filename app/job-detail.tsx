import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { PBadge } from '@/components/ui/PBadge';
import { PButton } from '@/components/ui/PButton';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { useJobs } from '@/hooks/useJobs';
import { useAlert } from '@/template';
import { MaterialIcons } from '@expo/vector-icons';

const STATUS_ACTIONS: Record<string, { label: string; next: string }> = {
  draft: { label: 'Send Quote', next: 'quoted' },
  quoted: { label: 'Mark Active', next: 'active' },
  active: { label: 'Send Invoice', next: 'invoiced' },
  invoiced: { label: 'Mark as Paid', next: 'paid' },
};

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { privateJobs, updatePrivateJob, deletePrivateJob } = useJobs();
  const { showAlert } = useAlert();

  const job = privateJobs.find(j => j.id === id);

  if (!job) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Job not found</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backLink}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const nextAction = STATUS_ACTIONS[job.status];

  const handleStatusUpdate = () => {
    if (!nextAction) return;
    const updates: any = { status: nextAction.next };
    if (nextAction.next === 'invoiced') updates.invoiced_at = new Date().toISOString().split('T')[0];
    if (nextAction.next === 'paid') updates.paid_at = new Date().toISOString().split('T')[0];
    updatePrivateJob(job.id, updates);
  };

  const handleDelete = () => {
    showAlert('Delete Job', 'This will permanently delete this job. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deletePrivateJob(job.id); router.back(); } },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textSecondary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{job.title}</Text>
          <PBadge label={job.status} variant={job.status as any} />
        </View>
        <Pressable onPress={handleDelete} hitSlop={8}>
          <MaterialIcons name="delete-outline" size={22} color={Colors.error} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Customer & Date */}
        <View style={styles.metaCard}>
          <View style={styles.metaRow}>
            <MaterialIcons name="person" size={16} color={Colors.textMuted} />
            <Text style={styles.metaLabel}>CUSTOMER</Text>
            <Text style={styles.metaValue}>{job.customer}</Text>
          </View>
          <View style={styles.metaRow}>
            <MaterialIcons name="calendar-today" size={16} color={Colors.textMuted} />
            <Text style={styles.metaLabel}>CREATED</Text>
            <Text style={styles.metaValue}>{job.created_at}</Text>
          </View>
          {job.invoiced_at ? (
            <View style={styles.metaRow}>
              <MaterialIcons name="receipt" size={16} color={Colors.textMuted} />
              <Text style={styles.metaLabel}>INVOICED</Text>
              <Text style={styles.metaValue}>{job.invoiced_at}</Text>
            </View>
          ) : null}
          {job.paid_at ? (
            <View style={styles.metaRow}>
              <MaterialIcons name="check-circle" size={16} color={Colors.success} />
              <Text style={styles.metaLabel}>PAID</Text>
              <Text style={[styles.metaValue, { color: Colors.success }]}>{job.paid_at}</Text>
            </View>
          ) : null}
          {job.source_job_post_id ? (
            <View style={styles.metaRow}>
              <MaterialIcons name="storefront" size={16} color={Colors.primaryGlow} />
              <Text style={styles.metaLabel}>SOURCE</Text>
              <Text style={[styles.metaValue, { color: Colors.primaryGlow }]}>PAI Marketplace</Text>
            </View>
          ) : null}
        </View>

        {/* Description */}
        {job.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Scope of Work</Text>
            <Text style={styles.description}>{job.description}</Text>
          </View>
        ) : null}

        {/* Financial breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quote Breakdown</Text>
          <View style={styles.breakdownCard}>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Labour</Text>
              <Text style={styles.breakdownValue}>£{job.labour.toLocaleString()}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Materials</Text>
              <Text style={styles.breakdownValue}>£{job.materials.toLocaleString()}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>VAT (20%)</Text>
              <Text style={styles.breakdownValue}>£{job.vat.toLocaleString()}</Text>
            </View>
            <View style={styles.breakdownDivider} />
            <View style={styles.breakdownRow}>
              <Text style={styles.totalLabel}>TOTAL</Text>
              <Text style={styles.totalValue}>£{job.total.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        {/* Materials items */}
        {job.materials_items.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Materials List</Text>
            {job.materials_items.map((item, i) => (
              <View key={i} style={styles.materialRow}>
                <Text style={styles.materialName}>{item.name}</Text>
                <Text style={styles.materialQty}>×{item.qty}</Text>
                <Text style={styles.materialPrice}>£{(item.qty * item.price).toFixed(2)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* AI Assist */}
        {job.status === 'draft' ? (
          <Pressable style={styles.aiCard} onPress={() => useAlert}>
            <MaterialIcons name="auto-awesome" size={20} color={Colors.primaryGlow} />
            <View style={styles.aiCardText}>
              <Text style={styles.aiTitle}>AI Assistant</Text>
              <Text style={styles.aiSubtitle}>Analyse photos, generate scope, suggest materials pricing</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
          </Pressable>
        ) : null}
      </ScrollView>

      {/* Action Footer */}
      {nextAction ? (
        <View style={styles.footer}>
          <PButton label={nextAction.label} onPress={handleStatusUpdate} fullWidth />
        </View>
      ) : job.status === 'paid' ? (
        <View style={styles.footer}>
          <View style={styles.paidBanner}>
            <MaterialIcons name="check-circle" size={20} color={Colors.success} />
            <Text style={styles.paidText}>Payment received · Job complete</Text>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  notFoundText: { ...Typography.headingMD },
  backLink: { ...Typography.labelMD, color: Colors.primaryLight },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1, gap: 4 },
  headerTitle: { ...Typography.headingMD },
  scroll: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 120 },
  metaCard: { backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaLabel: { ...Typography.labelXS, width: 72 },
  metaValue: { ...Typography.bodyMD, flex: 1 },
  section: { gap: 12 },
  sectionTitle: { ...Typography.headingMD },
  description: { ...Typography.bodyMD, color: Colors.textSecondary, lineHeight: 22 },
  breakdownCard: { backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 10 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between' },
  breakdownLabel: { ...Typography.labelMD, color: Colors.textSecondary },
  breakdownValue: { ...Typography.dataMD },
  breakdownDivider: { height: 1, backgroundColor: Colors.border },
  totalLabel: { ...Typography.labelMD, fontWeight: '700' },
  totalValue: { ...Typography.dataLG },
  materialRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.card, borderRadius: Radius.sm, padding: 12,
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  materialName: { ...Typography.bodyMD, flex: 1 },
  materialQty: { ...Typography.labelMD, color: Colors.textMuted },
  materialPrice: { ...Typography.dataMD },
  aiCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.primaryDim, borderRadius: Radius.lg, padding: 16,
    borderWidth: 1, borderColor: Colors.primary,
  },
  aiCardText: { flex: 1, gap: 3 },
  aiTitle: { ...Typography.dataMD, color: Colors.primaryGlow },
  aiSubtitle: { ...Typography.labelSM, color: Colors.textSecondary },
  footer: { padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.bg },
  paidBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.successDim, borderRadius: Radius.md, padding: 14 },
  paidText: { ...Typography.dataMD, color: Colors.success },
});
