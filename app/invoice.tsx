import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { useJobs } from '@/hooks/useJobs';
import { useTaxPot } from '@/hooks/useTaxPot';
import { useAuth } from '@/hooks/useAuth';
import { useAlert } from '@/template/ui';
import { APP_NAME } from '@/constants/config';
import { haptics } from '@/lib/haptics';
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

  // Guarded back: if there's no history (deep link / cold start), go to the app
  // instead of no-op'ing and stranding the user.
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const job = privateJobs.find(j => j.id === id);

  if (!job) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <Text style={styles.notFound}>Invoice not found</Text>
          <Pressable onPress={goBack}>
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
  // Hourly: pre-invoice statuses show as ESTIMATE; invoiced/paid show as INVOICE
  const isHourly = job.job_type === 'hourly';
  const isEstimateMode = isHourly && !isInvoiced && !isPaid;
  const docLabel = isEstimateMode ? 'ESTIMATE' : (isInvoiced || isPaid) ? 'INVOICE' : 'QUOTE';

  // Tabular line-item values
  const subtotal = job.labour + job.materials;
  const materialItems = (job.materials_items || []) as any[];
  const labourQty = isHourly ? (job.actual_hours ?? job.estimated_hours ?? 1) : 1;
  const labourRate = isHourly ? (job.hourly_rate ?? 0) : job.labour;
  const businessName = user?.business_name || (user as any)?.display_name || 'Your Business';
  const money = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const labourLineDesc = isHourly
    ? job.actual_hours != null
      ? `Labour (${job.actual_hours} hrs × £${job.hourly_rate}/hr)`
      : `Labour (est. ~${job.estimated_hours ?? '?'} hrs × £${job.hourly_rate ?? '?'}/hr)`
    : 'Labour';

  const handleShare = async () => {
    const dueDateStr = (() => {
      const d = job.invoiced_at ? new Date(job.invoiced_at) : new Date();
      d.setDate(d.getDate() + 14);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    })();

    const fromName = user?.business_name || (user as any)?.display_name || 'Contractor';
    const fromCity = user?.city ? `${user.city}${user.postcode_area ? `, ${user.postcode_area}` : ''}` : '';

    const labourDesc = isHourly
      ? job.actual_hours != null
        ? `Labour (${job.actual_hours} hrs × £${job.hourly_rate}/hr)`
        : `Labour est. (~${job.estimated_hours ?? '?'} hrs × £${job.hourly_rate ?? '?'}/hr)`
      : 'Labour';

    const lines = [
      `📋 ${docLabel} — ${invNum}`,
      ``,
      `From: ${fromName}`,
      ...(fromCity ? [`      ${fromCity}`] : []),
      ...(user?.email ? [`      ${user.email}`] : []),
      `To:   ${job.customer || 'Customer'}`,
      ``,
      `Job:  ${job.title}`,
      ...(job.description ? [`      ${job.description}`] : []),
      ``,
      `${labourDesc.padEnd(20)} £${job.labour.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`,
      `Materials: £${job.materials.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`,
      ...(job.vat > 0 ? [`VAT (20%): £${job.vat.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`] : []),
      ``,
      isEstimateMode
        ? `ESTIMATE TOTAL: £${job.total.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
        : `TOTAL DUE: £${job.total.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`,
      ``,
      ...(isEstimateMode
        ? [`ℹ️  This is an estimate based on approximately ${job.estimated_hours ?? '?'} hours at £${job.hourly_rate ?? '?'}/hr.`,
           `   Final invoice will reflect actual hours worked.`]
        : isPaid
          ? [`✅ PAID — ${formatDate(job.paid_at)}`]
          : [`⏳ Payment due by: ${dueDateStr}`,
             ``,
             `Reference: ${invNum}`,
             `Please quote this reference on your bank transfer.`]),
      ``,
      `Generated by PAI · Your trades business, sorted.`,
    ];

    try {
      await Share.share({
        message: lines.join('\n'),
        title: `${docLabel} ${invNum} — £${job.total.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`,
      });
    } catch {
      // User cancelled or share unavailable — no-op
    }
  };

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
            haptics.success();
            showAlert('Payment Recorded', 'Income added to your Tax Pot automatically.');
            goBack();
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
        <Pressable onPress={goBack} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textSecondary} />
        </Pressable>
        <Text style={styles.navTitle}>{isEstimateMode ? 'Estimate' : 'Invoice'}</Text>
        <Pressable hitSlop={8} onPress={handleShare}>
          <MaterialIcons name="ios-share" size={22} color={Colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Invoice document */}
        <View style={styles.doc}>
          {/* Header */}
          <View style={styles.docHeader}>
            <View style={styles.docHeaderLeft}>
              {user?.logo_url ? (
                <Image source={{ uri: user.logo_url }} style={styles.docLogo} contentFit="contain" />
              ) : (
                <Text style={styles.docBrand}>{APP_NAME}</Text>
              )}
              <Text style={styles.docBusiness}>{businessName}</Text>
              {user?.city ? (
                <Text style={styles.docBusinessSub}>{user.city}{user.postcode_area ? `, ${user.postcode_area}` : ''}</Text>
              ) : null}
            </View>
            <View style={styles.docHeaderRight}>
              <Text style={styles.docInvLabel}>{docLabel}</Text>
              <Text style={styles.docInvNumber}>{invNum}</Text>
              {isPaid ? (
                <View style={styles.paidStamp}>
                  <Text style={styles.paidStampText}>PAID</Text>
                </View>
              ) : isEstimateMode ? (
                <View style={styles.estimateStamp}>
                  <Text style={styles.estimateStampText}>ESTIMATE</Text>
                </View>
              ) : (
                <View style={styles.pendingStamp}>
                  <Text style={styles.pendingStampText}>AWAITING PAYMENT</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.docDivider} />

          {/* Customer + dates */}
          <View style={styles.datesRow}>
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>FOR</Text>
              <Text style={styles.dateValue}>{job.customer || 'Customer'}</Text>
            </View>
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>{docLabel} DATE</Text>
              <Text style={styles.dateValue}>{invoiceDate}</Text>
            </View>
            {!isEstimateMode && (isInvoiced || isPaid) ? (
              <View style={styles.dateItem}>
                <Text style={styles.dateLabel}>{isPaid ? 'DATE PAID' : 'DUE'}</Text>
                <Text style={[styles.dateValue, !isPaid && styles.dateValueDue]}>{dueDate}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.docDivider} />

          {/* Job description */}
          <View style={styles.jobDesc}>
            <Text style={styles.jobTitle}>{job.title}</Text>
            {job.description ? (
              <Text style={styles.jobDescText}>{job.description}</Text>
            ) : null}
          </View>

          {/* Line items table */}
          <View style={styles.table}>
            <View style={styles.tableHead}>
              <Text style={styles.thDesc}>DESCRIPTION</Text>
              <Text style={styles.thQty}>QTY</Text>
              <Text style={styles.thRate}>RATE</Text>
              <Text style={styles.thAmt}>AMOUNT</Text>
            </View>

            {/* Labour */}
            <View style={styles.tr}>
              <Text style={styles.tdDesc}>{isHourly ? 'Labour (hrs)' : 'Labour'}</Text>
              <Text style={styles.tdQty}>{labourQty}</Text>
              <Text style={styles.tdRate}>{money(labourRate)}</Text>
              <Text style={styles.tdAmt}>{money(job.labour)}</Text>
            </View>

            {/* Itemised materials */}
            {materialItems.map((m, i) => {
              const amt = m.estimatedPrice ?? (m.qty * (m.price ?? 0));
              const rate = m.price ?? (m.qty ? amt / m.qty : amt);
              return (
                <View key={i} style={styles.tr}>
                  <Text style={styles.tdDesc}>{m.name}</Text>
                  <Text style={styles.tdQty}>{m.qty}</Text>
                  <Text style={styles.tdRate}>{money(Number(rate) || 0)}</Text>
                  <Text style={styles.tdAmt}>{money(Number(amt) || 0)}</Text>
                </View>
              );
            })}

            {/* Single materials row when no itemised list */}
            {materialItems.length === 0 && job.materials > 0 ? (
              <View style={styles.tr}>
                <Text style={styles.tdDesc}>Materials</Text>
                <Text style={styles.tdQty}>1</Text>
                <Text style={styles.tdRate}>{money(job.materials)}</Text>
                <Text style={styles.tdAmt}>{money(job.materials)}</Text>
              </View>
            ) : null}
          </View>

          {/* Totals */}
          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text style={styles.totalRowLabel}>Subtotal</Text>
              <Text style={styles.totalRowValue}>{money(subtotal)}</Text>
            </View>
            {job.vat > 0 ? (
              <View style={styles.totalRow}>
                <Text style={styles.totalRowLabel}>VAT (20%)</Text>
                <Text style={styles.totalRowValue}>{money(job.vat)}</Text>
              </View>
            ) : null}
            <View style={styles.totalRow}>
              <Text style={styles.totalRowLabel}>Total</Text>
              <Text style={styles.totalRowValue}>{money(job.total)}</Text>
            </View>
            {isPaid ? (
              <View style={styles.totalRow}>
                <Text style={styles.totalRowLabel}>Paid</Text>
                <Text style={styles.totalRowValue}>{money(job.total)}</Text>
              </View>
            ) : null}
            <View style={[styles.balanceBox, isEstimateMode && styles.totalBoxEstimate]}>
              <Text style={styles.balanceLabel}>{isEstimateMode ? 'ESTIMATE TOTAL' : 'Balance Due'}</Text>
              <Text style={styles.balanceValue}>{money(isPaid ? 0 : job.total)}</Text>
            </View>
          </View>

          {/* Payment note */}
          <View style={styles.paymentNote}>
            <MaterialIcons name="info-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.paymentNoteText}>
              {isEstimateMode
                ? `This is an estimate based on approximately ${job.estimated_hours ?? '?'} hrs at £${job.hourly_rate ?? '?'}/hr. The final invoice will be based on actual hours worked.`
                : isPaid
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
      {isEstimateMode ? (
        <View style={styles.footer}>
          <Pressable style={[styles.shareBtn, { flex: 1 }]} onPress={handleShare}>
            <MaterialIcons name="ios-share" size={18} color={Colors.primaryGlow} />
            <Text style={styles.shareBtnText}>Share Estimate</Text>
          </Pressable>
        </View>
      ) : isInvoiced && !isPaid ? (
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
          <Pressable style={styles.shareBtn} onPress={handleShare}>
            <MaterialIcons name="ios-share" size={18} color={Colors.primaryGlow} />
            <Text style={styles.shareBtnText}>Share</Text>
          </Pressable>
        </View>
      ) : isPaid ? (
        <View style={styles.footer}>
          <Pressable style={styles.shareBtn} onPress={handleShare}>
            <MaterialIcons name="ios-share" size={18} color={Colors.primaryGlow} />
            <Text style={styles.shareBtnText}>Share</Text>
          </Pressable>
          <View style={[styles.paidBanner, { flex: 1 }]}>
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
  docBrand: { fontSize: 28, fontWeight: '900', color: Colors.primaryGlow, letterSpacing: -1 },
  docTagline: { ...Typography.labelSM, color: Colors.textMuted, marginTop: 2 },
  docHeaderLeft: { flex: 1, gap: 4 },
  docLogo: { width: 96, height: 48, alignSelf: 'flex-start' },
  docBusiness: { ...Typography.dataMD, color: Colors.textPrimary },
  docBusinessSub: { ...Typography.labelSM, color: Colors.textSecondary },

  // Line-item table
  table: { paddingHorizontal: 24, paddingTop: 16 },
  tableHead: { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  thDesc: { ...Typography.labelXS, color: Colors.textMuted, flex: 1 },
  thQty: { ...Typography.labelXS, color: Colors.textMuted, width: 38, textAlign: 'right' },
  thRate: { ...Typography.labelXS, color: Colors.textMuted, width: 72, textAlign: 'right' },
  thAmt: { ...Typography.labelXS, color: Colors.textMuted, width: 80, textAlign: 'right' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle },
  tdDesc: { ...Typography.bodyMD, flex: 1, paddingRight: 6 },
  tdQty: { ...Typography.labelMD, color: Colors.textSecondary, width: 38, textAlign: 'right' },
  tdRate: { ...Typography.labelMD, color: Colors.textSecondary, width: 72, textAlign: 'right' },
  tdAmt: { ...Typography.dataMD, width: 80, textAlign: 'right' },

  // Totals
  totals: { paddingHorizontal: 24, paddingTop: 14, gap: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalRowLabel: { ...Typography.labelMD, color: Colors.textSecondary },
  totalRowValue: { ...Typography.dataMD },
  balanceBox: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.primaryDim, borderRadius: Radius.md,
    padding: 14, marginTop: 6, borderWidth: 1, borderColor: Colors.primary,
  },
  balanceLabel: { ...Typography.labelMD, fontWeight: '700', color: Colors.primaryGlow },
  balanceValue: { fontSize: 24, fontWeight: '800', color: Colors.primaryGlow },
  docHeaderRight: { alignItems: 'flex-end', gap: 4 },
  docInvLabel: { ...Typography.labelXS, color: Colors.textMuted },
  docInvNumber: { ...Typography.dataMD, color: Colors.textPrimary },
  paidStamp: {
    marginTop: 4, paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: Colors.successDim, borderRadius: Radius.pill,
    borderWidth: 1, borderColor: Colors.success,
  },
  paidStampText: { fontSize: 10, fontWeight: '800', color: Colors.success, letterSpacing: 1 },
  estimateStamp: {
    marginTop: 4, paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: Colors.infoDim, borderRadius: Radius.pill,
    borderWidth: 1, borderColor: Colors.info,
  },
  estimateStampText: { fontSize: 10, fontWeight: '800', color: Colors.info, letterSpacing: 1 },
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
  totalBoxEstimate: {
    backgroundColor: Colors.infoDim, borderColor: Colors.info,
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
  paidBanner: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Colors.successDim, borderRadius: Radius.md, padding: 14,
  },
  paidFooterText: { ...Typography.dataMD, color: Colors.success },
});
