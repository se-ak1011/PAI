import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { useJobs } from '@/hooks/useJobs';
import { useTaxPot } from '@/hooks/useTaxPot';
import { useAlert } from '@/template';
import { JOB_STATUS_ACTIONS } from '@/constants/config';
import { MaterialIcons } from '@expo/vector-icons';

const STATUS_LABELS: Record<string, string> = {
  draft: 'DRAFT',
  sent: 'QUOTE SENT',
  accepted: 'ACCEPTED',
  in_progress: 'IN PROGRESS',
  contractor_marked_done: 'AWAITING INVOICE',
  invoiced: 'INVOICED',
  paid: 'PAID',
  cancelled: 'CANCELLED',
};

const STATUS_COLORS: Record<string, string> = {
  draft: Colors.textMuted,
  sent: Colors.info,
  accepted: Colors.primaryGlow,
  in_progress: Colors.primaryGlow,
  contractor_marked_done: Colors.warning,
  invoiced: Colors.warning,
  paid: Colors.success,
  cancelled: Colors.error,
};

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { privateJobs, updatePrivateJob, deletePrivateJob } = useJobs();
  const { addPAIJobIncome } = useTaxPot();
  const { showAlert } = useAlert();

  const job = privateJobs.find(j => j.id === id);
  const [updating, setUpdating] = useState(false);

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

  const nextAction = JOB_STATUS_ACTIONS[job.status];
  const statusColor = STATUS_COLORS[job.status] ?? Colors.textMuted;
  const statusLabel = STATUS_LABELS[job.status] ?? job.status.toUpperCase();

  const handleStatusUpdate = async () => {
    if (!nextAction) return;

    // "Send Invoice" — update status then open invoice screen
    if (nextAction.next === 'invoiced') {
      setUpdating(true);
      await updatePrivateJob(job.id, {
        status: 'invoiced',
        invoiced_at: new Date().toISOString().split('T')[0],
      });
      setUpdating(false);
      router.push({ pathname: '/invoice', params: { id: job.id } });
      return;
    }

    setUpdating(true);
    const updates: Record<string, unknown> = { status: nextAction.next };
    if (nextAction.next === 'paid') {
      updates.paid_at = new Date().toISOString().split('T')[0];
      await updatePrivateJob(job.id, updates);
      // Auto-add to Tax Pot
      await addPAIJobIncome({
        job_id: job.id,
        job_title: job.title,
        customer_name: job.customer || '',
        amount: job.total,
        date_completed: updates.paid_at as string,
      });
      setUpdating(false);
      showAlert('Payment Recorded', 'Income added to your Tax Pot.');
      return;
    }
    await updatePrivateJob(job.id, updates);
    setUpdating(false);
  };

  const handleDelete = () => {
    showAlert('Delete Job', 'This will permanently delete this job. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deletePrivateJob(job.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textSecondary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{job.title}</Text>
          <View style={[styles.statusBadge, { borderColor: statusColor + '60', backgroundColor: statusColor + '1A' }]}>
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>
        <Pressable onPress={handleDelete} hitSlop={8}>
          <MaterialIcons name="delete-outline" size={22} color={Colors.error} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Customer & Dates */}
        <View style={styles.metaCard}>
          <View style={styles.metaRow}>
            <MaterialIcons name="person" size={16} color={Colors.textMuted} />
            <Text style={styles.metaLabel}>CUSTOMER</Text>
            <Text style={styles.metaValue}>{job.customer}</Text>
          </View>
          <View style={styles.metaRow}>
            <MaterialIcons name="calendar-today" size={16} color={Colors.textMuted} />
            <Text style={styles.metaLabel}>CREATED</Text>
            <Text style={styles.metaValue}>{new Date(job.created_at).toLocaleDateString('en-GB')}</Text>
          </View>
          {job.invoiced_at ? (
            <View style={styles.metaRow}>
              <MaterialIcons name="receipt" size={16} color={Colors.warning} />
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

        {/* Status timeline */}
        <View style={styles.timeline}>
          {['draft', 'sent', 'accepted', 'in_progress', 'contractor_marked_done', 'invoiced', 'paid'].map((s, i) => {
            const statuses = ['draft', 'sent', 'accepted', 'in_progress', 'contractor_marked_done', 'invoiced', 'paid'];
            const currentIdx = statuses.indexOf(job.status);
            const isDone = i < currentIdx;
            const isCurrent = s === job.status;
            return (
              <View key={s} style={styles.timelineItem}>
                <View style={[styles.timelineDot, isDone && styles.timelineDotDone, isCurrent && styles.timelineDotCurrent]}>
                  {isDone ? <MaterialIcons name="check" size={10} color={Colors.textInverse} /> : null}
                </View>
                <Text style={[styles.timelineLabel, isCurrent && styles.timelineLabelCurrent, isDone && styles.timelineLabelDone]}>
                  {STATUS_LABELS[s] ?? s}
                </Text>
              </View>
            );
          })}
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

        {/* Materials */}
        {job.materials_items && job.materials_items.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Materials List</Text>
            {job.materials_items.map((item: any, i: number) => (
              <View key={i} style={styles.materialRow}>
                <Text style={styles.materialName}>{item.name}</Text>
                <Text style={styles.materialQty}>
                  {item.qty} {item.unit || '×'}
                </Text>
                <Text style={styles.materialPrice}>
                  £{(item.estimatedPrice ?? (item.qty * (item.price ?? 0))).toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {/* Action Footer */}
      {nextAction ? (
        <View style={styles.footer}>
          {/* Show View Invoice button alongside for invoiced state */}
          {job.status === 'invoiced' ? (
            <Pressable
              style={styles.viewInvoiceBtn}
              onPress={() => router.push({ pathname: '/invoice', params: { id: job.id } })}
            >
              <MaterialIcons name="receipt" size={18} color={Colors.primaryGlow} />
              <Text style={styles.viewInvoiceBtnText}>View Invoice</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={[styles.actionBtn, updating && styles.actionBtnDisabled]}
            onPress={handleStatusUpdate}
            disabled={updating}
          >
            {updating ? (
              <ActivityIndicator size="small" color={Colors.textInverse} />
            ) : (
              <>
                <MaterialIcons
                  name={nextAction.next === 'invoiced' ? 'receipt' : 'arrow-forward'}
                  size={18}
                  color={Colors.textInverse}
                />
                <Text style={styles.actionBtnText}>{nextAction.label}</Text>
              </>
            )}
          </Pressable>
        </View>
      ) : job.status === 'paid' ? (
        <View style={styles.footer}>
          <Pressable
            style={styles.viewInvoiceBtn}
            onPress={() => router.push({ pathname: '/invoice', params: { id: job.id } })}
          >
            <MaterialIcons name="receipt" size={18} color={Colors.primaryGlow} />
            <Text style={styles.viewInvoiceBtnText}>View Invoice</Text>
          </Pressable>
          <View style={[styles.paidBanner, { flex: 1 }]}>
            <MaterialIcons name="check-circle" size={20} color={Colors.success} />
            <Text style={styles.paidText}>Payment received</Text>
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
  statusBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: Radius.pill, borderWidth: 1,
  },
  statusBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  scroll: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 120 },
  metaCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1,
    borderColor: Colors.border, padding: 16, gap: 12,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaLabel: { ...Typography.labelXS, width: 80 },
  metaValue: { ...Typography.bodyMD, flex: 1 },
  // Timeline
  timeline: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  timelineItem: { flex: 1, alignItems: 'center', gap: 4 },
  timelineDot: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.cardAlt, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  timelineDotDone: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  timelineDotCurrent: { borderColor: Colors.primaryGlow, borderWidth: 2 },
  timelineLabel: { fontSize: 8, fontWeight: '500', color: Colors.textMuted, textAlign: 'center', letterSpacing: 0.3 },
  timelineLabelCurrent: { color: Colors.primaryGlow },
  timelineLabelDone: { color: Colors.textSecondary },
  section: { gap: 12 },
  sectionTitle: { ...Typography.headingMD },
  description: { ...Typography.bodyMD, color: Colors.textSecondary, lineHeight: 22 },
  breakdownCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1,
    borderColor: Colors.border, padding: 16, gap: 10,
  },
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
  footer: { flexDirection: 'row', gap: 10, padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.bg },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    height: 54, backgroundColor: Colors.primary, borderRadius: Radius.lg,
  },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { ...Typography.btnMD, color: Colors.textInverse },
  viewInvoiceBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 54, paddingHorizontal: 16,
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
  },
  viewInvoiceBtnText: { ...Typography.btnSM, color: Colors.primaryGlow },
  paidBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Colors.successDim, borderRadius: Radius.md, padding: 14,
  },
  paidText: { ...Typography.dataMD, color: Colors.success },
});
