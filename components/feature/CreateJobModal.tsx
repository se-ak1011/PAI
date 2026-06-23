import React, { useState } from 'react';
import {
  View, Text, Modal, ScrollView, StyleSheet, Pressable,
  ActivityIndicator, TextInput, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { TRADE_CATEGORIES, PLATFORM_PRINCIPLES } from '@/constants/config';
import { useJobs } from '@/hooks/useJobs';
import { useAuth } from '@/hooks/useAuth';
import { useAlert } from '@/template/ui';
import { generateAIQuote, AIQuoteResult } from '@/services/aiService';
import { haptics } from '@/lib/haptics';
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
  // Multiple trades — a job can span trades (e.g. painting + flooring + tiling).
  const [trades, setTrades] = useState<string[]>(user?.trades?.[0] ? [user.trades[0]] : [TRADE_CATEGORIES[0]]);
  const toggleTrade = (t: string) =>
    setTrades(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  const [customer, setCustomer] = useState('');
  // Job location — the job isn't always where the contractor is based. Pre-filled
  // with their base city as a hint, but editable per job (and used verbatim by AI).
  const [location, setLocation] = useState(user?.city ?? '');
  const [jobType, setJobType] = useState<'fixed' | 'hourly'>('fixed');

  // Step 1 — AI result
  const [aiResult, setAiResult] = useState<AIQuoteResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Step 2 — editable confirm
  const [jobTitle, setJobTitle] = useState('');
  const [labourOverride, setLabourOverride] = useState('');
  const [materialsOverride, setMaterialsOverride] = useState('');
  // Hourly fields
  const [hourlyRateStr, setHourlyRateStr] = useState('');
  const [estimatedHoursStr, setEstimatedHoursStr] = useState('');

  const [step, setStep] = useState<Step>(0);
  const [saving, setSaving] = useState(false);
  // Manual mode: skip the AI quote and enter job details by hand.
  const [manualMode, setManualMode] = useState(false);

  const hourlyRate = parseFloat(hourlyRateStr) || 0;
  const estimatedHours = parseFloat(estimatedHoursStr) || 0;
  const labourNum = jobType === 'hourly'
    ? hourlyRate * estimatedHours
    : parseFloat(labourOverride) || aiResult?.totalEstimate?.labourTotal || 0;
  const materialsNum = parseFloat(materialsOverride) || aiResult?.totalEstimate?.materialsTotal || 0;
  const vat = Math.round((labourNum + materialsNum) * 0.2 * 100) / 100;
  const total = labourNum + materialsNum + vat;

  const handleReset = () => {
    setStep(0);
    setDescription('');
    setCustomer('');
    setLocation(user?.city ?? '');
    setTrades(user?.trades?.[0] ? [user.trades[0]] : [TRADE_CATEGORIES[0]]);
    setJobType('fixed');
    setAiResult(null);
    setManualMode(false);
    setJobTitle('');
    setLabourOverride('');
    setMaterialsOverride('');
    setHourlyRateStr('');
    setEstimatedHoursStr('');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  // ── Skip AI: jump straight to the manual Confirm step ───────
  const handleManualEntry = () => {
    setManualMode(true);
    setAiResult(null);
    if (!jobTitle && description.trim()) {
      setJobTitle(description.trim().slice(0, 60));
    }
    setStep(2);
  };

  // Back button: manual mode skips the AI Review step (1 → 0).
  const handleBack = () => {
    if (step === 0) return handleClose();
    if (manualMode) return setStep(0);
    setStep((step - 1) as Step);
  };

  // Step bar adapts: AI flow has 3 steps, manual flow has 2.
  const visibleSteps = manualMode ? (['Describe', 'Confirm'] as const) : STEPS;
  const currentIndex = manualMode ? (step === 0 ? 0 : 1) : step;

  // ── Step 0 → 1: Run AI ──────────────────────────────────────
  const handleRunAI = async () => {
    if (!description.trim()) return;
    setManualMode(false);
    setAiLoading(true);
    setStep(1);

    const { data, error } = await generateAIQuote({
      jobTitle: description.slice(0, 80),
      jobDescription: description,
      trade: trades.join(', ') || undefined,
      city: location.trim() || undefined,
      dayRate: user?.hourly_rate_from ?? undefined,
      hourlyRate: (user as any)?.hourly_rate ?? undefined,
      preferredShop: (user as any)?.preferred_shop ?? undefined,
      flexiblePricing: (user as any)?.flexible_pricing ?? undefined,
    });

    setAiLoading(false);

    if (error || !data) {
      haptics.error();
      showAlert('AI Error', error || 'Could not generate quote. Check your connection.');
      setStep(0);
      return;
    }

    haptics.success();
    setAiResult(data);
    // Pre-fill title from scope first sentence
    const firstLine = data.scope?.split('.')[0]?.trim();
    setJobTitle(firstLine && firstLine.length < 80 ? firstLine : description.slice(0, 60));
    if (jobType === 'hourly') {
      // Pre-fill estimated hours from AI labour days (×8 hrs/day), rate from profile
      const aiDays = data.labourEstimate?.days ?? 1;
      setEstimatedHoursStr((aiDays * 8).toFixed(0));
      if (user?.hourly_rate) {
        setHourlyRateStr(String(user.hourly_rate));
      }
      setMaterialsOverride(data.totalEstimate.materialsTotal.toFixed(2));
    } else {
      setLabourOverride(data.totalEstimate.labourTotal.toFixed(2));
      setMaterialsOverride(data.totalEstimate.materialsTotal.toFixed(2));
    }
  };

  // ── Step 2: Save job ────────────────────────────────────────
  const handleSave = async () => {
    if (!jobTitle.trim() || !user?.id) return;

    // Validate AI output before persisting — never insert malformed data
    const safeLabour = typeof labourNum === 'number' && isFinite(labourNum) && labourNum >= 0 ? labourNum : 0;
    const safeMaterials = typeof materialsNum === 'number' && isFinite(materialsNum) && materialsNum >= 0 ? materialsNum : 0;
    const safeVat = Math.round((safeLabour + safeMaterials) * 0.2 * 100) / 100;
    const safeTotal = safeLabour + safeMaterials + safeVat;
    const safeMaterialItems = (aiResult?.materials || []).filter(
      (m): m is { name: string; qty: number; unit: string; estimatedPrice: number } =>
        typeof m.name === 'string' && m.name.length > 0 &&
        typeof m.qty === 'number' && isFinite(m.qty) && m.qty > 0 &&
        typeof m.estimatedPrice === 'number' && isFinite(m.estimatedPrice)
    );

    // Hourly validation
    if (jobType === 'hourly' && (hourlyRate <= 0 || estimatedHours <= 0)) {
      showAlert('Required', 'Please enter a valid hourly rate and estimated hours.');
      setSaving(false);
      return;
    }

    setSaving(true);
    try {
      await addPrivateJob({
        contractor_id: user.id,
        title: jobTitle.trim().slice(0, 200),
        customer: (customer || 'New Customer').trim().slice(0, 100),
        description: (aiResult?.scope || description).trim().slice(0, 5000),
        status: 'draft',
        total: safeTotal,
        labour: safeLabour,
        materials: safeMaterials,
        vat: safeVat,
        materials_items: safeMaterialItems.map(m => ({ name: m.name, qty: m.qty, price: m.estimatedPrice, unit: m.unit })),
        receipts: [],
        invoiced_at: null,
        paid_at: null,
        source_job_post_id: null,
        job_type: jobType,
        hourly_rate: jobType === 'hourly' ? hourlyRate : null,
        estimated_hours: jobType === 'hourly' ? estimatedHours : null,
        actual_hours: null,
      });
    } catch (e: any) {
      // Surface the real failure instead of closing as if it saved.
      setSaving(false);
      haptics.error();
      showAlert('Could not save job', e?.message || 'Something went wrong saving the job. Please try again.');
      return;
    }
    setSaving(false);
    haptics.success();
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
            onPress={aiLoading ? undefined : handleBack}
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
          {visibleSteps.map((label, i) => (
            <View key={label} style={styles.stepItem}>
              <View style={[
                styles.stepDot,
                i <= currentIndex && styles.stepDotActive,
                i === currentIndex && styles.stepDotCurrent,
              ]}>
                {i < currentIndex ? (
                  <MaterialIcons name="check" size={12} color={Colors.textInverse} />
                ) : (
                  <Text style={[styles.stepNum, i <= currentIndex && styles.stepNumActive]}>{i + 1}</Text>
                )}
              </View>
              <Text style={[styles.stepLabel, i === currentIndex && styles.stepLabelActive]}>{label}</Text>
              {i < visibleSteps.length - 1 ? (
                <View style={[styles.stepLine, i < currentIndex && styles.stepLineActive]} />
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
                Keep it simple — even “replace kitchen taps in M1” works. AI handles the rest using your rates and preferred shop.
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

              {/* Job location */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>JOB LOCATION (optional)</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="e.g. Bude, EX23 — where the job is"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              {/* Trade selector (multi-select — a job can span trades) */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>TRADE(S) — SELECT ALL THAT APPLY</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tradeRow}>
                  {TRADE_CATEGORIES.map(t => (
                    <Pressable
                      key={t}
                      style={[styles.tradeChip, trades.includes(t) && styles.tradeChipActive]}
                      onPress={() => toggleTrade(t)}
                    >
                      <Text style={[styles.tradeChipText, trades.includes(t) && styles.tradeChipTextActive]}>{t}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Job type toggle */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>JOB TYPE</Text>
                <View style={styles.jobTypeRow}>
                  <Pressable
                    style={[styles.jobTypeBtn, jobType === 'fixed' && styles.jobTypeBtnActive]}
                    onPress={() => setJobType('fixed')}
                  >
                    <MaterialIcons name="receipt-long" size={16} color={jobType === 'fixed' ? Colors.textInverse : Colors.textSecondary} />
                    <View>
                      <Text style={[styles.jobTypeBtnLabel, jobType === 'fixed' && styles.jobTypeBtnLabelActive]}>Fixed Price</Text>
                      <Text style={[styles.jobTypeBtnSub, jobType === 'fixed' && styles.jobTypeBtnSubActive]}>Agreed quote upfront</Text>
                    </View>
                  </Pressable>
                  <Pressable
                    style={[styles.jobTypeBtn, jobType === 'hourly' && styles.jobTypeBtnActive]}
                    onPress={() => setJobType('hourly')}
                  >
                    <MaterialIcons name="schedule" size={16} color={jobType === 'hourly' ? Colors.textInverse : Colors.textSecondary} />
                    <View>
                      <Text style={[styles.jobTypeBtnLabel, jobType === 'hourly' && styles.jobTypeBtnLabelActive]}>Hourly Rate</Text>
                      <Text style={[styles.jobTypeBtnSub, jobType === 'hourly' && styles.jobTypeBtnSubActive]}>Estimate, billed on time</Text>
                    </View>
                  </Pressable>
                </View>
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

              {/* Manual path — never force AI on the user */}
              <Pressable style={styles.manualBtn} onPress={handleManualEntry}>
                <MaterialIcons name="edit" size={16} color={Colors.textSecondary} />
                <Text style={styles.manualBtnText}>Skip AI — enter details manually</Text>
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

                  {/* ESTIMATE vs FINAL QUOTE disclaimer */}
                  <View style={styles.estimateDisclaimerBox}>
                    <View style={styles.estimateTagRow}>
                      <View style={styles.estimateTag}><Text style={styles.estimateTagText}>ESTIMATE</Text></View>
                      <MaterialIcons name="arrow-forward" size={12} color={Colors.textMuted} />
                      <View style={styles.finalQuoteTag}><Text style={styles.finalQuoteTagText}>FINAL QUOTE</Text></View>
                    </View>
                    <Text style={styles.estimateDisclaimerText}>{PLATFORM_PRINCIPLES.ESTIMATE_DISCLAIMER}</Text>
                  </View>
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
              <Text style={styles.stepTitle}>{manualMode ? 'Job details' : 'Confirm job'}</Text>
              <Text style={styles.stepSub}>
                {manualMode ? 'Enter the details and save.' : 'Review and adjust before saving.'}
              </Text>

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

              {jobType === 'hourly' ? (
                <>
                  {/* Hourly rate + estimated hours */}
                  <View style={styles.twoCol}>
                    <View style={[styles.fieldGroup, { flex: 1 }]}>
                      <Text style={styles.fieldLabel}>HOURLY RATE (£/HR)</Text>
                      <TextInput
                        style={styles.fieldInput}
                        value={hourlyRateStr}
                        onChangeText={setHourlyRateStr}
                        keyboardType="decimal-pad"
                        placeholder="e.g. 45"
                        placeholderTextColor={Colors.textMuted}
                      />
                    </View>
                    <View style={[styles.fieldGroup, { flex: 1 }]}>
                      <Text style={styles.fieldLabel}>EST. HOURS</Text>
                      <TextInput
                        style={styles.fieldInput}
                        value={estimatedHoursStr}
                        onChangeText={setEstimatedHoursStr}
                        keyboardType="decimal-pad"
                        placeholder="e.g. 8"
                        placeholderTextColor={Colors.textMuted}
                      />
                    </View>
                  </View>
                  <View style={styles.fieldGroup}>
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
                  {/* Hourly estimate note */}
                  <View style={styles.hourlyNoteBanner}>
                    <MaterialIcons name="schedule" size={14} color={Colors.info} />
                    <Text style={styles.hourlyNoteText}>
                      This is an estimate — the final invoice will be based on actual hours worked. The customer will receive an estimate document, not a fixed quote.
                    </Text>
                  </View>
                </>
              ) : (
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
              )}

              {/* Summary */}
              <View style={styles.finalSummary}>
                {jobType === 'hourly' && hourlyRate > 0 && estimatedHours > 0 ? (
                  <View style={styles.grandTotalRow}>
                    <Text style={styles.grandTotalLabel}>Labour est. ({estimatedHours} hrs × £{hourlyRate}/hr)</Text>
                    <Text style={styles.grandTotalVal}>£{labourNum.toFixed(2)}</Text>
                  </View>
                ) : (
                  <View style={styles.grandTotalRow}>
                    <Text style={styles.grandTotalLabel}>Subtotal</Text>
                    <Text style={styles.grandTotalVal}>£{(labourNum + materialsNum).toFixed(2)}</Text>
                  </View>
                )}
                {jobType === 'hourly' && (parseFloat(materialsOverride) || 0) > 0 ? (
                  <View style={styles.grandTotalRow}>
                    <Text style={styles.grandTotalLabel}>Materials</Text>
                    <Text style={styles.grandTotalVal}>£{materialsNum.toFixed(2)}</Text>
                  </View>
                ) : null}
                <View style={styles.grandTotalRow}>
                  <Text style={styles.grandTotalLabel}>VAT (20%)</Text>
                  <Text style={styles.grandTotalVal}>£{vat.toFixed(2)}</Text>
                </View>
                <View style={[styles.grandTotalRow, styles.grandTotalFinal]}>
                  <Text style={styles.grandTotalFinalLabel}>{jobType === 'hourly' ? 'ESTIMATE TOTAL' : 'TOTAL'}</Text>
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
  manualBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 50, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card,
  },
  manualBtnText: { ...Typography.labelMD, color: Colors.textSecondary },

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
  // Estimate disclaimer
  estimateDisclaimerBox: {
    backgroundColor: Colors.cardAlt, borderRadius: Radius.sm, borderWidth: 1,
    borderColor: Colors.border, padding: 10, gap: 8,
  },
  estimateTagRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  estimateTag: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill,
    backgroundColor: Colors.warningDim, borderWidth: 1, borderColor: Colors.warning,
  },
  estimateTagText: { fontSize: 9, fontWeight: '800', color: Colors.warning, letterSpacing: 0.8 },
  finalQuoteTag: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill,
    backgroundColor: Colors.primaryDim, borderWidth: 1, borderColor: Colors.primaryLight,
  },
  finalQuoteTagText: { fontSize: 9, fontWeight: '700', color: Colors.primaryGlow, letterSpacing: 0.5 },
  estimateDisclaimerText: { ...Typography.labelSM, color: Colors.textMuted, lineHeight: 17 },

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
  jobTypeBtnSub: { ...Typography.labelSM, color: Colors.textMuted },
  jobTypeBtnSubActive: { color: Colors.textInverse + 'CC' },

  // Hourly note banner
  hourlyNoteBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.infoDim, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.info + '44', padding: 12,
  },
  hourlyNoteText: { ...Typography.labelSM, color: Colors.info, flex: 1, lineHeight: 18 },
});
