import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, Pressable,
  TextInput, KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { useJobs } from '@/hooks/useJobs';
import { useAuth } from '@/hooks/useAuth';
import { useAlert } from '@/template/ui';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { INCOME_CATEGORIES } from '@/constants/config';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function CreateInvoiceModal({ visible, onClose }: Props) {
  const { addPrivateJob } = useJobs();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();

  const [customerName, setCustomerName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [description, setDescription] = useState('');
  const [labourStr, setLabourStr] = useState('');
  const [materialsStr, setMaterialsStr] = useState('');
  const [includeVat, setIncludeVat] = useState(false);
  // Trades/categories — a job can span more than one (e.g. plumbing + tiling).
  const [categories, setCategories] = useState<string[]>([INCOME_CATEGORIES[0]]);
  const toggleCategory = (c: string) =>
    setCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  const [saving, setSaving] = useState(false);
  // Hourly fields
  const [jobType, setJobType] = useState<'fixed' | 'hourly'>('fixed');
  const [hourlyRateStr, setHourlyRateStr] = useState('');
  const [actualHoursStr, setActualHoursStr] = useState('');

  const hourlyRate = parseFloat(hourlyRateStr) || 0;
  const actualHours = parseFloat(actualHoursStr) || 0;
  const labour = jobType === 'hourly'
    ? hourlyRate * actualHours
    : parseFloat(labourStr) || 0;
  const materials = parseFloat(materialsStr) || 0;
  const subtotal = labour + materials;
  const vat = includeVat ? Math.round(subtotal * 0.2 * 100) / 100 : 0;
  const total = subtotal + vat;

  const reset = () => {
    setCustomerName('');
    setJobTitle('');
    setDescription('');
    setLabourStr('');
    setMaterialsStr('');
    setIncludeVat(false);
    setCategories([INCOME_CATEGORIES[0]]);
    setSaving(false);
    setJobType('fixed');
    setHourlyRateStr('');
    setActualHoursStr('');
  };

  const handleCreate = async () => {
    if (!customerName.trim()) {
      showAlert('Required', 'Please enter a customer name.');
      return;
    }
    if (!jobTitle.trim()) {
      showAlert('Required', 'Please enter a job title.');
      return;
    }
    if (jobType === 'hourly') {
      if (hourlyRate <= 0) { showAlert('Required', 'Please enter a valid hourly rate.'); return; }
      if (actualHours <= 0) { showAlert('Required', 'Please enter the actual hours worked.'); return; }
    } else if (labour <= 0 && materials <= 0) {
      showAlert('Required', 'Enter at least a labour or materials amount.');
      return;
    }

    setSaving(true);
    const today = new Date().toISOString().split('T')[0];

    try {
      await addPrivateJob({
        contractor_id: user?.id || '',
        title: jobTitle.trim(),
        customer: customerName.trim(),
        description: description.trim(),
        status: 'invoiced',
        total,
        labour,
        materials,
        vat,
        materials_items: [],
        trades: categories,
        scheduled_date: null,
        location: null,
        receipts: [],
        invoiced_at: today,
        paid_at: null,
        source_job_post_id: null,
        job_type: jobType,
        hourly_rate: jobType === 'hourly' ? hourlyRate : null,
        estimated_hours: jobType === 'hourly' ? actualHours : null,
        actual_hours: jobType === 'hourly' ? actualHours : null,
      });
    } catch (e: any) {
      // Real save failure — tell the user instead of faking success.
      setSaving(false);
      showAlert('Could not save invoice', e?.message || 'Something went wrong saving the invoice. Please try again.');
      return;
    }

    setSaving(false);
    reset();
    onClose();
    // Give context a tick to update then navigate
    setTimeout(() => {
      showAlert('Invoice Created', 'The invoice has been saved. Open it to share or mark as paid.');
    }, 300);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleClose} hitSlop={8}>
            <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Create Invoice</Text>
            <Text style={styles.headerSub}>For work done outside PAI</Text>
          </View>
          <Pressable
            style={[styles.createBtn, saving && styles.createBtnDisabled]}
            onPress={handleCreate}
            disabled={saving}
          >
            <Text style={styles.createBtnText}>{saving ? 'Saving...' : 'Create'}</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Info banner */}
          <View style={styles.infoBanner}>
            <MaterialIcons name="info-outline" size={15} color={Colors.primaryGlow} />
            <Text style={styles.infoText}>
              Creates a PAI invoice immediately. Once paid (outside PAI), mark it as paid to register income in your Tax Pot.
            </Text>
          </View>

          {/* Job type toggle */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Invoice Type</Text>
            <View style={styles.jobTypeRow}>
              <Pressable
                style={[styles.jobTypeBtn, jobType === 'fixed' && styles.jobTypeBtnActive]}
                onPress={() => setJobType('fixed')}
              >
                <MaterialIcons name="receipt-long" size={16} color={jobType === 'fixed' ? Colors.textInverse : Colors.textSecondary} />
                <View>
                  <Text style={[styles.jobTypeBtnLabel, jobType === 'fixed' && styles.jobTypeBtnLabelActive]}>Fixed Price</Text>
                  <Text style={[styles.jobTypeBtnSub, jobType === 'fixed' && styles.jobTypeBtnSubActive]}>Agreed quote</Text>
                </View>
              </Pressable>
              <Pressable
                style={[styles.jobTypeBtn, jobType === 'hourly' && styles.jobTypeBtnActive]}
                onPress={() => setJobType('hourly')}
              >
                <MaterialIcons name="schedule" size={16} color={jobType === 'hourly' ? Colors.textInverse : Colors.textSecondary} />
                <View>
                  <Text style={[styles.jobTypeBtnLabel, jobType === 'hourly' && styles.jobTypeBtnLabelActive]}>Hourly Rate</Text>
                  <Text style={[styles.jobTypeBtnSub, jobType === 'hourly' && styles.jobTypeBtnSubActive]}>Time & materials</Text>
                </View>
              </Pressable>
            </View>
          </View>

          {/* Customer */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bill To</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>Customer / Company Name *</Text>
              <TextInput
                style={styles.input}
                value={customerName}
                onChangeText={setCustomerName}
                placeholder="e.g. John Smith"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Job details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Job Details</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>Invoice Title *</Text>
              <TextInput
                style={styles.input}
                value={jobTitle}
                onChangeText={setJobTitle}
                placeholder="e.g. Kitchen refit — labour & materials"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="sentences"
              />
            </View>
            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>Description (optional)</Text>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                value={description}
                onChangeText={setDescription}
                placeholder="Scope of work, notes for the customer..."
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* Trade(s) — multi-select, a job can span trades */}
            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>Trade(s) — select all that apply</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
                {INCOME_CATEGORIES.map(cat => (
                  <Pressable
                    key={cat}
                    style={[styles.categoryChip, categories.includes(cat) && styles.categoryChipActive]}
                    onPress={() => toggleCategory(cat)}
                  >
                    <Text style={[styles.categoryText, categories.includes(cat) && styles.categoryTextActive]}>{cat}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>

          {/* Amounts */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Amounts</Text>

            {jobType === 'hourly' ? (
              <>
                <View style={styles.amountRow}>
                  <View style={[styles.inputWrap, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Hourly Rate (£/hr)</Text>
                    <View style={styles.prefixInput}>
                      <Text style={styles.prefix}>£</Text>
                      <TextInput
                        style={styles.prefixInputField}
                        value={hourlyRateStr}
                        onChangeText={setHourlyRateStr}
                        placeholder="45"
                        placeholderTextColor={Colors.textMuted}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                  <View style={[styles.inputWrap, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Actual Hours</Text>
                    <View style={styles.prefixInput}>
                      <MaterialIcons name="schedule" size={14} color={Colors.textMuted} style={{ marginRight: 4 }} />
                      <TextInput
                        style={styles.prefixInputField}
                        value={actualHoursStr}
                        onChangeText={setActualHoursStr}
                        placeholder="8"
                        placeholderTextColor={Colors.textMuted}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                </View>
                <View style={[styles.inputWrap]}>
                  <Text style={styles.inputLabel}>Materials (£)</Text>
                  <View style={styles.prefixInput}>
                    <Text style={styles.prefix}>£</Text>
                    <TextInput
                      style={styles.prefixInputField}
                      value={materialsStr}
                      onChangeText={setMaterialsStr}
                      placeholder="0.00"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.amountRow}>
                <View style={[styles.inputWrap, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Labour (£)</Text>
                  <View style={styles.prefixInput}>
                    <Text style={styles.prefix}>£</Text>
                    <TextInput
                      style={styles.prefixInputField}
                      value={labourStr}
                      onChangeText={setLabourStr}
                      placeholder="0.00"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
                <View style={[styles.inputWrap, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Materials (£)</Text>
                  <View style={styles.prefixInput}>
                    <Text style={styles.prefix}>£</Text>
                    <TextInput
                      style={styles.prefixInputField}
                      value={materialsStr}
                      onChangeText={setMaterialsStr}
                      placeholder="0.00"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
              </View>
            )}

            {/* VAT toggle */}
            <View style={styles.vatRow}>
              <View style={styles.vatLeft}>
                <Text style={styles.vatLabel}>Include VAT (20%)</Text>
                <Text style={styles.vatSub}>Only if you are VAT registered</Text>
              </View>
              <Switch
                value={includeVat}
                onValueChange={setIncludeVat}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor={includeVat ? Colors.primaryGlow : Colors.textMuted}
              />
            </View>
          </View>

          {/* Totals summary */}
          <View style={styles.totalCard}>
            {jobType === 'hourly' && hourlyRate > 0 && actualHours > 0 ? (
              <View style={styles.totalRow}>
                <Text style={styles.totalLineLabel}>Labour ({actualHours} hrs × £{hourlyRate}/hr)</Text>
                <Text style={styles.totalLineValue}>£{labour.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</Text>
              </View>
            ) : (
              <View style={styles.totalRow}>
                <Text style={styles.totalLineLabel}>Labour</Text>
                <Text style={styles.totalLineValue}>£{labour.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</Text>
              </View>
            )}
            <View style={styles.totalRow}>
              <Text style={styles.totalLineLabel}>Materials</Text>
              <Text style={styles.totalLineValue}>£{materials.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</Text>
            </View>
            {includeVat ? (
              <View style={styles.totalRow}>
                <Text style={styles.totalLineLabel}>VAT (20%)</Text>
                <Text style={styles.totalLineValue}>£{vat.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</Text>
              </View>
            ) : null}
            <View style={styles.totalDivider} />
            <View style={styles.totalRow}>
              <Text style={styles.grandLabel}>TOTAL DUE</Text>
              <Text style={styles.grandValue}>£{total.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</Text>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerCenter: { flex: 1, gap: 2 },
  headerTitle: { ...Typography.headingMD },
  headerSub: { ...Typography.labelSM, color: Colors.textMuted },
  createBtn: {
    paddingHorizontal: 18, paddingVertical: 9,
    backgroundColor: Colors.primary, borderRadius: Radius.md,
  },
  createBtnDisabled: { opacity: 0.5 },
  createBtnText: { ...Typography.btnSM, color: Colors.textInverse },

  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.md, gap: Spacing.md },

  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.primaryDim, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.primaryLight, padding: 12,
  },
  infoText: { ...Typography.labelSM, color: Colors.primaryGlow, flex: 1, lineHeight: 18 },

  section: { gap: 12 },
  sectionTitle: { ...Typography.headingMD },

  inputWrap: { gap: 6 },
  inputLabel: { ...Typography.labelSM, color: Colors.textSecondary },
  input: {
    backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1,
    borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12,
    ...Typography.bodyMD, color: Colors.textPrimary,
  },
  inputMulti: { minHeight: 80, paddingTop: 12 },

  categoryRow: { flexGrow: 0 },
  categoryChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.pill,
    backgroundColor: Colors.cardAlt, borderWidth: 1, borderColor: Colors.border,
    marginRight: 8,
  },
  categoryChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  categoryText: { ...Typography.labelMD, color: Colors.textSecondary },
  categoryTextActive: { color: Colors.textInverse, fontWeight: '600' },

  amountRow: { flexDirection: 'row', gap: 12 },
  prefixInput: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1,
    borderColor: Colors.border, paddingHorizontal: 12, height: 48,
  },
  prefix: { ...Typography.bodyMD, color: Colors.textMuted, marginRight: 4 },
  prefixInputField: { flex: 1, ...Typography.bodyMD, color: Colors.textPrimary },

  vatRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1,
    borderColor: Colors.border, padding: 14,
  },
  vatLeft: { gap: 3 },
  vatLabel: { ...Typography.labelMD },
  vatSub: { ...Typography.labelSM, color: Colors.textMuted },

  totalCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1,
    borderColor: Colors.border, padding: 16, gap: 10,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLineLabel: { ...Typography.labelMD, color: Colors.textSecondary, flex: 1, marginRight: 8 },
  totalLineValue: { ...Typography.dataMD },
  totalDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 2 },
  grandLabel: { ...Typography.labelMD, fontWeight: '700' },
  grandValue: { fontSize: 22, fontWeight: '800', color: Colors.primaryGlow },

  // Job type toggle
  jobTypeRow: { flexDirection: 'row', gap: 10 },
  jobTypeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.card, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.border,
    padding: 12,
  },
  jobTypeBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  jobTypeBtnLabel: { ...Typography.labelMD, color: Colors.textSecondary, fontWeight: '600' },
  jobTypeBtnLabelActive: { color: Colors.textInverse },
  jobTypeBtnSub: { ...Typography.labelSM, color: Colors.textMuted, fontSize: 10 },
  jobTypeBtnSubActive: { color: Colors.textInverse + 'CC' },
});
