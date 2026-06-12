import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AddIncomeModal } from '@/components/feature/AddIncomeModal';
import { RoleSwitcherBar } from './_layout';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { useTaxPot } from '@/hooks/useTaxPot';
import { useAuth } from '@/hooks/useAuth';
import { MaterialIcons } from '@expo/vector-icons';

type FilterType = 'All' | 'PAI' | 'Manual';

export default function TaxPotScreen() {
  const { summary, allIncome, taxRate, setTaxRate, deleteManualIncome } = useTaxPot();
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [incomeFilter, setIncomeFilter] = useState<FilterType>('All');

  const filteredIncome = incomeFilter === 'All'
    ? allIncome
    : allIncome.filter(i => i.source === (incomeFilter === 'PAI' ? 'pai' : 'manual'));

  // UK tax year: 6 April → 5 April the following year
  const now = new Date();
  const taxYearStart = now >= new Date(now.getFullYear(), 3, 6)
    ? new Date(now.getFullYear(), 3, 6)
    : new Date(now.getFullYear() - 1, 3, 6);
  const taxYearEnd = new Date(taxYearStart.getFullYear() + 1, 3, 5);
  const taxYearLabel = `${taxYearStart.getFullYear()}/${String(taxYearEnd.getFullYear()).slice(-2)}`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Your Tax Pot</Text>
          <Text style={styles.subtitle}>Guidance only — not financial advice</Text>
        </View>

        {/* Main Tax Pot Card */}
        <View style={styles.potCard}>
          <Text style={styles.potLabel}>ESTIMATED TAX RESERVED</Text>
          <Text style={styles.potGuidanceText}>Based on your current earnings and selected tax status. Guidance only.</Text>
          <Text style={styles.potAmount}>£{summary.totalSetAside.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</Text>

          <View style={styles.potBreakdown}>
            <View style={styles.potRow}>
              <View style={styles.potRowLeft}>
                <View style={[styles.potDot, { backgroundColor: Colors.primaryGlow }]} />
                <Text style={styles.potRowLabel}>PAI Jobs</Text>
              </View>
              <Text style={styles.potRowValue}>£{summary.paiIncomeTotal.toLocaleString()}</Text>
            </View>
            <View style={styles.potRow}>
              <View style={styles.potRowLeft}>
                <View style={[styles.potDot, { backgroundColor: Colors.info }]} />
                <Text style={styles.potRowLabel}>Manual Income</Text>
              </View>
              <Text style={styles.potRowValue}>£{summary.manualIncomeTotal.toLocaleString()}</Text>
            </View>
            <View style={[styles.potRow, styles.potRowTotal]}>
              <Text style={styles.potTotalLabel}>Total Earnings</Text>
              <Text style={styles.potTotalValue}>£{summary.totalEarnings.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        {/* Tax Rate Toggle */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tax Status</Text>
          <View style={styles.rateRow}>
            {[
              { label: 'Self-Employed', rate: 30 },
              { label: 'CIS', rate: 20 },
            ].map(option => (
              <Pressable
                key={option.rate}
                style={[styles.rateBtn, taxRate === option.rate && styles.rateBtnActive]}
                onPress={() => setTaxRate(option.rate)}
              >
                <Text style={[styles.rateBtnTitle, taxRate === option.rate && styles.rateBtnTitleActive]}>{option.label}</Text>
                <Text style={[styles.rateBtnRate, taxRate === option.rate && styles.rateBtnRateActive]}>{option.rate}%</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Yearly Projection */}
        <View style={styles.projectionCard}>
          <Text style={styles.projectionYear}>TAX YEAR {taxYearLabel} · ENDS 5 APR {taxYearEnd.getFullYear()}</Text>
          <View style={styles.projectionRows}>
            <View style={styles.projectionRow}>
              <Text style={styles.projectionLabel}>Your earnings (combined)</Text>
              <Text style={styles.projectionValue}>£{Math.round(summary.yearlyProjection).toLocaleString()}</Text>
            </View>
            <View style={styles.projectionRow}>
              <Text style={styles.projectionLabel}>Estimated tax owed ({taxRate}%)</Text>
              <Text style={[styles.projectionValue, { color: Colors.error }]}>£{Math.round(summary.estimatedTax).toLocaleString()}</Text>
            </View>
            <View style={[styles.projectionRow, styles.projectionHighlight]}>
              <Text style={styles.projectionHighlightLabel}>Suggested monthly set-aside</Text>
              <Text style={styles.projectionHighlightValue}>£{Math.round(summary.monthlySetAside).toLocaleString()}</Text>
            </View>
          </View>
          <Text style={styles.disclaimer}>
            Projections are based on your current income run-rate and are for guidance only. Actual tax liability may vary. Consult a qualified accountant.
          </Text>
        </View>

        {/* Income Log */}
        <View style={styles.section}>
          <View style={styles.logHeader}>
            <Text style={styles.sectionTitle}>Income Log</Text>
            <Pressable style={styles.addBtn} onPress={() => setShowModal(true)}>
              <MaterialIcons name="add" size={16} color={Colors.textInverse} />
              <Text style={styles.addBtnText}>Add</Text>
            </Pressable>
          </View>

          {/* Filter */}
          <View style={styles.filterRow}>
            {(['All', 'PAI', 'Manual'] as FilterType[]).map(f => (
              <Pressable
                key={f}
                style={[styles.filterChip, incomeFilter === f && styles.filterChipActive]}
                onPress={() => setIncomeFilter(f)}
              >
                <Text style={[styles.filterChipText, incomeFilter === f && styles.filterChipTextActive]}>{f}</Text>
              </Pressable>
            ))}
          </View>

          {filteredIncome.length === 0 ? (
            <View style={styles.empty}>
              <MaterialIcons name="receipt-long" size={36} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No income entries yet</Text>
            </View>
          ) : (
            filteredIncome.map(entry => {
              const isPAI = entry.source === 'pai';
              const date = isPAI ? (entry as any).date_completed : (entry as any).date;
              const customerName = isPAI ? (entry as any).customer_name : (entry as any).customer_name;
              const isManual = !isPAI;
              const isPaid = isPAI ? true : (entry as any).payment_status === 'paid';

              return (
                <View key={entry.id} style={styles.incomeRow}>
                  <View style={[styles.incomeSource, isPAI ? styles.incomeSourcePAI : styles.incomeSourceManual]}>
                    <MaterialIcons name={isPAI ? 'verified' : 'edit'} size={14} color={isPAI ? Colors.primaryGlow : Colors.info} />
                  </View>
                  <View style={styles.incomeInfo}>
                    <View style={styles.incomeInfoTop}>
                      <Text style={styles.incomeSourceLabel}>{isPAI ? 'PAI Job' : (entry as any).category}</Text>
                      {!isPaid ? <Text style={styles.unpaidBadge}>UNPAID</Text> : null}
                    </View>
                    {customerName ? <Text style={styles.incomeCustomer}>{customerName}</Text> : null}
                    <Text style={styles.incomeDate}>{date}</Text>
                  </View>
                  <View style={styles.incomeAmounts}>
                    <Text style={styles.incomeAmount}>£{entry.amount.toLocaleString()}</Text>
                    <Text style={styles.incomeTax}>set aside: £{entry.tax_set_aside.toLocaleString()}</Text>
                  </View>
                  {isManual ? (
                    <Pressable
                      onPress={() => deleteManualIncome(entry.id)}
                      hitSlop={8}
                      style={styles.deleteBtn}
                    >
                      <MaterialIcons name="delete-outline" size={18} color={Colors.textMuted} />
                    </Pressable>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <AddIncomeModal visible={showModal} onClose={() => setShowModal(false)} />
      <RoleSwitcherBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 100 },
  header: { gap: 4 },
  title: { ...Typography.brandLG },
  subtitle: { ...Typography.labelSM },
  potCard: {
    backgroundColor: Colors.primaryDim,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.primary,
    padding: 24,
    gap: 16,
  },
  potLabel: { ...Typography.labelXS, color: Colors.primaryLight },
  potGuidanceText: { ...Typography.labelSM, color: Colors.primaryLight, opacity: 0.7, lineHeight: 17, marginTop: -8 },
  potAmount: { ...Typography.dataXL, fontSize: 40, color: Colors.taxPot },
  potBreakdown: { gap: 10 },
  potRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  potRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  potDot: { width: 8, height: 8, borderRadius: 4 },
  potRowLabel: { ...Typography.labelMD, color: Colors.textSecondary },
  potRowValue: { ...Typography.dataMD },
  potRowTotal: {
    borderTopWidth: 1, borderTopColor: Colors.primaryLight,
    paddingTop: 10, marginTop: 4,
  },
  potTotalLabel: { ...Typography.labelMD, fontWeight: '600' },
  potTotalValue: { ...Typography.dataLG },
  section: { gap: 14 },
  sectionTitle: { ...Typography.headingMD },
  rateRow: { flexDirection: 'row', gap: 10 },
  rateBtn: {
    flex: 1, padding: 16, borderRadius: Radius.lg, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: Colors.card, gap: 4,
  },
  rateBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryDim },
  rateBtnTitle: { ...Typography.labelMD, color: Colors.textSecondary },
  rateBtnTitleActive: { color: Colors.textPrimary },
  rateBtnRate: { ...Typography.dataLG, color: Colors.textMuted },
  rateBtnRateActive: { color: Colors.primaryGlow },
  projectionCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1,
    borderColor: Colors.border, padding: 20, gap: 16,
  },
  projectionYear: { ...Typography.labelXS, color: Colors.textMuted },
  projectionRows: { gap: 12 },
  projectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  projectionLabel: { ...Typography.bodyMD, color: Colors.textSecondary },
  projectionValue: { ...Typography.dataMD },
  projectionHighlight: {
    backgroundColor: Colors.cardAlt, borderRadius: Radius.md, padding: 12,
    marginTop: 4,
  },
  projectionHighlightLabel: { ...Typography.labelMD, color: Colors.textSecondary },
  projectionHighlightValue: { ...Typography.dataLG, color: Colors.success },
  disclaimer: { ...Typography.labelSM, color: Colors.textMuted, lineHeight: 18 },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 6,
  },
  addBtnText: { ...Typography.btnSM, color: Colors.textInverse },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.pill,
    backgroundColor: Colors.cardAlt, borderWidth: 1, borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { ...Typography.labelSM, color: Colors.textSecondary },
  filterChipTextActive: { color: Colors.textInverse, fontWeight: '600' },
  empty: { alignItems: 'center', padding: Spacing.xl, gap: 10 },
  emptyText: { ...Typography.bodyMD, color: Colors.textMuted },
  incomeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: 14, marginBottom: Spacing.sm,
  },
  incomeSource: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  incomeSourcePAI: { backgroundColor: Colors.primaryDim },
  incomeSourceManual: { backgroundColor: Colors.infoDim },
  incomeInfo: { flex: 1, gap: 2 },
  incomeInfoTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  incomeSourceLabel: { ...Typography.labelMD, color: Colors.textPrimary },
  unpaidBadge: { fontSize: 9, fontWeight: '700', color: Colors.warning, backgroundColor: Colors.warningDim, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  incomeCustomer: { ...Typography.labelSM },
  incomeDate: { ...Typography.labelSM, color: Colors.textMuted },
  incomeAmounts: { alignItems: 'flex-end', gap: 3 },
  incomeAmount: { ...Typography.dataLG, color: Colors.success },
  incomeTax: { ...Typography.labelSM, color: Colors.textMuted },
  deleteBtn: { padding: 4 },
});
