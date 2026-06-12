import React, { useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { useJobs } from '@/hooks/useJobs';
import { useTaxPot } from '@/hooks/useTaxPot';
import { useAuth } from '@/hooks/useAuth';
import { useAlert } from '@/template';
import { APP_NAME } from '@/constants/config';
import { MaterialIcons } from '@expo/vector-icons';

function pad(n: number) { return String(n).padStart(2, '0'); }

function formatDate(iso?: string | null) {
  if (!iso) return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function invoiceNumber(id: string, createdAt: string) {
  const d = new Date(createdAt);
  return `PAI-${d.getFullYear()}${pad(d.getMonth() + 1)}-${id.slice(-6).toUpperCase()}`;
}

export default function InvoiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { privateJobs, updatePrivateJob } = useJobs();
  const { addPAIJobIncome } = useTaxPot();
  const { showAlert } = useAlert();
  const [marking, setMarking] = React.useState(false);

  const job = privateJobs.find(j => j.id === id);

  if (!job) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <Text style={styles.notFound}>Invoice not found</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backLink}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const invNum = invoiceNumber(job.id, job.created_at);
  const invoiceDate = job.invoiced_at ? formatDate(job.invoiced_at) : formatDate();
  const dueDate = job.paid_at ? formatDate(job.paid_at) : (() => {
    const d = job.invoiced_at ? new Date(job.invoiced_at) : new Date();
    d.setDate(d.getDate() + 14);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  })();

  const isPaid = job.status === 'paid';
  const isInvoiced = job.status === 'invoiced';

  const handleMarkPaid = () => {
    showAlert(
      'Mark as Paid',
      `Confirm that £${job.total.toLocaleString()} has been received from ${job.customer || 'the customer'}? This will add the income to your Tax Pot.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Payment',
          onPress: async () => {
            setMarking(true);
            const today = new Date().toISOString().split('T')[0];
            await updatePrivateJob(job.id, {
              status: 'paid',
              paid_at: today,
            });
            // Auto-add to Tax Pot as PAI income
            await addPAIJobIncome({
              job_id: job.id,
              job_title: job.title,
              customer_name: job.customer || '',
              amount: job.total,
              date_completed: today,
            });
            setMarking(false);
            showAlert('Payment Recorded', 'Income added to your Tax Pot automatically.');
            router.back();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="light" />

      {/* Nav */}
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textSecondary} />
        </Pressable>
        <Text style={styles.navTitle}>Invoice</Text>
        <Pressable
          hitSlop={8}
          onPress={() => showAlert('Share Invoice', 'PDF export and email delivery coming soon.')}
        >
          <MaterialIcons name="ios-share" size={22} color={Colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Invoice document */}
        <View style={styles.doc}>
          {/* Header */}
          <View style={styles.docHeader}>
            <View>
              <Text style={styles.docBrand}>{APP_NAME}</Text>
              <Text style={styles.docTagline}>for trades</Text>
            </View>
            <View style={styles.docHeaderRight}>
              <Text style={styles.docInvLabel}>INVOICE</Text>
              <Text style={styles.docInvNumber}>{invNum}</Text>
              {isPaid ? (
                <View style={styles.paidStamp}>
                  <Text style={styles.paidStampText}>PAID</Text>
                </View>
              ) : (
                <View style={styles.pendingStamp}>
                  <Text style={styles.pendingStampText}>AWAITING PAYMENT</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.docDivider} />

          {/* From / To */}
          <View style={styles.fromToRow}>
            <View style={styles.fromBlock}>
              <Text style={styles.fromToLabel}>FROM</Text>
              <Text style={styles.fromName}>{user?.business_name || user?.display_name || 'Contractor'}</Text>
              {user?.city ? <Text style={styles.fromDetail}>{user.city}{user.postcode_area ? `, ${user.postcode_area}` : ''}</Text> : null}
              {(user as any)?.website ? <Text style={styles.fromDetail}>{(user as any).website}</Text> : null}
              <Text style={styles.fromDetail}>{user?.email}</Text>
            </View>
            <View style={styles.toBlock}>
              <Text style={styles.fromToLabel}>TO</Text>
              <Text style={styles.fromName}>{job.customer || 'Customer'}</Text>
            </View>
          </View>

          {/* Dates */}
          <View style={styles.datesRow}>
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>INVOICE DATE</Text>
              <Text style={styles.dateValue}>{invoiceDate}</Text>
            </View>
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>{isPaid ? 'DATE PAID' : 'DUE DATE'}</Text>
              <Text style={[styles.dateValue, !isPaid && styles.dateValueDue]}>{dueDate}</Text>
            </View>
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>REF</Text>
              <Text style={styles.dateValue}>{invNum}</Text>
            </View>
          </View>

          <View style={styles.docDivider} />

          {/* Job description */}
          <View style={styles.jobDesc}>
            <Text style={styles.jobTitle}>{job.title}</Text>
            {job.description ? (
              <Text style={styles.jobDescText}>{job.description}</Text>
            ) : null}
          </View>

          {/* Line items */}
          <View style={styles.lineItems}>
            {/* Header row */}
            <View style={styles.lineHeader}>
              <Text style={[styles.lineHeaderText, { flex: 1 }]}>ITEM</Text>
              <Text style={[styles.lineHeaderText, styles.lineHeaderRight]}>AMOUNT</Text>
            </View>

            <View style={styles.lineRow}>
              <Text style={styles.lineItemName}>Labour</Text>
              <Text style={styles.lineItemAmount}>£{job.labour.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</Text>
            </View>

            <View style={styles.lineRow}>
              <Text style={styles.lineItemName}>Materials</Text>
              <Text style={styles.lineItemAmount}>£{job.materials.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</Text>
            </View>

            {/* Materials breakdown if available */}
            {job.materials_items && job.materials_items.length > 0 ? (
              job.materials_items.map((item: any, i: number) => (
                <View key={i} style={[styles.lineRow, styles.lineRowSub]}>
                  <Text style={styles.lineSubName}>↳ {item.name} × {item.qty}</Text>
                  <Text style={styles.lineSubAmount}>
                    £{(item.estimatedPrice ?? (item.qty * (item.price ?? 0))).toFixed(2)}
                  </Text>
                </View>
              ))
            ) : null}

            {job.vat > 0 ? (
              <View style={styles.lineRow}>
                <Text style={styles.lineItemName}>VAT (20%)</Text>
                <Text style={styles.lineItemAmount}>£{job.vat.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</Text>
              </View>
            ) : null}

            {/* Subtotal line */}
            <View style={styles.subtotalDivider} />
            <View style={styles.subtotalRow}>
              <View>
                <Text style={styles.subtotalLabel}>SUBTOTAL (ex. VAT)</Text>
              </View>
              <Text style={styles.subtotalValue}>£{(job.labour + job.materials).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</Text>
            </View>

            {/* Total */}
            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>TOTAL DUE</Text>
              <Text style={styles.totalValue}>£{job.total.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</Text>
            </View>
          </View>

          {/* Payment note */}
          <View style={styles.paymentNote}>
            <MaterialIcons name="info-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.paymentNoteText}>
              {isPaid
                ? `Payment received on ${formatDate(job.paid_at)}. Thank you.`
                : 'Please make payment within 14 days via bank transfer. Reference your invoice number on the payment.'}
            </Text>
          </View>

          {/* Footer */}
          <View style={styles.docFooter}>
            <Text style={styles.docFooterText}>Generated by PAI · Your trades business, sorted.</Text>
          </View>
        </View>

        {/* Tax Pot notice */}
        {isPaid ? (
          <View style={styles.taxPotNote}>
            <MaterialIcons name="savings" size={16} color={Colors.primaryGlow} />
            <Text style={styles.taxPotNoteText}>
              £{job.total.toLocaleString()} included in your Tax Pot calculations.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Action Footer */}
      {isInvoiced && !isPaid ? (
        <View style={styles.footer}>
          <Pressable
            style={[styles.markPaidBtn, marking && styles.btnDisabled]}
            onPress={handleMarkPaid}
            disabled={marking}
          >
            {marking
              ? <ActivityIndicator size="small" color={Colors.textInverse} />
              : (
                <>
                  <MaterialIcons name="check-circle" size={18} color={Colors.textInverse} />
                  <Text style={styles.markPaidBtnText}>Mark as Paid</Text>
                </>
              )}
          </Pressable>
          <Pressable
            style={styles.shareBtn}
            onPress={() => showAlert('Share Invoice', 'PDF export and email delivery coming soon.')}
          >
            <MaterialIcons name="ios-share" size={18} color={Colors.primaryGlow} />
            <Text style={styles.shareBtnText}>Share</Text>
          </Pressable>
        </View>
      ) : isPaid ? (
        <View style={styles.footer}>
          <View style={styles.paidFooter}>
            <MaterialIcons name="check-circle" size={20} color={Colors.success} />
            <Text style={styles.paidFooterText}>Paid · {formatDate(job.paid_at)}</Text>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  notFound: { ...Typography.headingMD },
  backLink: { ...Typography.labelMD, color: Colors.primaryLight },

  nav: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  navTitle: { flex: 1, ...Typography.headingMD },

  scroll: { padding: Spacing.md, paddingBottom: 120, gap: Spacing.md },

  // Invoice document
  doc: {
    backgroundColor: Colors.card, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  docHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: 24, backgroundColor: Colors.primaryDim,
  },
  docBrand: { fontSize: 28, fontWeight: '900', fontStyle: 'italic', color: Colors.primaryGlow, letterSpacing: -1 },
  docTagline: { ...Typography.labelSM, color: Colors.textMuted, marginTop: 2 },
  docHeaderRight: { alignItems: 'flex-end', gap: 4 },
  docInvLabel: { ...Typography.labelXS, color: Colors.textMuted },
  docInvNumber: { ...Typography.dataMD, color: Colors.textPrimary },
  paidStamp: {
    marginTop: 4, paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: Colors.successDim, borderRadius: Radius.pill,
    borderWidth: 1, borderColor: Colors.success,
  },
  paidStampText: { fontSize: 10, fontWeight: '800', color: Colors.success, letterSpacing: 1 },
  pendingStamp: {
    marginTop: 4, paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: Colors.warningDim, borderRadius: Radius.pill,
    borderWidth: 1, borderColor: Colors.warning,
  },
  pendingStampText: { fontSize: 9, fontWeight: '800', color: Colors.warning, letterSpacing: 0.5 },

  docDivider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 24 },

  fromToRow: { flexDirection: 'row', gap: 0, padding: 24, paddingBottom: 16 },
  fromBlock: { flex: 1, gap: 3 },
  toBlock: { flex: 1, gap: 3, paddingLeft: 16, borderLeftWidth: 1, borderLeftColor: Colors.border },
  fromToLabel: { ...Typography.labelXS, color: Colors.textMuted, marginBottom: 4 },
  fromName: { ...Typography.dataMD },
  fromDetail: { ...Typography.labelSM, color: Colors.textSecondary },

  datesRow: { flexDirection: 'row', paddingHorizontal: 24, paddingBottom: 20, gap: 0 },
  dateItem: { flex: 1, gap: 3 },
  dateLabel: { ...Typography.labelXS, color: Colors.textMuted },
  dateValue: { ...Typography.labelMD },
  dateValueDue: { color: Colors.warning },

  // Job desc
  jobDesc: { padding: 24, paddingTop: 20, paddingBottom: 12, gap: 6 },
  jobTitle: { ...Typography.headingMD },
  jobDescText: { ...Typography.bodyMD, color: Colors.textSecondary, lineHeight: 20 },

  // Line items
  lineItems: { paddingHorizontal: 24, paddingBottom: 24, gap: 0 },
  lineHeader: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border, marginBottom: 4 },
  lineHeaderText: { ...Typography.labelXS, color: Colors.textMuted },
  lineHeaderRight: { textAlign: 'right', width: 90 },
  lineRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle },
  lineRowSub: { paddingVertical: 5, paddingLeft: 12 },
  lineItemName: { ...Typography.bodyMD, flex: 1 },
  lineItemAmount: { ...Typography.dataMD, width: 90, textAlign: 'right' },
  lineSubName: { ...Typography.labelSM, color: Colors.textSecondary, flex: 1 },
  lineSubAmount: { ...Typography.labelSM, color: Colors.textSecondary, width: 90, textAlign: 'right' },
  subtotalDivider: { height: 1, backgroundColor: Colors.border, marginTop: 8, marginBottom: 10 },
  subtotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12 },
  subtotalLabel: { ...Typography.labelSM, color: Colors.textSecondary },
  subtotalValue: { ...Typography.labelMD },
  totalBox: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.primaryDim, borderRadius: Radius.md,
    padding: 14, borderWidth: 1, borderColor: Colors.primary,
  },
  totalLabel: { ...Typography.labelMD, fontWeight: '700', color: Colors.primaryGlow },
  totalValue: { fontSize: 24, fontWeight: '800', color: Colors.primaryGlow },

  // Payment note
  paymentNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginHorizontal: 24, marginBottom: 16,
    backgroundColor: Colors.cardAlt, borderRadius: Radius.sm, padding: 12,
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  paymentNoteText: { ...Typography.labelSM, color: Colors.textSecondary, flex: 1, lineHeight: 18 },

  docFooter: { paddingHorizontal: 24, paddingBottom: 16 },
  docFooterText: { ...Typography.labelXS, color: Colors.textMuted, textAlign: 'center' },

  // Tax pot note
  taxPotNote: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.primaryDim, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.primaryLight, padding: 14,
  },
  taxPotNoteText: { ...Typography.labelMD, color: Colors.primaryGlow, flex: 1 },

  // Footer actions
  footer: {
    flexDirection: 'row', gap: 10, padding: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.bg,
  },
  markPaidBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 54, backgroundColor: Colors.primary, borderRadius: Radius.lg,
  },
  btnDisabled: { opacity: 0.5 },
  markPaidBtnText: { ...Typography.btnMD, color: Colors.textInverse },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 54, paddingHorizontal: 20,
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
  },
  shareBtnText: { ...Typography.btnMD, color: Colors.primaryGlow },
  paidFooter: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Colors.successDim, borderRadius: Radius.md, padding: 14,
  },
  paidFooterText: { ...Typography.dataMD, color: Colors.success },
});
