import React, { useState } from 'react';
import {
  View, Text, Modal, ScrollView, StyleSheet, Pressable, ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { TRADE_CATEGORIES } from '@/constants/config';
import { useJobs } from '@/hooks/useJobs';
import { useAuth } from '@/hooks/useAuth';
import { useAlert } from '@/template';
import { MaterialIcons } from '@expo/vector-icons';

interface PostJobModalProps {
  visible: boolean;
  onClose: () => void;
}

export function PostJobModal({ visible, onClose }: PostJobModalProps) {
  const { addJobPost } = useJobs();
  const { user } = useAuth();
  const { showAlert } = useAlert();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [trade, setTrade] = useState(TRADE_CATEGORIES[0]);
  const [budget, setBudget] = useState('');
  const [city, setCity] = useState(user?.city || '');
  const [postcode, setPostcode] = useState(user?.postcode_area || '');
  const [saving, setSaving] = useState(false);

  const handleReset = () => {
    setTitle('');
    setDescription('');
    setTrade(TRADE_CATEGORIES[0]);
    setBudget('');
    setCity(user?.city || '');
    setPostcode(user?.postcode_area || '');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handlePost = async () => {
    if (!title.trim()) {
      showAlert('Required', 'Please add a job title.');
      return;
    }
    if (!budget || parseFloat(budget) <= 0) {
      showAlert('Required', 'Please enter a budget.');
      return;
    }

    setSaving(true);
    await addJobPost({
      client_id: user?.id || '',
      title: title.trim(),
      description: description.trim(),
      trade,
      status: 'open',
      budget: parseFloat(budget),
      city: city.trim(),
      postcode_area: postcode.trim(),
      photo_url: null,
      ai_scope: null,
      ai_materials: null,
    });
    setSaving(false);
    handleClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={handleClose} hitSlop={8}>
            <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
          </Pressable>
          <Text style={styles.headerTitle}>Post a Job</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.intro}>
            Describe your job and local tradespeople will send you quotes.
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>JOB TITLE</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Bathroom refurbishment"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>DESCRIPTION</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe what needs doing, dimensions, any preferences..."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>TRADE CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {TRADE_CATEGORIES.map(t => (
                <Pressable
                  key={t}
                  style={[styles.chip, trade === t && styles.chipActive]}
                  onPress={() => setTrade(t)}
                >
                  <Text style={[styles.chipText, trade === t && styles.chipTextActive]}>{t}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>BUDGET (£)</Text>
            <TextInput
              style={styles.input}
              value={budget}
              onChangeText={setBudget}
              placeholder="e.g. 2500"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.twoCol}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>CITY</Text>
              <TextInput
                style={styles.input}
                value={city}
                onChangeText={setCity}
                placeholder="Manchester"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>POSTCODE</Text>
              <TextInput
                style={styles.input}
                value={postcode}
                onChangeText={setPostcode}
                placeholder="M1"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="characters"
              />
            </View>
          </View>

          <Pressable
            style={[styles.postBtn, (!title.trim() || saving) && styles.postBtnDisabled]}
            onPress={handlePost}
            disabled={!title.trim() || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={Colors.textInverse} />
            ) : (
              <>
                <MaterialIcons name="send" size={18} color={Colors.textInverse} />
                <Text style={styles.postBtnText}>Post Job</Text>
              </>
            )}
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
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { ...Typography.headingMD },
  scroll: { padding: Spacing.md, gap: 18, paddingBottom: 60 },
  intro: { ...Typography.bodyMD, color: Colors.textSecondary, lineHeight: 22 },
  field: { gap: 8 },
  label: { ...Typography.labelXS },
  input: {
    backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1,
    borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 13,
    ...Typography.bodyMD, color: Colors.textPrimary,
  },
  textarea: { minHeight: 100, textAlignVertical: 'top', paddingTop: 13 },
  chips: { gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill,
    backgroundColor: Colors.cardAlt, borderWidth: 1, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { ...Typography.labelMD, color: Colors.textSecondary },
  chipTextActive: { color: Colors.textInverse, fontWeight: '600' },
  twoCol: { flexDirection: 'row', gap: 12 },
  postBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Colors.primary, borderRadius: Radius.lg, height: 54,
  },
  postBtnDisabled: { opacity: 0.45 },
  postBtnText: { ...Typography.btnMD, color: Colors.textInverse },
});
