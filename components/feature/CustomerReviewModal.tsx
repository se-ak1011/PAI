/**
 * CustomerReviewModal
 * Allows a contractor to leave a structured reliability review for a customer
 * after a completed job. No free-text wall — structured ratings + selectable tags only.
 * Optional private note is never shown publicly without admin moderation.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, Pressable,
  ActivityIndicator, TextInput, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { getSupabaseClient } from '@/template/core';
import { useAuth } from '@/hooks/useAuth';
import { useAlert } from '@/template/ui';

// ── Types ────────────────────────────────────────────────────
interface CustomerReviewModalProps {
  visible: boolean;
  onClose: () => void;
  jobPostId: string;
  customerId: string;
  customerName: string;
  jobTitle: string;
}

const CATEGORY_KEYS = [
  { key: 'communication',        label: 'Communication' },
  { key: 'payment_reliability',  label: 'Payment reliability' },
  { key: 'project_preparedness', label: 'Project preparedness' },
  { key: 'scope_stability',      label: 'Scope stability' },
  { key: 'respectful_behaviour', label: 'Respectful behaviour' },
] as const;
type CategoryKey = typeof CATEGORY_KEYS[number]['key'];

const POSITIVE_TAGS = [
  { key: 'paid_on_time',                 label: 'Paid on time' },
  { key: 'clear_communication',          label: 'Clear communication' },
  { key: 'scope_stayed_consistent',      label: 'Scope stayed consistent' },
  { key: 'prepared_before_arrival',      label: 'Prepared before arrival' },
  { key: 'respectful_and_easy',          label: 'Respectful and easy to work with' },
];

const NEGATIVE_TAGS = [
  { key: 'payment_delayed',             label: 'Payment delayed' },
  { key: 'scope_changed_repeatedly',    label: 'Scope changed repeatedly' },
  { key: 'poor_communication',          label: 'Poor communication' },
  { key: 'access_issues',              label: 'Access issues' },
  { key: 'dispute_raised',              label: 'Dispute raised' },
  { key: 'cancelled_late',             label: 'Cancelled late' },
  { key: 'unclear_job_details',        label: 'Unclear job details' },
];

// ── 5-star tap row ───────────────────────────────────────────
function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={starStyles.row}>
      {[1, 2, 3, 4, 5].map(n => (
        <Pressable key={n} onPress={() => onChange(n)} hitSlop={6}>
          <MaterialIcons
            name={n <= value ? 'star' : 'star-border'}
            size={30}
            color={n <= value ? Colors.warning : Colors.textMuted}
          />
        </Pressable>
      ))}
    </View>
  );
}
const starStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
});

// ── Mini 5-star row for category ratings ─────────────────────
function MiniStars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <Pressable key={n} onPress={() => onChange(n)} hitSlop={6}>
          <MaterialIcons
            name={n <= value ? 'star' : 'star-border'}
            size={18}
            color={n <= value ? Colors.warning : Colors.border}
          />
        </Pressable>
      ))}
    </View>
  );
}

// ── Main Modal ───────────────────────────────────────────────
export function CustomerReviewModal({
  visible, onClose, jobPostId, customerId, customerName, jobTitle,
}: CustomerReviewModalProps) {
  const { user } = useAuth();
  const { showAlert } = useAlert();

  // Overall star
  const [overall, setOverall] = useState(0);

  // Category ratings (1–5 each, 0 = unset)
  const [categories, setCategories] = useState<Record<CategoryKey, number>>({
    communication: 0,
    payment_reliability: 0,
    project_preparedness: 0,
    scope_stability: 0,
    respectful_behaviour: 0,
  });

  const setCategory = (key: CategoryKey, val: number) =>
    setCategories(prev => ({ ...prev, [key]: val }));

  // Tags
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const toggleTag = (key: string) =>
    setSelectedTags(prev =>
      prev.includes(key) ? prev.filter(t => t !== key) : [...prev, key]
    );

  // Would work again
  const [wouldWorkAgain, setWouldWorkAgain] = useState(true);

  // Private note
  const [privateNote, setPrivateNote] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const handleReset = () => {
    setOverall(0);
    setCategories({ communication: 0, payment_reliability: 0, project_preparedness: 0, scope_stability: 0, respectful_behaviour: 0 });
    setSelectedTags([]);
    setWouldWorkAgain(true);
    setPrivateNote('');
  };

  const handleClose = () => { handleReset(); onClose(); };

  const handleSubmit = async () => {
    if (overall === 0) {
      showAlert('Rating required', 'Please give an overall star rating before submitting.');
      return;
    }
    if (!user?.id) return;

    setSubmitting(true);
    const supabase = getSupabaseClient();

    // Build categories object — only include rated ones
    const catPayload: Record<string, number> = {};
    (Object.entries(categories) as [CategoryKey, number][]).forEach(([k, v]) => {
      if (v > 0) catPayload[k] = v;
    });

    const { error } = await supabase.from('reviews').insert({
      author_id: user.id,
      subject_id: customerId,
      job_post_id: jobPostId || null,
      mode: 'contractor_to_customer',
      rating: overall,
      categories: catPayload,
      tags: selectedTags,
      would_work_again: wouldWorkAgain,
      private_note: privateNote.trim() || null,
      status: 'published',
      comment: null, // no public free-text
    });

    setSubmitting(false);

    if (error) {
      if (error.message.includes('unique') || error.code === '23505') {
        showAlert('Already reviewed', 'You have already submitted a review for this customer on this job.');
      } else {
        showAlert('Error', 'Could not submit review: ' + error.message);
      }
    } else {
      showAlert(
        'Review submitted',
        'Your feedback has been recorded. It contributes to the client reliability score visible to other contractors.'
      );
      handleClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleClose} hitSlop={8}>
            <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Review Client</Text>
            <Text style={styles.headerSub}>{customerName} · {jobTitle}</Text>
          </View>
          <View style={{ width: 30 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Legal note */}
          <View style={styles.legalNote}>
            <MaterialIcons name="info-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.legalText}>
              Reviews must be honest, professional, and based on first-hand experience. PAI may remove reviews that are abusive, discriminatory, defamatory, or unrelated to the job.
            </Text>
          </View>

          {/* Overall rating */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Overall experience</Text>
            <View style={styles.overallRow}>
              <StarRating value={overall} onChange={setOverall} />
              {overall > 0 ? (
                <Text style={styles.overallLabel}>
                  {['', 'Poor', 'Below average', 'Average', 'Good', 'Excellent'][overall]}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Category ratings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Category ratings</Text>
            <Text style={styles.sectionSub}>Optional — rate areas individually</Text>
            <View style={styles.categoryList}>
              {CATEGORY_KEYS.map(({ key, label }) => (
                <View key={key} style={styles.categoryRow}>
                  <Text style={styles.categoryLabel}>{label}</Text>
                  <MiniStars
                    value={categories[key]}
                    onChange={v => setCategory(key, v)}
                  />
                </View>
              ))}
            </View>
          </View>

          {/* Tags */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select tags</Text>
            <Text style={styles.sectionSub}>Choose all that apply</Text>

            <Text style={styles.tagGroupLabel}>POSITIVE</Text>
            <View style={styles.tagRow}>
              {POSITIVE_TAGS.map(({ key, label }) => {
                const on = selectedTags.includes(key);
                return (
                  <Pressable
                    key={key}
                    style={[styles.tag, on && styles.tagPositiveOn]}
                    onPress={() => toggleTag(key)}
                  >
                    {on ? <MaterialIcons name="check" size={11} color={Colors.success} /> : null}
                    <Text style={[styles.tagText, on && styles.tagTextPositiveOn]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.tagGroupLabel, { marginTop: 14 }]}>AREAS FOR IMPROVEMENT</Text>
            <View style={styles.tagRow}>
              {NEGATIVE_TAGS.map(({ key, label }) => {
                const on = selectedTags.includes(key);
                return (
                  <Pressable
                    key={key}
                    style={[styles.tag, on && styles.tagNegativeOn]}
                    onPress={() => toggleTag(key)}
                  >
                    {on ? <MaterialIcons name="check" size={11} color={Colors.error} /> : null}
                    <Text style={[styles.tagText, on && styles.tagTextNegativeOn]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Would work again */}
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Would work with again</Text>
              <Text style={styles.toggleSub}>Contributes to client reliability score</Text>
            </View>
            <Switch
              value={wouldWorkAgain}
              onValueChange={setWouldWorkAgain}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.textInverse}
            />
          </View>

          {/* Private note */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Private note</Text>
            <Text style={styles.sectionSub}>
              Not shown publicly. Only visible to you and PAI admins for moderation purposes.
            </Text>
            <TextInput
              style={styles.privateInput}
              value={privateNote}
              onChangeText={setPrivateNote}
              placeholder="Any private observations for your own records..."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Submit */}
          <Pressable
            style={[styles.submitBtn, (overall === 0 || submitting) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={overall === 0 || submitting}
          >
            {submitting
              ? <ActivityIndicator size="small" color={Colors.textInverse} />
              : <Text style={styles.submitBtnText}>Submit Review</Text>}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerCenter: { flex: 1, alignItems: 'center', gap: 2 },
  headerTitle: { ...Typography.headingMD },
  headerSub: { ...Typography.labelSM, color: Colors.textMuted },
  scroll: { padding: Spacing.md, gap: Spacing.lg, paddingBottom: 60 },

  legalNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.cardAlt, borderRadius: Radius.sm, padding: 12,
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  legalText: { ...Typography.labelSM, color: Colors.textMuted, flex: 1, lineHeight: 17 },

  section: { gap: 10 },
  sectionTitle: { ...Typography.headingMD },
  sectionSub: { ...Typography.labelSM, color: Colors.textMuted, marginTop: -4 },

  overallRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 4 },
  overallLabel: { ...Typography.labelMD, color: Colors.textSecondary },

  categoryList: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  categoryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  categoryLabel: { ...Typography.bodyMD },

  tagGroupLabel: { ...Typography.labelXS, marginBottom: 6 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.pill,
    backgroundColor: Colors.cardAlt, borderWidth: 1, borderColor: Colors.border,
  },
  tagPositiveOn: { backgroundColor: Colors.successDim, borderColor: Colors.success },
  tagNegativeOn: { backgroundColor: Colors.errorDim, borderColor: Colors.error },
  tagText: { ...Typography.labelSM, color: Colors.textSecondary },
  tagTextPositiveOn: { color: Colors.success, fontWeight: '600' },
  tagTextNegativeOn: { color: Colors.error, fontWeight: '600' },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1,
    borderColor: Colors.border, padding: 16,
  },
  toggleLabel: { ...Typography.bodyMD },
  toggleSub: { ...Typography.labelSM, color: Colors.textMuted, marginTop: 2 },

  privateInput: {
    backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1,
    borderColor: Colors.border, padding: 14, minHeight: 90,
    ...Typography.bodyMD, color: Colors.textPrimary,
  },

  submitBtn: {
    height: 54, backgroundColor: Colors.primary, borderRadius: Radius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnText: { ...Typography.btnMD, color: Colors.textInverse },
});
