import React, { useState } from 'react';
import { View, Text, Modal, ScrollView, StyleSheet, Pressable, TouchableOpacity } from 'react-native';
import { PButton } from '@/components/ui/PButton';
import { PInput } from '@/components/ui/PInput';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { INCOME_CATEGORIES } from '@/constants/config';
import { useTaxPot } from '@/hooks/useTaxPot';
import { useAuth } from '@/hooks/useAuth';
import { MaterialIcons } from '@expo/vector-icons';

interface AddIncomeModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AddIncomeModal({ visible, onClose }: AddIncomeModalProps) {
  const { addManualIncome, taxRate } = useTaxPot();
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [category, setCategory] = useState(INCOME_CATEGORIES[0]);
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid'>('paid');
  const [loading, setLoading] = useState(false);

  const parsedAmount = parseFloat(amount) || 0;
  const taxSetAside = Math.round(parsedAmount * (taxRate / 100) * 100) / 100;

  const handleSubmit = async () => {
    if (!parsedAmount || parsedAmount <= 0) return;
    setLoading(true);
    await addManualIncome({
      contractor_id: user?.id || '',
      amount: parsedAmount,
      date: new Date().toISOString().split('T')[0],
      customer_name: customerName || null,
      category,
      payment_status: paymentStatus,
      tax_rate: taxRate,
      source: 'manual',
    });
    setAmount('');
    setCustomerName('');
    setCategory(INCOME_CATEGORIES[0]);
    setPaymentStatus('paid');
    setLoading(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Log Manual Income</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <PInput
              label="Amount"
              prefix="£"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
            />

            {parsedAmount > 0 ? (
              <View style={styles.taxPreview}>
                <Text style={styles.taxPreviewLabel}>TAX SET-ASIDE ({taxRate}%)</Text>
                <Text style={styles.taxPreviewValue}>£{taxSetAside.toFixed(2)}</Text>
                <Text style={styles.taxPreviewNet}>Net: £{(parsedAmount - taxSetAside).toFixed(2)}</Text>
              </View>
            ) : null}

            <PInput
              label="Customer Name (optional)"
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="Client or company name"
            />

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>CATEGORY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                <View style={styles.chips}>
                  {INCOME_CATEGORIES.map(cat => (
                    <Pressable
                      key={cat}
                      style={[styles.chip, category === cat && styles.chipActive]}
                      onPress={() => setCategory(cat)}
                    >
                      <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>{cat}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>PAYMENT STATUS</Text>
              <View style={styles.statusRow}>
                {(['paid', 'unpaid'] as const).map(s => (
                  <Pressable
                    key={s}
                    style={[styles.statusBtn, paymentStatus === s && styles.statusBtnActive]}
                    onPress={() => setPaymentStatus(s)}
                  >
                    <Text style={[styles.statusBtnText, paymentStatus === s && styles.statusBtnTextActive]}>
                      {s.toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <PButton label="Log Income" onPress={handleSubmit} loading={loading} fullWidth style={styles.submitBtn} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { ...Typography.headingMD },
  content: { padding: Spacing.md, gap: 20, paddingBottom: 40 },
  taxPreview: {
    backgroundColor: Colors.primaryDim,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    padding: 14,
  },
  taxPreviewLabel: { ...Typography.labelXS, color: Colors.primaryLight, marginBottom: 4 },
  taxPreviewValue: { ...Typography.dataXL, color: Colors.primaryGlow },
  taxPreviewNet: { ...Typography.labelSM, color: Colors.textSecondary, marginTop: 2 },
  fieldGroup: { gap: 10 },
  fieldLabel: { ...Typography.labelXS, color: Colors.textMuted },
  chipScroll: { marginHorizontal: -2 },
  chips: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.cardAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: { ...Typography.labelSM, color: Colors.textSecondary },
  chipTextActive: { color: Colors.textInverse, fontWeight: '600' },
  statusRow: { flexDirection: 'row', gap: 10 },
  statusBtn: {
    flex: 1,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.cardAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  statusBtnText: { ...Typography.btnSM, color: Colors.textSecondary },
  statusBtnTextActive: { color: Colors.textInverse },
  submitBtn: { marginTop: 8 },
});
