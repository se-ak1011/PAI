import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { PBadge } from '@/components/ui/PBadge';
import { PButton } from '@/components/ui/PButton';
import { PInput } from '@/components/ui/PInput';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { useJobs } from '@/hooks/useJobs';
import { useAuth } from '@/hooks/useAuth';
import { useAlert } from '@/template';
import { MOCK_JOB_POSTS } from '@/services/mockData';
import { MaterialIcons } from '@expo/vector-icons';

export default function MarketplaceJobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { jobPosts } = useJobs();
  const { showAlert } = useAlert();
  const [quoteAmount, setQuoteAmount] = useState('');
  const [etaDays, setEtaDays] = useState('');
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  const post = MOCK_JOB_POSTS.find(p => p.id === id) || jobPosts.find(p => p.id === id);

  if (!post) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.notFoundText}>Job post not found</Text>
          <Pressable onPress={() => router.back()}><Text style={styles.backLink}>Go back</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isContractor = user?.account_type === 'contractor';

  const handleApply = async () => {
    if (!quoteAmount) { showAlert('Required', 'Please enter your quote amount.'); return; }
    setApplying(true);
    await new Promise(r => setTimeout(r, 1000));
    setApplied(true);
    setApplying(false);
    showAlert('Application Sent', 'Your quote has been submitted. The customer will be notified.');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textSecondary} />
        </Pressable>
        <Text style={styles.navTitle}>Job Details</Text>
        <Pressable hitSlop={8}>
          <MaterialIcons name="share" size={22} color={Colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Image source={{ uri: post.photo_url }} style={styles.heroImage} contentFit="cover" transition={200} />

        <View style={styles.body}>
          <View style={styles.topRow}>
            <PBadge label={post.status} variant={post.status as any} />
            <PBadge label={post.trade} />
          </View>

          <Text style={styles.title}>{post.title}</Text>

          <View style={styles.clientRow}>
            <Image source={{ uri: post.client_avatar }} style={styles.clientAvatar} contentFit="cover" />
            <View>
              <Text style={styles.clientName}>{post.client_name}</Text>
              <View style={styles.locationRow}>
                <MaterialIcons name="location-on" size={12} color={Colors.textMuted} />
                <Text style={styles.location}>{post.city}, {post.postcode_area}</Text>
              </View>
            </View>
            <View style={styles.budgetRight}>
              <Text style={styles.budgetLabel}>BUDGET</Text>
              <Text style={styles.budget}>£{post.budget.toLocaleString()}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{post.description}</Text>
          </View>

          {post.ai_scope ? (
            <View style={styles.aiSection}>
              <View style={styles.aiHeader}>
                <MaterialIcons name="auto-awesome" size={16} color={Colors.primaryGlow} />
                <Text style={styles.aiTitle}>AI-Generated Scope</Text>
              </View>
              <Text style={styles.aiContent}>{post.ai_scope}</Text>
            </View>
          ) : null}

          {post.ai_materials && post.ai_materials.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Suggested Materials</Text>
              <View style={styles.materialsList}>
                {post.ai_materials.map((m, i) => (
                  <View key={i} style={styles.materialItem}>
                    <MaterialIcons name="check-box-outline-blank" size={14} color={Colors.textMuted} />
                    <Text style={styles.materialText}>{m}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{post.applications}</Text>
              <Text style={styles.statLabel}>QUOTES</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{post.created_at}</Text>
              <Text style={styles.statLabel}>POSTED</Text>
            </View>
          </View>

          {isContractor && post.status === 'open' ? (
            applied ? (
              <View style={styles.appliedBanner}>
                <MaterialIcons name="check-circle" size={20} color={Colors.success} />
                <Text style={styles.appliedText}>Quote submitted successfully</Text>
              </View>
            ) : (
              <View style={styles.applySection}>
                <Text style={styles.sectionTitle}>Submit Your Quote</Text>
                <PInput label="Your Quote (£)" value={quoteAmount} onChangeText={setQuoteAmount} keyboardType="decimal-pad" prefix="£" placeholder="0.00" />
                <PInput label="Estimated Duration (days)" value={etaDays} onChangeText={setEtaDays} keyboardType="number-pad" placeholder="e.g. 3" />
                <PButton label="Submit Quote" onPress={handleApply} loading={applying} fullWidth />
              </View>
            )
          ) : isContractor ? null : (
            <View style={styles.contactSection}>
              <PButton label="Message Contractor" onPress={() => showAlert('Coming Soon', 'Messaging will be available with backend integration.')} variant="secondary" fullWidth />
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  notFoundText: { ...Typography.headingMD },
  backLink: { ...Typography.labelMD, color: Colors.primaryLight },
  navBar: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { padding: 4 },
  navTitle: { flex: 1, ...Typography.headingMD },
  scroll: { paddingBottom: 100 },
  heroImage: { width: '100%', height: 240 },
  body: { padding: Spacing.md, gap: Spacing.md },
  topRow: { flexDirection: 'row', gap: 8 },
  title: { ...Typography.brandMD, fontSize: 22 },
  clientRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clientAvatar: { width: 40, height: 40, borderRadius: 20 },
  clientName: { ...Typography.dataMD },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  location: { ...Typography.labelSM },
  budgetRight: { marginLeft: 'auto', alignItems: 'flex-end', gap: 2 },
  budgetLabel: { ...Typography.labelXS },
  budget: { ...Typography.dataLG, color: Colors.success },
  section: { gap: 10 },
  sectionTitle: { ...Typography.headingMD },
  description: { ...Typography.bodyMD, color: Colors.textSecondary, lineHeight: 22 },
  aiSection: { backgroundColor: Colors.primaryDim, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.primary, padding: 16, gap: 10 },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiTitle: { ...Typography.dataMD, color: Colors.primaryGlow },
  aiContent: { ...Typography.bodyMD, color: Colors.textSecondary, lineHeight: 22 },
  materialsList: { gap: 8 },
  materialItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  materialText: { ...Typography.bodyMD, color: Colors.textSecondary },
  statsRow: { flexDirection: 'row', gap: 24 },
  stat: { gap: 4 },
  statValue: { ...Typography.dataMD },
  statLabel: { ...Typography.labelXS },
  applySection: { gap: 14 },
  appliedBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.successDim, borderRadius: Radius.md, padding: 14 },
  appliedText: { ...Typography.dataMD, color: Colors.success },
  contactSection: { gap: 10 },
});
