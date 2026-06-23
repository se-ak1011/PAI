import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Modal, TextInput, ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTaxPot } from '@/hooks/useTaxPot';
import { useAlert } from '@/template/ui';
import { haptics } from '@/lib/haptics';
import {
  Expense, ExpenseCategory, ExpenseSplit, deductibleAmount,
  listExpenses, addExpense, deleteExpense, pickReceiptImage, analyzeReceipt,
} from '@/services/receiptService';

const CATEGORIES: { id: ExpenseCategory; label: string; icon: any }[] = [
  { id: 'materials', label: 'Materials', icon: 'inventory-2' },
  { id: 'tools', label: 'Tools', icon: 'build' },
  { id: 'ppe', label: 'PPE', icon: 'health-and-safety' },
  { id: 'fuel', label: 'Fuel', icon: 'local-gas-station' },
  { id: 'parking', label: 'Parking', icon: 'local-parking' },
  { id: 'clothing', label: 'Workwear', icon: 'checkroom' },
  { id: 'subcontractor', label: 'Subcontractor', icon: 'groups' },
  { id: 'other', label: 'Other', icon: 'more-horiz' },
];
const SPLITS: ExpenseSplit[] = ['business', 'personal', 'mixed'];

/** Receipt Vault content (no screen chrome) — embeddable as a tab or screen. */
export function ReceiptVaultPanel() {
  const { user } = useAuth();
  const { summary } = useTaxPot();
  const { showAlert } = useAlert();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = React.useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setExpenses(await listExpenses(user.id));
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const totalDeductible = expenses.reduce((s, e) => s + deductibleAmount(e), 0);
  const taxableProfit = Math.max(0, summary.totalEarnings - totalDeductible);
  const needsReview = expenses.filter(e => e.needs_review).length;

  const handleDelete = (e: Expense) => {
    showAlert('Remove expense', 'Delete this expense and its receipt?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteExpense(e.id, e.receipt_path); load(); } },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Potential deductible expenses</Text>
            <Text style={[styles.summaryVal, { color: Colors.success }]}>£{totalDeductible.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Income (this year)</Text>
            <Text style={styles.summaryVal}>£{summary.totalEarnings.toFixed(2)}</Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryFinal]}>
            <Text style={styles.summaryFinalLabel}>Estimated taxable profit</Text>
            <Text style={styles.summaryFinalVal}>£{taxableProfit.toFixed(2)}</Text>
          </View>
          {needsReview > 0 ? (
            <View style={styles.reviewPill}>
              <MaterialIcons name="rate-review" size={13} color={Colors.warning} />
              <Text style={styles.reviewPillText}>{needsReview} receipt{needsReview > 1 ? 's' : ''} need review</Text>
            </View>
          ) : null}
          <Text style={styles.disclaimer}>
            Estimates only — not tax advice. Confirm allowable expenses with your accountant.
          </Text>
        </View>

        {/* Add expense */}
        <Pressable style={styles.addExpenseBtn} onPress={() => { haptics.tap(); setShowAdd(true); }}>
          <MaterialIcons name="add" size={18} color={Colors.textInverse} />
          <Text style={styles.addExpenseBtnText}>Add expense</Text>
        </Pressable>

        {/* List */}
        {loading ? (
          <ActivityIndicator color={Colors.primaryGlow} style={{ marginTop: 40 }} />
        ) : expenses.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="receipt-long" size={32} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No expenses yet</Text>
            <Text style={styles.emptySub}>Snap a receipt and PAI will help you log it.</Text>
          </View>
        ) : (
          expenses.map(e => {
            const cat = CATEGORIES.find(c => c.id === e.category);
            return (
              <Pressable key={e.id} style={styles.row} onLongPress={() => handleDelete(e)}>
                <View style={styles.rowIcon}>
                  <MaterialIcons name={cat?.icon ?? 'receipt'} size={18} color={Colors.primaryGlow} />
                </View>
                <View style={styles.rowMid}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{e.vendor || cat?.label || 'Expense'}</Text>
                  <Text style={styles.rowSub}>
                    {cat?.label ?? 'Other'} · {e.split}{e.needs_review ? ' · ⚠ review' : ''}
                  </Text>
                </View>
                <Text style={styles.rowAmount}>£{e.amount.toFixed(2)}</Text>
              </Pressable>
            );
          })
        )}
        {expenses.length > 0 ? <Text style={styles.listHint}>Long-press an expense to remove it.</Text> : null}
      </ScrollView>

      <AddExpenseModal
        visible={showAdd}
        userId={user?.id}
        onClose={() => setShowAdd(false)}
        onSaved={() => { setShowAdd(false); load(); }}
      />
    </View>
  );
}

// ─────────────────────────────────────────────
// Add expense modal (manual + AI scan)
// ─────────────────────────────────────────────
function AddExpenseModal({
  visible, userId, onClose, onSaved,
}: { visible: boolean; userId?: string; onClose: () => void; onSaved: () => void }) {
  const { showAlert } = useAlert();
  const [amount, setAmount] = useState('');
  const [vendor, setVendor] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('materials');
  const [split, setSplit] = useState<ExpenseSplit>('business');
  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [needsReview, setNeedsReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);

  const reset = () => {
    setAmount(''); setVendor(''); setCategory('materials'); setSplit('business');
    setReceiptPath(null); setConfidence(null); setNeedsReview(false);
  };
  const close = () => { reset(); onClose(); };

  const handleScan = async () => {
    if (!userId) return;
    setScanning(true);
    const picked = await pickReceiptImage(userId, 'camera');
    if (picked.cancelled) { setScanning(false); return; }
    if (picked.error || !picked.base64) { setScanning(false); haptics.error(); showAlert('Could not scan', picked.error || 'Try again.'); return; }
    setReceiptPath(picked.path);
    const { data, error } = await analyzeReceipt(picked.base64);
    setScanning(false);
    if (error || !data) {
      haptics.warn();
      showAlert('Receipt attached', 'AI reading isn\'t available yet — fill the details in and save. (Set up the ai-receipt function to enable auto-fill.)');
      return;
    }
    haptics.success();
    if (data.amount != null) setAmount(String(data.amount));
    if (data.vendor) setVendor(data.vendor);
    if (data.category) setCategory(data.category);
    if (data.split) setSplit(data.split);
    setConfidence(data.confidence ?? null);
    setNeedsReview(!!data.needs_review);
  };

  const handleAttach = async () => {
    if (!userId) return;
    setBusy(true);
    const picked = await pickReceiptImage(userId, 'library');
    setBusy(false);
    if (picked.cancelled) return;
    if (picked.error || !picked.path) { haptics.error(); showAlert('Upload failed', picked.error || 'Try again.'); return; }
    setReceiptPath(picked.path);
    haptics.success();
  };

  const handleSave = async () => {
    const amt = parseFloat(amount);
    if (!userId || !amt || amt <= 0) { showAlert('Amount needed', 'Enter a valid expense amount.'); return; }
    setBusy(true);
    const { error } = await addExpense({
      user_id: userId,
      job_id: null,
      vendor: vendor.trim() || null,
      amount: amt,
      category,
      split,
      business_pct: split === 'mixed' ? 50 : null,
      confidence,
      needs_review: needsReview,
      receipt_path: receiptPath,
      note: null,
      spent_on: null,
    });
    setBusy(false);
    if (error) { haptics.error(); showAlert('Could not save', error); return; }
    haptics.success();
    reset();
    onSaved();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={styles.modalContainer}>
        <View style={styles.header}>
          <Pressable onPress={close} hitSlop={8} style={styles.iconBtn}>
            <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
          </Pressable>
          <Text style={styles.headerTitle}>Add Expense</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
          <Pressable style={styles.scanBtn} onPress={handleScan} disabled={scanning}>
            {scanning ? <ActivityIndicator size="small" color={Colors.primaryGlow} /> : <MaterialIcons name="document-scanner" size={20} color={Colors.primaryGlow} />}
            <Text style={styles.scanBtnText}>{scanning ? 'Reading receipt…' : 'Scan receipt with AI'}</Text>
          </Pressable>
          {receiptPath ? (
            <View style={styles.attachedPill}>
              <MaterialIcons name="check-circle" size={14} color={Colors.success} />
              <Text style={styles.attachedText}>Receipt attached{confidence != null ? ` · AI ${Math.round(confidence * 100)}% sure` : ''}</Text>
            </View>
          ) : (
            <Pressable style={styles.attachBtn} onPress={handleAttach} disabled={busy}>
              <MaterialIcons name="attach-file" size={16} color={Colors.textSecondary} />
              <Text style={styles.attachBtnText}>Attach from library instead</Text>
            </Pressable>
          )}

          <Text style={styles.fieldLabel}>AMOUNT (£)</Text>
          <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={Colors.textMuted} />

          <Text style={styles.fieldLabel}>VENDOR (optional)</Text>
          <TextInput style={styles.input} value={vendor} onChangeText={setVendor} placeholder="e.g. Screwfix" placeholderTextColor={Colors.textMuted} />

          <Text style={styles.fieldLabel}>CATEGORY</Text>
          <View style={styles.chips}>
            {CATEGORIES.map(c => (
              <Pressable key={c.id} style={[styles.chip, category === c.id && styles.chipActive]} onPress={() => { haptics.select(); setCategory(c.id); }}>
                <MaterialIcons name={c.icon} size={14} color={category === c.id ? Colors.textInverse : Colors.textSecondary} />
                <Text style={[styles.chipText, category === c.id && styles.chipTextActive]}>{c.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>BUSINESS / PERSONAL</Text>
          <View style={styles.splitRow}>
            {SPLITS.map(s => (
              <Pressable key={s} style={[styles.splitBtn, split === s && styles.splitBtnActive]} onPress={() => { haptics.select(); setSplit(s); }}>
                <Text style={[styles.splitText, split === s && styles.splitTextActive]}>{s[0].toUpperCase() + s.slice(1)}</Text>
              </Pressable>
            ))}
          </View>
          {split === 'mixed' ? <Text style={styles.mixedNote}>Mixed-use is estimated at 50% business — adjustable later.</Text> : null}

          <Pressable style={[styles.saveBtn, busy && { opacity: 0.5 }]} onPress={handleSave} disabled={busy}>
            {busy ? <ActivityIndicator size="small" color={Colors.textInverse} /> : <Text style={styles.saveBtnText}>Save expense</Text>}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.md, gap: 12, paddingBottom: 40 },
  modalContainer: { flex: 1, backgroundColor: Colors.bg },
  modalScroll: { padding: Spacing.md, paddingTop: Spacing.xl, gap: 12, paddingBottom: 60 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Typography.headingMD },

  summaryCard: { backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: 18, gap: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { ...Typography.labelMD, color: Colors.textSecondary },
  summaryVal: { ...Typography.dataMD },
  summaryFinal: { paddingTop: 10, marginTop: 2, borderTopWidth: 1, borderTopColor: Colors.border },
  summaryFinalLabel: { ...Typography.labelMD, fontWeight: '700' },
  summaryFinalVal: { ...Typography.dataLG, color: Colors.primaryGlow },
  reviewPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: Colors.warningDim, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  reviewPillText: { ...Typography.labelXS, color: Colors.warning },
  disclaimer: { ...Typography.labelXS, color: Colors.textMuted, lineHeight: 16 },

  addExpenseBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 50, borderRadius: Radius.lg, backgroundColor: Colors.primary,
  },
  addExpenseBtnText: { ...Typography.btnMD, color: Colors.textInverse },

  empty: { alignItems: 'center', gap: 8, paddingVertical: 50 },
  emptyTitle: { ...Typography.headingMD },
  emptySub: { ...Typography.bodySM, color: Colors.textMuted, textAlign: 'center' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: 12 },
  rowIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primaryDim, alignItems: 'center', justifyContent: 'center' },
  rowMid: { flex: 1, gap: 2 },
  rowTitle: { ...Typography.labelMD },
  rowSub: { ...Typography.labelSM, color: Colors.textMuted },
  rowAmount: { ...Typography.dataMD, color: Colors.success },
  listHint: { ...Typography.labelXS, color: Colors.textMuted, textAlign: 'center', marginTop: 4 },

  scanBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 54, borderRadius: Radius.lg, backgroundColor: Colors.primaryDim, borderWidth: 1, borderColor: Colors.primaryLight },
  scanBtnText: { ...Typography.btnMD, color: Colors.primaryGlow },
  attachBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 },
  attachBtnText: { ...Typography.labelSM, color: Colors.textSecondary },
  attachedPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 },
  attachedText: { ...Typography.labelSM, color: Colors.success },
  fieldLabel: { ...Typography.labelXS, marginTop: 4 },
  input: { backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 13, ...Typography.bodyMD, color: Colors.textPrimary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Colors.cardAlt, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { ...Typography.labelSM, color: Colors.textSecondary },
  chipTextActive: { color: Colors.textInverse, fontWeight: '600' },
  splitRow: { flexDirection: 'row', gap: 8 },
  splitBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: Radius.md, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  splitBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  splitText: { ...Typography.labelMD, color: Colors.textSecondary },
  splitTextActive: { color: Colors.textInverse, fontWeight: '600' },
  mixedNote: { ...Typography.labelXS, color: Colors.textMuted },
  saveBtn: { height: 54, borderRadius: Radius.lg, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  saveBtnText: { ...Typography.btnMD, color: Colors.textInverse },
});
