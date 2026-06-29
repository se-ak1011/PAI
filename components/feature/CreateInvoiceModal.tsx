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
import DateTimePicker from '@react-native-community/datetimepicker';
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
  const [materialsStr, setMaterialsStr] = useState('');
  const [includeVat, setIncludeVat] = useState(false);
  // Trades/categories — a job can span more than one (e.g. plumbing + tiling).
  const [categories, setCategories] = useState<string[]>([INCOME_CATEGORIES[0]]);
  const toggleCategory = (c: string) =>
    setCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  const [saving, setSaving] = useState(false);

  // Itemised tasks — each is date/location/work at hours × rate; they roll up.
  type TaskDraft = { date: Date | null; location: string; description: string; hoursStr: string; rateStr: string };
  const emptyTask = (): TaskDraft => ({ date: null, location: '', description: '', hoursStr: '', rateStr: user?.hourly_rate ? String(user.hourly_rate) : '' });
  const [tasks, setTasks] = useState<TaskDraft[]>([emptyTask()]);
  const [datePickerFor, setDatePickerFor] = useState<number | null>(null);

  const updateTask = (i: number, patch: Partial<TaskDraft>) =>
    setTasks(prev => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const addTask = () => setTasks(prev => [...prev, emptyTask()]);
  const removeTask = (i: number) => setTasks(prev => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  const taskAmount = (t: TaskDraft) => (parseFloat(t.hoursStr) || 0) * (parseFloat(t.rateStr) || 0);
  const labour = tasks.reduce((s, t) => s + taskAmount(t), 0);
  const totalHours = tasks.reduce((s, t) => s + (parseFloat(t.hoursStr) || 0), 0);
  const materials = parseFloat(materialsStr) || 0;
  const subtotal = labour + materials;
  const vat = includeVat ? Math.round(subtotal * 0.2 * 100) / 100 : 0;
  const total = subtotal + vat;

  const reset = () => {
    setCustomerName('');
    setJobTitle('');
    setDescription('');
    setMaterialsStr('');
    setIncludeVat(false);
    setCategories([INCOME_CATEGORIES[0]]);
    setSaving(false);
    setTasks([emptyTask()]);
    setDatePickerFor(null);
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
    const validTasks = tasks.filter(t => t.description.trim() && taskAmount(t) > 0);
    if (validTasks.length === 0 && materials <= 0) {
      showAlert('Required', 'Add at least one task (with hours & rate) or a materials amount.');
      return;
    }

    setSaving(true);
    const today = new Date().toISOString().split('T')[0];
    const lineItems = validTasks.map(t => ({
      date: t.date ? t.date.toISOString().split('T')[0] : null,
      location: t.location.trim() || null,
      description: t.description.trim(),
      hours: parseFloat(t.hoursStr) || 0,
      rate: parseFloat(t.rateStr) || 0,
    }));

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
        line_items: lineItems,
        trades: categories,
        scheduled_date: null,
        location: null,
        receipts: [],
        invoiced_at: today,
        paid_at: null,
        source_job_post_id: null,
        job_type: 'fixed',
        hourly_rate: null,
        estimated_hours: null,
        actual_hours: null,
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

          {/* Work — itemised tasks (date/location/work · hrs × rate) */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Work</Text>
              <Text style={styles.sectionHint}>Each task rolls up into the total</Text>
            </View>

            {tasks.map((t, i) => (
              <View key={i} style={styles.taskCard}>
                <View style={styles.taskTopRow}>
                  <Text style={styles.taskNum}>Task {i + 1}</Text>
                  {tasks.length > 1 ? (
                    <Pressable hitSlop={8} onPress={() => removeTask(i)}>
                      <MaterialIcons name="close" size={18} color={Colors.textMuted} />
                    </Pressable>
                  ) : null}
                </View>

                <TextInput
                  style={styles.input}
                  value={t.description}
                  onChangeText={(v) => updateTask(i, { description: v })}
                  placeholder="Work done — e.g. Labouring, Plumbing…"
                  placeholderTextColor={Colors.textMuted}
                />

                <View style={styles.amountRow}>
                  <Pressable style={styles.taskDateBtn} onPress={() => setDatePickerFor(i)}>
                    <MaterialIcons name="event" size={15} color={t.date ? Colors.primaryGlow : Colors.textMuted} />
                    <Text style={[styles.taskDateText, t.date && styles.taskDateTextSet]} numberOfLines={1}>
                      {t.date ? t.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Date'}
                    </Text>
                  </Pressable>
                  <TextInput
                    style={[styles.input, { flex: 1.5 }]}
                    value={t.location}
                    onChangeText={(v) => updateTask(i, { location: v })}
                    placeholder="Location"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>

                <View style={styles.amountRow}>
                  <View style={[styles.prefixInput, { flex: 1 }]}>
                    <MaterialIcons name="schedule" size={14} color={Colors.textMuted} style={{ marginRight: 4 }} />
                    <TextInput
                      style={styles.prefixInputField}
                      value={t.hoursStr}
                      onChangeText={(v) => updateTask(i, { hoursStr: v })}
                      placeholder="Hrs"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={[styles.prefixInput, { flex: 1 }]}>
                    <Text style={styles.prefix}>£</Text>
                    <TextInput
                      style={styles.prefixInputField}
                      value={t.rateStr}
                      onChangeText={(v) => updateTask(i, { rateStr: v })}
                      placeholder="Rate/hr"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={styles.taskAmountBox}>
                    <Text style={styles.taskAmountText}>£{taskAmount(t).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</Text>
                  </View>
                </View>
              </View>
            ))}

            <Pressable style={styles.addTaskBtn} onPress={addTask}>
              <MaterialIcons name="add" size={16} color={Colors.primaryGlow} />
              <Text style={styles.addTaskText}>Add task</Text>
            </Pressable>

            {datePickerFor !== null ? (
              <View>
                <DateTimePicker
                  value={tasks[datePickerFor]?.date || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={(event, date) => {
                    const idx = datePickerFor;
                    if (Platform.OS !== 'ios') setDatePickerFor(null);
                    if (event.type === 'set' && date && idx !== null) updateTask(idx, { date });
                  }}
                />
                {Platform.OS === 'ios' ? (
                  <Pressable style={styles.dateDoneBtn} onPress={() => setDatePickerFor(null)}>
                    <Text style={styles.dateDoneText}>Done</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {/* Materials */}
            <View style={styles.inputWrap}>
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
            <View style={styles.totalRow}>
              <Text style={styles.totalLineLabel}>Labour{totalHours > 0 ? ` (${totalHours} hrs)` : ''}</Text>
              <Text style={styles.totalLineValue}>£{labour.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</Text>
            </View>
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

  // Tasks
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionHint: { ...Typography.labelSM, color: Colors.textMuted },
  taskCard: {
    backgroundColor: Colors.cardAlt, borderRadius: Radius.md, borderWidth: 1,
    borderColor: Colors.border, padding: 12, gap: 10,
  },
  taskTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  taskNum: { ...Typography.labelXS, color: Colors.primaryGlow },
  taskDateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1,
    backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1,
    borderColor: Colors.border, paddingHorizontal: 12, height: 48,
  },
  taskDateText: { ...Typography.bodyMD, color: Colors.textMuted, flex: 1 },
  taskDateTextSet: { color: Colors.textPrimary },
  taskAmountBox: { flex: 1, alignItems: 'flex-end', justifyContent: 'center', height: 48 },
  taskAmountText: { ...Typography.dataMD, color: Colors.textPrimary },
  addTaskBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: Radius.md, borderWidth: 1,
    borderColor: Colors.primaryLight, backgroundColor: Colors.primaryDim,
  },
  addTaskText: { ...Typography.btnSM, color: Colors.primaryGlow },
  dateDoneBtn: { alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 8 },
  dateDoneText: { ...Typography.btnSM, color: Colors.primaryGlow },

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
