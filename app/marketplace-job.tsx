import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
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
import { getSupabaseClient } from '@/template';
import { MaterialIcons } from '@expo/vector-icons';

export default function MarketplaceJobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { jobPosts, addPrivateJob, refreshJobs } = useJobs();
  const { showAlert } = useAlert();
  const [quoteAmount, setQuoteAmount] = useState('');
  const [etaDays, setEtaDays] = useState('');
  const [message, setMessage] = useState('');
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  const post = jobPosts.find(p => p.id === id);
  const isContractorAccount = user?.account_type === 'contractor' || user?.account_type === 'both';
  const isClientAccount = user?.account_type === 'customer' || user?.account_type === 'both';
  const isOwnPost = post?.client_id === user?.id;

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

  const handleApply = async () => {
    if (!quoteAmount || isNaN(parseFloat(quoteAmount))) {
      showAlert('Required', 'Please enter your quote amount.');
      return;
    }
    if (!user) return;
    setApplying(true);
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('job_applications')
      .insert({
        job_post_id: post.id,
        contractor_id: user.id,
        quote_amount: parseFloat(quoteAmount),
        eta_days: etaDays ? parseInt(etaDays) : null,
        message: message || null,
        status: 'pending',
      });

    if (error) {
      showAlert('Error', error.message.includes('unique') ? 'You have already applied for this job.' : error.message);
    } else {
      setApplied(true);
      showAlert('Quote Submitted', 'Your quote has been submitted. The customer will be notified.');
    }
    setApplying(false);
  };

  // Customer: accept an application → auto-create private job for contractor
  const handleAcceptQuote = async (applicationId: string, contractorId: string, quoteAmt: number, contractorName: string) => {
    showAlert(
      'Accept Quote',
      `Accept ${contractorName}'s quote of £${quoteAmt.toLocaleString()}? This will create a job record for them and update the job status.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            const supabase = getSupabaseClient();
            // Update application to accepted, reject others
            await supabase
              .from('job_applications')
              .update({ status: 'accepted' })
              .eq('id', applicationId);
            await supabase
              .from('job_applications')
              .update({ status: 'rejected' })
              .eq('job_post_id', post.id)
              .neq('id', applicationId);

            // Update job post to in_progress
            await supabase
              .from('job_posts')
              .update({ status: 'in_progress' })
              .eq('id', post.id);

            // Create private job for contractor
            const labour = quoteAmt * 0.6;
            const materials = quoteAmt * 0.4;
            const vat = (labour + materials) * 0.2;
            const total = labour + materials + vat;
            await supabase
              .from('private_jobs')
              .insert({
                contractor_id: contractorId,
                title: post.title,
                customer: user?.display_name || 'Customer',
                description: post.description || '',
                status: 'accepted',
                total: quoteAmt,
                labour: Math.round(labour * 100) / 100,
                materials: Math.round(materials * 100) / 100,
                vat: 0,
                materials_items: [],
                receipts: [],
                source_job_post_id: post.id,
              });

            showAlert('Quote Accepted', 'The contractor has been notified and the job is now in progress.');
            router.back();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textSecondary} />
        </Pressable>
        <Text style={styles.navTitle}>Job Details</Text>
        <Pressable hitSlop={8} onPress={() => showAlert('Share', 'Share link coming soon.')}>
          <MaterialIcons name="share" size={22} color={Colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {post.photo_url ? (
          <Image source={{ uri: post.photo_url }} style={styles.heroImage} contentFit="cover" transition={200} />
        ) : (
          <View style={styles.heroPlaceholder}>
            <MaterialIcons name="construction" size={48} color={Colors.textMuted} />
          </View>
        )}

        <View style={styles.body}>
          <View style={styles.topRow}>
            <PBadge label={post.status} variant={post.status as any} />
            <PBadge label={post.trade} />
          </View>

          <Text style={styles.title}>{post.title}</Text>

          <View style={styles.clientRow}>
            <View style={styles.clientAvatar}>
              <MaterialIcons name="person" size={20} color={Colors.textInverse} />
            </View>
            <View>
              <Text style={styles.clientName}>{post.client_name || 'Customer'}</Text>
              <View style={styles.locationRow}>
                <MaterialIcons name="location-on" size={12} color={Colors.textMuted} />
                <Text style={styles.location}>{post.city}{post.postcode_area ? `, ${post.postcode_area}` : ''}</Text>
              </View>
            </View>
            <View style={styles.budgetRight}>
              <Text style={styles.budgetLabel}>BUDGET</Text>
              <Text style={styles.budget}>£{post.budget.toLocaleString()}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{post.description || 'No description provided.'}</Text>
          </View>

          {post.ai_scope ? (
            <View style={styles.aiSection}>
              <View style={styles.aiHeader}>
                <MaterialIcons name="auto-awesome" size={16} color={Colors.primaryGlow} />
                <Text style={styles.aiTitle}>AI Scope of Work</Text>
              </View>
              <Text style={styles.aiContent}>{post.ai_scope}</Text>
            </View>
          ) : null}

          {post.ai_materials && post.ai_materials.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Suggested Materials</Text>
              <View style={styles.materialsList}>
                {post.ai_materials.map((m: string, i: number) => (
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
              <Text style={styles.statValue}>{post.applications ?? 0}</Text>
              <Text style={styles.statLabel}>QUOTES</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{new Date(post.created_at).toLocaleDateString('en-GB')}</Text>
              <Text style={styles.statLabel}>POSTED</Text>
            </View>
          </View>

          {/* Contractor: submit quote */}
          {isContractorAccount && !isOwnPost && post.status === 'open' ? (
            applied ? (
              <View style={styles.appliedBanner}>
                <MaterialIcons name="check-circle" size={20} color={Colors.success} />
                <Text style={styles.appliedText}>Quote submitted successfully</Text>
              </View>
            ) : (
              <View style={styles.applySection}>
                <Text style={styles.sectionTitle}>Submit Your Quote</Text>
                <PInput
                  label="Your Quote (£)"
                  value={quoteAmount}
                  onChangeText={setQuoteAmount}
                  keyboardType="decimal-pad"
                  prefix="£"
                  placeholder="0.00"
                />
                <PInput
                  label="Estimated Duration (days)"
                  value={etaDays}
                  onChangeText={setEtaDays}
                  keyboardType="number-pad"
                  placeholder="e.g. 3"
                />
                <PInput
                  label="Message to customer (optional)"
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Briefly describe your approach..."
                  multiline
                />
                <Pressable
                  style={[styles.submitBtn, applying && { opacity: 0.6 }]}
                  onPress={handleApply}
                  disabled={applying}
                >
                  {applying
                    ? <ActivityIndicator size="small" color={Colors.textInverse} />
                    : <Text style={styles.submitBtnText}>Submit Quote</Text>}
                </Pressable>
              </View>
            )
          ) : null}

          {/* Customer own post: applications list */}
          {isClientAccount && isOwnPost ? (
            <ApplicationsList
              jobPostId={post.id}
              isOpen={post.status === 'open'}
              onAccept={handleAcceptQuote}
            />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
// Applications list for job poster
// ─────────────────────────────────────────────
function ApplicationsList({
  jobPostId,
  isOpen,
  onAccept,
}: {
  jobPostId: string;
  isOpen: boolean;
  onAccept: (appId: string, contractorId: string, amount: number, name: string) => void;
}) {
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const supabase = getSupabaseClient();
    supabase
      .from('job_applications')
      .select('*, contractor:contractor_id(username, city, trades, hourly_rate_from)')
      .eq('job_post_id', jobPostId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setApps(data);
        setLoading(false);
      });
  }, [jobPostId]);

  if (loading) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quotes Received</Text>
        <ActivityIndicator color={Colors.primaryGlow} />
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Quotes Received ({apps.length})</Text>
      {apps.length === 0 ? (
        <View style={styles.emptyApps}>
          <Text style={styles.emptyAppsText}>No quotes yet. Tradespeople will appear here once they apply.</Text>
        </View>
      ) : (
        apps.map(app => (
          <View key={app.id} style={styles.appCard}>
            <View style={styles.appTop}>
              <View style={styles.appContractor}>
                <View style={styles.appAvatar}>
                  <MaterialIcons name="construction" size={18} color={Colors.primaryGlow} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.appName}>{app.contractor?.username || 'Contractor'}</Text>
                  {app.contractor?.city ? (
                    <View style={styles.locationRow}>
                      <MaterialIcons name="location-on" size={11} color={Colors.textMuted} />
                      <Text style={styles.appLocation}>{app.contractor.city}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <View style={styles.appAmountWrap}>
                <Text style={styles.appAmount}>£{parseFloat(app.quote_amount).toLocaleString()}</Text>
                {app.eta_days ? <Text style={styles.appEta}>{app.eta_days} days</Text> : null}
              </View>
            </View>
            {app.message ? (
              <Text style={styles.appMessage} numberOfLines={3}>{app.message}</Text>
            ) : null}
            <View style={styles.appFooter}>
              <View style={[
                styles.appStatus,
                app.status === 'accepted' && styles.appStatusAccepted,
                app.status === 'rejected' && styles.appStatusRejected,
              ]}>
                <Text style={[
                  styles.appStatusText,
                  app.status === 'accepted' && styles.appStatusTextAccepted,
                  app.status === 'rejected' && styles.appStatusTextRejected,
                ]}>
                  {app.status.toUpperCase()}
                </Text>
              </View>
              {isOpen && app.status === 'pending' ? (
                <Pressable
                  style={styles.acceptBtn}
                  onPress={() => onAccept(app.id, app.contractor_id, parseFloat(app.quote_amount), app.contractor?.username || 'Contractor')}
                >
                  <Text style={styles.acceptBtnText}>Accept Quote</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))
      )}
    </View>
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
  heroImage: { width: '100%', height: 220 },
  heroPlaceholder: { width: '100%', height: 160, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center' },
  body: { padding: Spacing.md, gap: Spacing.md },
  topRow: { flexDirection: 'row', gap: 8 },
  title: { ...Typography.brandMD, fontSize: 22 },
  clientRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clientAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
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
  submitBtn: {
    height: 52, backgroundColor: Colors.primary, borderRadius: Radius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  submitBtnText: { ...Typography.btnMD, color: Colors.textInverse },
  // Applications
  emptyApps: { backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: 20, alignItems: 'center' },
  emptyAppsText: { ...Typography.bodyMD, color: Colors.textMuted, textAlign: 'center' },
  appCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    padding: 16, gap: 12,
  },
  appTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  appContractor: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  appAvatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primaryDim, alignItems: 'center', justifyContent: 'center' },
  appName: { ...Typography.dataMD },
  appLocation: { ...Typography.labelSM, color: Colors.textMuted },
  appAmountWrap: { alignItems: 'flex-end', gap: 2 },
  appAmount: { ...Typography.dataLG, color: Colors.success },
  appEta: { ...Typography.labelXS, color: Colors.textMuted },
  appMessage: { ...Typography.bodyMD, color: Colors.textSecondary, lineHeight: 20 },
  appFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  appStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.cardAlt },
  appStatusAccepted: { backgroundColor: Colors.successDim, borderColor: Colors.success },
  appStatusRejected: { backgroundColor: Colors.errorDim, borderColor: Colors.error },
  appStatusText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, color: Colors.textMuted },
  appStatusTextAccepted: { color: Colors.success },
  appStatusTextRejected: { color: Colors.error },
  acceptBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.primary, borderRadius: Radius.md },
  acceptBtnText: { ...Typography.btnSM, color: Colors.textInverse },
});
