import React, { useState } from 'react';
import {
  View, Text, Modal, ScrollView, StyleSheet, Pressable,
  ActivityIndicator, TextInput, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { TRADE_CATEGORIES } from '@/constants/config';
import { useJobs } from '@/hooks/useJobs';
import { useAuth } from '@/hooks/useAuth';
import { useAlert } from '@/template';
import { generateAIQuote, AIQuoteResult } from '@/services/aiService';
import { MaterialIcons } from '@expo/vector-icons';

interface CreateJobModalProps {
  visible: boolean;
  onClose: () => void;
}

// ─── Step indicators ──────────────────────────────────────────
const STEPS = ['Describe', 'AI Review', 'Confirm'] as const;
type Step = 0 | 1 | 2;

// ─── Material row ─────────────────────────────────────────────
function MaterialRow({ item }: { item: { name: string; qty: number; unit: string; estimatedPrice: number } }) {
  return (
    <View style={styles.matRow}>
      <View style={styles.matLeft}>
        <Text style={styles.matName}>{item.name}</Text>
        <Text style={styles.matQty}>{item.qty} {item.unit}</Text>
      </View>
      <Text style={styles.matPrice}>£{item.estimatedPrice.toFixed(2)}</Text>
    </View>
  );
}

export function CreateJobModal({ visible, onClose }: CreateJobModalProps) {
  const { addPrivateJob } = useJobs();
  const { user } = useAuth();
  const { showAlert } = useAlert();

  // Step 0 — describe
  const [description, setDescription] = useState('');
  const [trade, setTrade] = useState<string>(user?.trades?.[0] ?? TRADE_CATEGORIES[0]);
  const [customer, setCustomer] = useState('');

  // Step 1 — AI result
  const [aiResult, setAiResult] = useState<AIQuoteResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Step 2 — editable confirm
  const [jobTitle, setJobTitle] = useState('');
  const [labourOverride, setLabourOverride] = useState('');
  const [materialsOverride, setMaterialsOverride] = useState('');

  const [step, setStep] = useState<Step>(0);
  const [saving, setSaving] = useState(false);

  const labourNum = parseFloat(labourOverride) || aiResult?.totalEstimate?.labourTotal || 0;
  const materialsNum = parseFloat(materialsOverride) || aiResult?.totalEstimate?.materialsTotal || 0;
  const vat = Math.round((labourNum + materialsNum) * 0.2 * 100) / 100;
  const total = labourNum + materialsNum + vat;

  const handleReset = () => {
    setStep(0);
    setDescription('');
    setCustomer('');
    setTrade(user?.trades?.[0] ?? TRADE_CATEGORIES[0]);
    setAiResult(null);
    setJobTitle('');
    setLabourOverride('');
    setMaterialsOverride('');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  // ── Step 0 → 1: Run AI ──────────────────────────────────────
  const handleRunAI = async () => {
    if (!description.trim()) return;
    setAiLoading(true);
    setStep(1);

    const { data, error } = await generateAIQuote({
      jobTitle: description.slice(0, 80),
      jobDescription: description,
      trade,
      city: user?.city,
      dayRate: user?.hourly_rate_from ?? undefined,
      hourlyRate: (user as any)?.hourly_rate ?? undefined,
      preferredShop: (user as any)?.preferred_shop ?? undefined,
      flexiblePricing: (user as any)?.flexible_pricing ?? undefined,
    });

    setAiLoading(false);

    if (error || !data) {
      showAlert('AI Error', error || 'Could not generate quote. Check your connection.');
      setStep(0);
      return;
    }

    setAiResult(data);
    // Pre-fill title from scope first sentence
    const firstLine = data.scope?.split('.')[0]?.trim();
    setJobTitle(firstLine && firstLine.length < 80 ? firstLine : description.slice(0, 60));
    setLabourOverride(data.totalEstimate.labourTotal.toFixed(2));
    setMaterialsOverride(data.totalEstimate.materialsTotal.toFixed(2));
  };

  // ── Step 2: Save job ────────────────────────────────────────
  const handleSave = async () => {
    if (!jobTitle.trim() || !user?.id) return;
    setSaving(true);
    await addPrivateJob({
      contractor_id: user.id,
      title: jobTitle,
      customer: customer || 'New Customer',
      description: aiResult?.scope || description,
      status: 'draft',
      total,
      labour: labourNum,
      materials: materialsNum,
      vat,
      materials_items: aiResult?.materials || [],
      receipts: [],
      invoiced_at: null,
      paid_at: null,
      source_job_post_id: null,
    });
    setSaving(false);
    handleClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={step > 0 && !aiLoading ? () => setStep((step - 1) as Step) : handleClose}
            hitSlop={8}
            style={styles.backBtn}
          >
            <MaterialIcons
              name={step > 0 && !aiLoading ? 'arrow-back' : 'close'}
              size={20}
              color={Colors.textSecondary}
            />
          </Pressable>
          <Text style={styles.headerTitle}>New Job</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Step progress */}
        <View style={styles.stepBar}>
          {STEPS.map((label, i) => (
            <View key={label} style={styles.stepItem}>
              <View style={[
                styles.stepDot,
                i <= step && styles.stepDotActive,
                i === step && styles.stepDotCurrent,
              ]}>
                {i < step ? (
                  <MaterialIcons name="check" size={12} color={Colors.textInverse} />
                ) : (
                  <Text style={[styles.stepNum, i <= step && styles.stepNumActive]}>{i + 1}</Text>
                )}
              </View>
              <Text style={[styles.stepLabel, i === step && styles.stepLabelActive]}>{label}</Text>
              {i < STEPS.length - 1 ? (
                <View style={[styles.stepLine, i < step && styles.stepLineActive]} />
              ) : null}
            </View>
          ))}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── STEP 0: Describe ─────────────────────────── */}
          {step === 0 ? (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Describe the job</Text>
              <Text style={styles.stepSub}>
                Keep it simple — even "replace kitchen taps in M1" works. AI handles the rest using your rates and preferred shop.
              </Text>

              {/* Description input */}
              <View style={styles.descCard}>
                <View style={styles.descLabelRow}>
                  <MaterialIcons name="edit-note" size={16} color={Colors.primaryGlow} />
                  <Text style={styles.descLabel}>JOB DESCRIPTION</Text>
                </View>
                <TextInput
                  style={styles.descInput}
                  value={description}
                  onChangeText={setDescription}
                  placeholder={`e.g. "Rewire a 3-bed house in Manchester — full rewire, new consumer unit, test and cert"`}
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                  autoFocus
                />
                {/* Voice hint */}
                <Pressable
                  style={styles.voiceHint}
                  onPress={() => showAlert('Voice Input', 'Voice-to-text uses your keyboard microphone — tap the mic icon on your keyboard to dictate.')}
                >
                  <MaterialIcons name="mic" size={16} color={Colors.textMuted} />
                  <Text style={styles.voiceHintText}>Use keyboard mic for voice input</Text>
                </Pressable>
              </View>

              {/* Customer name */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>CUSTOMER (optional)</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={customer}
                  onChangeText={setCustomer}
                  placeholder="Customer name"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              {/* Trade selector */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>TRADE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tradeRow}>
                  {TRADE_CATEGORIES.map(t => (
                    <Pressable
                      key={t}
                      style={[styles.tradeChip, trade === t && styles.tradeChipActive]}
                      onPress={() => setTrade(t)}
                    >
                      <Text style={[styles.tradeChipText, trade === t && styles.tradeChipTextActive]}>{t}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Pricing context preview */}
              {(user?.hourly_rate_from || (user as any)?.hourly_rate || (user as any)?.preferred_shop) ? (
                <View style={styles.contextCard}>
                  <View style={styles.contextHeader}>
                    <MaterialIcons name="info-outline" size={14} color={Colors.primaryGlow} />
                    <Text style={styles.contextLabel}>AI WILL USE YOUR PROFILE</Text>
                  </View>
                  <View style={styles.contextItems}>
                    {user?.hourly_rate_from ? (
                      <Text style={styles.contextItem}>
                        <Text style={styles.contextKey}>Day rate: </Text>£{user.hourly_rate_from}/day
                      </Text>
                    ) : null}
                    {(user as any)?.hourly_rate ? (
                      <Text style={styles.contextItem}>
                        <Text style={styles.contextKey}>Hourly rate: </Text>£{(user as any).hourly_rate}/hr
                      </Text>
                    ) : null}
                    {(user as any)?.preferred_shop ? (
                      <Text style={styles.contextItem}>
                        <Text style={styles.contextKey}>Shop: </Text>{(user as any).preferred_shop}
                      </Text>
                    ) : null}
                    {(user as any)?.flexible_pricing === true ? (
                      <Text style={styles.contextItem}>Flexible pricing enabled</Text>
                    ) : null}
                  </View>
                </View>
              ) : (
                <View style={styles.contextCardMuted}>
                  <MaterialIcons name="info-outline" size={14} color={Colors.textMuted} />
                  <Text style={styles.contextMutedText}>
                    Add your day rate and preferred shop to your profile for more accurate AI estimates.
                  </Text>
                </View>
              )}

              <Pressable
                style={[styles.generateBtn, !description.trim() && styles.generateBtnDisabled]}
                onPress={handleRunAI}
                disabled={!description.trim()}
              >
                <MaterialIcons name="auto-awesome" size={18} color={Colors.textInverse} />
                <Text style={styles.generateBtnText}>Generate AI Quote</Text>
              </Pressable>
            </View>
          ) : null}

          {/* ── STEP 1: AI Review ────────────────────────── */}
          {step === 1 ? (
            <View style={styles.stepContent}>
              {aiLoading ? (
                <View style={styles.aiLoadingBlock}>
                  <ActivityIndicator size="large" color={Colors.primaryGlow} />
                  <Text style={styles.aiLoadingTitle}>AI is building your quote...</Text>
                  <Text style={styles.aiLoadingSub}>
                    Analysing job, matching your rates{(user as any)?.preferred_shop ? ` and ${(user as any).preferred_shop} pricing` : ''}
                  </Text>
                </View>
              ) : aiResult ? (
                <>
                  <Text style={styles.stepTitle}>AI Quote Generated</Text>

                  {/* Scope */}
                  <View style={styles.aiBlock}>
                    <View style={styles.aiBlockHeader}>
                      <MaterialIcons name="description" size={15} color={Colors.primaryGlow} />
                      <Text style={styles.aiBlockLabel}>SCOPE OF WORK</Text>
                    </View>
                    <Text style={styles.aiScopeText}>{aiResult.scope}</Text>
                  </View>

                  {/* Materials */}
                  <View style={styles.aiBlock}>
                    <View style={styles.aiBlockHeader}>
                      <MaterialIcons name="inventory-2" size={15} color={Colors.primaryGlow} />
                      <Text style={styles.aiBlockLabel}>MATERIALS ({aiResult.materials.length} items)</Text>
                    </View>
                    {aiResult.materials.map((m, i) => <MaterialRow key={i} item={m} />)}
                    <View style={styles.matTotal}>
                      <Text style={styles.matTotalLabel}>Materials total</Text>
                      <Text style={styles.matTotalVal}>£{aiResult.totalEstimate.materialsTotal.toFixed(2)}</Text>
                    </View>
                  </View>

                  {/* Labour */}
                  <View style={styles.aiBlock}>
                    <View style={styles.aiBlockHeader}>
                      <MaterialIcons name="engineering" size={15} color={Colors.primaryGlow} />
                      <Text style={styles.aiBlockLabel}>LABOUR ESTIMATE</Text>
                    </View>
                    <View style={styles.labourRow}>
                      <Text style={styles.labourItem}>{aiResult.labourEstimate.days} day{aiResult.labourEstimate.days !== 1 ? 's' : ''}</Text>
                      <Text style={styles.labourItem}>@ £{aiResult.labourEstimate.dayRateFrom}/day</Text>
                      <Text style={styles.labourTotal}>£{aiResult.totalEstimate.labourTotal.toFixed(2)}</Text>
                    </View>
                  </View>

                  {/* Notes */}
                  {aiResult.notes ? (
                    <View style={styles.notesBlock}>
                      <MaterialIcons name="warning-amber" size={14} color={Colors.warning} />
                      <Text style={styles.notesText}>{aiResult.notes}</Text>
                    </View>
                  ) : null}

                  {/* Grand total preview */}
                  <View style={styles.grandTotal}>
                    <View style={styles.grandTotalRow}>
                      <Text style={styles.grandTotalLabel}>Materials</Text>
                      <Text style={styles.grandTotalVal}>£{aiResult.totalEstimate.materialsTotal.toFixed(2)}</Text>
                    </View>
                    <View style={styles.grandTotalRow}>
                      <Text style={styles.grandTotalLabel}>Labour</Text>
                      <Text style={styles.grandTotalVal}>£{aiResult.totalEstimate.labourTotal.toFixed(2)}</Text>
                    </View>
                    <View style={styles.grandTotalRow}>
                      <Text style={styles.grandTotalLabel}>VAT (20%)</Text>
                      <Text style={styles.grandTotalVal}>£{(aiResult.totalEstimate.grandTotal * 0.2 / 1.2).toFixed(2)}</Text>
                    </View>
                    <View style={[styles.grandTotalRow, styles.grandTotalFinal]}>
                      <Text style={styles.grandTotalFinalLabel}>TOTAL</Text>
                      <Text style={styles.grandTotalFinalVal}>£{(aiResult.totalEstimate.grandTotal).toFixed(2)}</Text>
                    </View>
                  </View>

                  <Pressable style={styles.generateBtn} onPress={() => setStep(2)}>
                    <Text style={styles.generateBtnText}>Use This Quote</Text>
                    <MaterialIcons name="arrow-forward" size={18} color={Colors.textInverse} />
                  </Pressable>
                  <Pressable style={styles.regenerateBtn} onPress={() => { setStep(0); setAiResult(null); }}>
                    <MaterialIcons name="refresh" size={16} color={Colors.textSecondary} />
                    <Text style={styles.regenerateBtnText}>Edit description & regenerate</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          ) : null}

          {/* ── STEP 2: Confirm & Save ───────────────────── */}
          {step === 2 ? (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Confirm job</Text>
              <Text style={styles.stepSub}>Review and adjust before saving.</Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>JOB TITLE</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={jobTitle}
                  onChangeText={setJobTitle}
                  placeholder="Job title"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>CUSTOMER</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={customer}
                  onChangeText={setCustomer}
                  placeholder="Customer name"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              <View style={styles.twoCol}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>LABOUR (£)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={labourOverride}
                    onChangeText={setLabourOverride}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>MATERIALS (£)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={materialsOverride}
                    onChangeText={setMaterialsOverride}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
              </View>

              {/* Summary */}
              <View style={styles.finalSummary}>
                <View style={styles.grandTotalRow}>
                  <Text style={styles.grandTotalLabel}>Subtotal</Text>
                  <Text style={styles.grandTotalVal}>£{(labourNum + materialsNum).toFixed(2)}</Text>
                </View>
                <View style={styles.grandTotalRow}>
                  <Text style={styles.grandTotalLabel}>VAT (20%)</Text>
                  <Text style={styles.grandTotalVal}>£{vat.toFixed(2)}</Text>
                </View>
                <View style={[styles.grandTotalRow, styles.grandTotalFinal]}>
                  <Text style={styles.grandTotalFinalLabel}>TOTAL</Text>
                  <Text style={styles.grandTotalFinalVal}>£{total.toFixed(2)}</Text>
                </View>
              </View>

              <Pressable
                style={[styles.generateBtn, (!jobTitle.trim() || saving) && styles.generateBtnDisabled]}
                onPress={handleSave}
                disabled={!jobTitle.trim() || saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={Colors.textInverse} />
                ) : (
                  <>
                    <MaterialIcons name="check" size={18} color={Colors.textInverse} />
                    <Text style={styles.generateBtnText}>Save Job</Text>
                  </>
                )}
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { ...Typography.headingMD },

  // Step bar
  stepBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, paddingHorizontal: Spacing.md, gap: 0,
  },
  stepItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepDot: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  stepDotCurrent: { borderColor: Colors.primaryGlow },
  stepNum: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  stepNumActive: { color: Colors.textInverse },
  stepLabel: { ...Typography.labelXS, color: Colors.textMuted },
  stepLabelActive: { color: Colors.textPrimary },
  stepLine: { width: 28, height: 1.5, backgroundColor: Colors.border, marginHorizontal: 4 },
  stepLineActive: { backgroundColor: Colors.primary },

  // Scroll
  scroll: { padding: Spacing.md, paddingBottom: 60 },
  stepContent: { gap: 18 },
  stepTitle: { ...Typography.headingMD },
  stepSub: { ...Typography.bodyMD, color: Colors.textSecondary, lineHeight: 22 },

  // Description input
  descCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 10,
  },
  descLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  descLabel: { ...Typography.labelXS, color: Colors.primaryGlow },
  descInput: {
    ...Typography.bodyMD, color: Colors.textPrimary,
    minHeight: 120, textAlignVertical: 'top',
  },
  voiceHint: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  voiceHintText: { ...Typography.labelSM, color: Colors.textMuted },

  // Fields
  fieldGroup: { gap: 8 },
  fieldLabel: { ...Typography.labelXS },
  fieldInput: {
    backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1,
    borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 13,
    ...Typography.bodyMD, color: Colors.textPrimary,
  },
  twoCol: { flexDirection: 'row', gap: 12 },

  // Trade chips
  tradeRow: { gap: 8, paddingVertical: 2 },
  tradeChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill,
    backgroundColor: Colors.cardAlt, borderWidth: 1, borderColor: Colors.border,
  },
  tradeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tradeChipText: { ...Typography.labelMD, color: Colors.textSecondary },
  tradeChipTextActive: { color: Colors.textInverse, fontWeight: '600' },

  // Context card
  contextCard: {
    backgroundColor: Colors.primaryDim, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.primaryLight, padding: 14, gap: 8,
  },
  contextHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  contextLabel: { ...Typography.labelXS, color: Colors.primaryGlow },
  contextItems: { gap: 4 },
  contextItem: { ...Typography.labelMD, color: Colors.textSecondary },
  contextKey: { color: Colors.textPrimary, fontWeight: '600' },
  contextCardMuted: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.cardAlt, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: 12,
  },
  contextMutedText: { ...Typography.labelSM, color: Colors.textMuted, flex: 1, lineHeight: 18 },

  // Generate button
  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Colors.primary, borderRadius: Radius.lg, height: 54,
  },
  generateBtnDisabled: { opacity: 0.45 },
  generateBtnText: { ...Typography.btnMD, color: Colors.textInverse },
  regenerateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: 14,
  },
  regenerateBtnText: { ...Typography.labelMD, color: Colors.textSecondary },

  // AI loading
  aiLoadingBlock: { alignItems: 'center', paddingVertical: 60, gap: 18 },
  aiLoadingTitle: { ...Typography.headingMD },
  aiLoadingSub: { ...Typography.bodyMD, color: Colors.textSecondary, textAlign: 'center' },

  // AI result blocks
  aiBlock: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 10,
  },
  aiBlockHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aiBlockLabel: { ...Typography.labelXS, color: Colors.primaryGlow },
  aiScopeText: { ...Typography.bodyMD, color: Colors.textSecondary, lineHeight: 22 },

  // Material rows
  matRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  matLeft: { flex: 1, gap: 2 },
  matName: { ...Typography.labelMD },
  matQty: { ...Typography.labelSM, color: Colors.textMuted },
  matPrice: { ...Typography.dataMD, color: Colors.textPrimary },
  matTotal: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingTop: 10, marginTop: 2,
  },
  matTotalLabel: { ...Typography.labelMD, color: Colors.textSecondary },
  matTotalVal: { ...Typography.dataMD },

  // Labour
  labourRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.cardAlt, borderRadius: Radius.md, padding: 12,
  },
  labourItem: { ...Typography.labelMD, color: Colors.textSecondary },
  labourTotal: { ...Typography.dataMD },

  // Notes
  notesBlock: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: Colors.card, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.warning + '44', padding: 12,
  },
  notesText: { ...Typography.labelSM, color: Colors.textSecondary, flex: 1, lineHeight: 18 },

  // Grand total
  grandTotal: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 8,
  },
  grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  grandTotalLabel: { ...Typography.labelMD, color: Colors.textSecondary },
  grandTotalVal: { ...Typography.labelMD },
  grandTotalFinal: {
    paddingTop: 10, marginTop: 4,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  grandTotalFinalLabel: { ...Typography.labelMD, fontWeight: '700' },
  grandTotalFinalVal: { ...Typography.dataLG, color: Colors.success },
  finalSummary: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 8,
  },
});
