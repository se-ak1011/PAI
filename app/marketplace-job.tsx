import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { PBadge } from '@/components/ui/PBadge';
import { PInput } from '@/components/ui/PInput';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { useJobs } from '@/hooks/useJobs';
import { useAuth } from '@/hooks/useAuth';
import { useAlert } from '@/template/ui';
import { getSupabaseClient } from '@/template/core';
import { ensureConversation, getConversation } from '@/services/messageService';
import { calculateCheckoutTotal, PLATFORM_PRINCIPLES } from '@/constants/config';
import { useReliability } from '@/hooks/useReliability';
import { ReliabilityBadge } from '@/components/ui/ReliabilityBadge';
import { MaterialIcons } from '@expo/vector-icons';

// ─── Quote type toggle ────────────────────────────────────────
type QuoteType = 'quick' | 'full';

export default function MarketplaceJobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { jobPosts, refreshJobs } = useJobs();
  const { showAlert } = useAlert();
  const [quoteType, setQuoteType] = useState<QuoteType>('quick');
  const [quoteAmount, setQuoteAmount] = useState('');
  const [etaDays, setEtaDays] = useState('');
  const [message, setMessage] = useState('');
  // Full quote extras
  const [scopeOfWork, setScopeOfWork] = useState('');
  const [labourAmt, setLabourAmt] = useState('');
  const [materialsAmt, setMaterialsAmt] = useState('');
  const [timeline, setTimeline] = useState('');
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  const post = jobPosts.find(p => p.id === id);
  const isContractorAccount = user?.account_type === 'contractor' || user?.account_type === 'both';
  const isClientAccount = user?.account_type === 'customer' || user?.account_type === 'both';
  const isOwnPost = post?.client_id === user?.id;

  // Reliability score — shown to contractors before they apply
  const { score: reliabilityScore } = useReliability(
    isContractorAccount && !isOwnPost ? post?.client_id : null
  );

  if (!post) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.notFoundText}>Job post not found</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backLink}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Derive quote total from labour + materials if full quote
  const fullQuoteTotal =
    quoteType === 'full'
      ? (parseFloat(labourAmt) || 0) + (parseFloat(materialsAmt) || 0)
      : parseFloat(quoteAmount) || 0;

  const effectiveAmount = quoteType === 'quick' ? parseFloat(quoteAmount) || 0 : fullQuoteTotal;
  const checkout = calculateCheckoutTotal(effectiveAmount);

  const handleApply = async () => {
    const amount = quoteType === 'quick' ? parseFloat(quoteAmount) : fullQuoteTotal;
    if (!amount || isNaN(amount) || amount <= 0) {
      showAlert('Required', 'Please enter a valid quote amount.');
      return;
    }
    if (!user) return;

    // Build message body — full quotes include structured detail
    let fullMessage = message;
    if (quoteType === 'full') {
      const parts: string[] = [];
      if (scopeOfWork.trim()) parts.push(`Scope: ${scopeOfWork.trim()}`);
      if (labourAmt) parts.push(`Labour: £${labourAmt}`);
      if (materialsAmt) parts.push(`Materials: £${materialsAmt}`);
      if (timeline.trim()) parts.push(`Timeline: ${timeline.trim()}`);
      if (message.trim()) parts.push(message.trim());
      fullMessage = parts.join('\n');
    }

    setApplying(true);
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('job_applications')
      .insert({
        job_post_id: post.id,
        contractor_id: user.id,
        quote_amount: amount,
        eta_days: etaDays ? parseInt(etaDays) : null,
        message: fullMessage || null,
        status: 'pending',
      });

    if (error) {
      showAlert('Error', error.message.includes('unique') ? 'You have already applied for this job.' : error.message);
    } else {
      setApplied(true);
      const typeLabel = quoteType === 'quick' ? 'Quick Quote' : 'Full Quote';
      showAlert(`${typeLabel} Submitted`, 'Your quote has been submitted. The customer will be notified.\n\nRemember: Contractors receive the full quote amount. PAI does not deduct commission.');
    }
    setApplying(false);
  };

  // Customer: accept an application → show fee breakdown → auto-create private job
  const handleAcceptQuote = async (applicationId: string, contractorId: string, quoteAmt: number, contractorName: string) => {
    const totals = calculateCheckoutTotal(quoteAmt);
    showAlert(
      'Accept Quote',
      `Contractor receives: £${totals.contractorQuote.toLocaleString('en-GB', { minimumFractionDigits: 2 })}\nProcessing fee (Stripe): £${totals.stripeFee.toLocaleString('en-GB', { minimumFractionDigits: 2 })}\nYour total: £${totals.totalDue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}\n\n${PLATFORM_PRINCIPLES.NOT_A_PARTY}\n${PLATFORM_PRINCIPLES.STRIPE_PROCESSING}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Pay £${totals.totalDue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`,
          onPress: async () => {
            const supabase = getSupabaseClient();
            await supabase.from('job_applications').update({ status: 'accepted' }).eq('id', applicationId);
            await supabase.from('job_applications').update({ status: 'rejected' }).eq('job_post_id', post.id).neq('id', applicationId);
            await supabase.from('job_posts').update({ status: 'in_progress' }).eq('id', post.id);
            await supabase.from('private_jobs').insert({
              contractor_id: contractorId,
              title: post.title,
              customer: user?.display_name || 'Customer',
              description: post.description || '',
              status: 'accepted',
              total: quoteAmt,
              labour: Math.round(quoteAmt * 0.6 * 100) / 100,
              materials: Math.round(quoteAmt * 0.4 * 100) / 100,
              vat: 0,
              materials_items: [],
              receipts: [],
              source_job_post_id: post.id,
            });
            // Open the (gated) message thread between this customer and the hired
            // contractor now that the quote is accepted.
            if (user?.id) {
              await ensureConversation({ jobPostId: post.id, customerId: user.id, contractorId });
            }
            showAlert('Quote Accepted', `Job is now in progress. You can now message ${contractorName} from this job. Stripe payment will be processed for £${totals.totalDue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}.`);
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
            <View style={{ flex: 1 }}>
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
                <View style={styles.estimateBadge}>
                  <Text style={styles.estimateBadgeText}>ESTIMATE</Text>
                </View>
              </View>
              <Text style={styles.aiContent}>{post.ai_scope}</Text>
              {/* AI disclaimer */}
              <View style={styles.disclaimerBox}>
                <MaterialIcons name="info-outline" size={13} color={Colors.textMuted} />
                <Text style={styles.disclaimerText}>{PLATFORM_PRINCIPLES.ESTIMATE_DISCLAIMER}</Text>
              </View>
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

          {/* Client reliability — shown to contractors only, not to the post owner */}
          {isContractorAccount && !isOwnPost ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Client Reliability</Text>
              <ReliabilityBadge score={reliabilityScore} size="md" />
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

          {/* ── CONTRACTOR: submit quote ───────────────────────── */}
          {isContractorAccount && !isOwnPost && post.status === 'open' ? (
            applied ? (
              <View style={styles.appliedBanner}>
                <MaterialIcons name="check-circle" size={20} color={Colors.success} />
                <Text style={styles.appliedText}>Quote submitted successfully</Text>
              </View>
            ) : (
              <View style={styles.applySection}>
                <Text style={styles.sectionTitle}>Submit Your Quote</Text>

                {/* PAI no-commission notice */}
                <View style={styles.principleCard}>
                  <MaterialIcons name="verified" size={16} color={Colors.primaryGlow} />
                  <Text style={styles.principleText}>{PLATFORM_PRINCIPLES.NO_COMMISSION}</Text>
                </View>

                {/* Quote type selector */}
                <View style={styles.quoteTypeRow}>
                  <Pressable
                    style={[styles.quoteTypeBtn, quoteType === 'quick' && styles.quoteTypeBtnActive]}
                    onPress={() => setQuoteType('quick')}
                  >
                    <MaterialIcons name="flash-on" size={16} color={quoteType === 'quick' ? Colors.textInverse : Colors.textMuted} />
                    <View>
                      <Text style={[styles.quoteTypeBtnLabel, quoteType === 'quick' && styles.quoteTypeBtnLabelActive]}>
                        Quick Quote
                      </Text>
                      <Text style={[styles.quoteTypeBtnSub, quoteType === 'quick' && styles.quoteTypeBtnSubActive]}>
                        Indicate interest fast
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    style={[styles.quoteTypeBtn, quoteType === 'full' && styles.quoteTypeBtnActive]}
                    onPress={() => setQuoteType('full')}
                  >
                    <MaterialIcons name="description" size={16} color={quoteType === 'full' ? Colors.textInverse : Colors.textMuted} />
                    <View>
                      <Text style={[styles.quoteTypeBtnLabel, quoteType === 'full' && styles.quoteTypeBtnLabelActive]}>
                        Full Quote
                      </Text>
                      <Text style={[styles.quoteTypeBtnSub, quoteType === 'full' && styles.quoteTypeBtnSubActive]}>
                        Detailed formal quote
                      </Text>
                    </View>
                  </Pressable>
                </View>

                {/* Quick quote fields */}
                {quoteType === 'quick' ? (
                  <View style={styles.quoteFields}>
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
                      label="Short message to customer"
                      value={message}
                      onChangeText={setMessage}
                      placeholder="Briefly describe your approach and availability..."
                      multiline
                    />
                    <Text style={styles.quoteTypeHint}>
                      Quick quotes indicate your interest. A full quote can follow after discussion.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.quoteFields}>
                    <View style={styles.fullQuoteAmounts}>
                      <View style={{ flex: 1 }}>
                        <PInput
                          label="Labour (£)"
                          value={labourAmt}
                          onChangeText={setLabourAmt}
                          keyboardType="decimal-pad"
                          prefix="£"
                          placeholder="0.00"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <PInput
                          label="Materials (£)"
                          value={materialsAmt}
                          onChangeText={setMaterialsAmt}
                          keyboardType="decimal-pad"
                          prefix="£"
                          placeholder="0.00"
                        />
                      </View>
                    </View>
                    <PInput
                      label="Scope of Work"
                      value={scopeOfWork}
                      onChangeText={setScopeOfWork}
                      placeholder="Describe what you will do, materials to be used, and method..."
                      multiline
                    />
                    <PInput
                      label="Timeline"
                      value={timeline}
                      onChangeText={setTimeline}
                      placeholder="e.g. 2–3 days, start available from Monday"
                    />
                    <PInput
                      label="Additional notes (optional)"
                      value={message}
                      onChangeText={setMessage}
                      placeholder="Any conditions, assumptions, or exclusions..."
                      multiline
                    />
                    {/* Full quote totals */}
                    {fullQuoteTotal > 0 ? (
                      <View style={styles.totalPreview}>
                        <View style={styles.totalPreviewRow}>
                          <Text style={styles.totalPreviewLabel}>Your Quote Total</Text>
                          <Text style={styles.totalPreviewVal}>£{fullQuoteTotal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</Text>
                        </View>
                        <View style={[styles.totalPreviewRow, styles.totalPreviewNote]}>
                          <MaterialIcons name="info-outline" size={13} color={Colors.textMuted} />
                          <Text style={styles.totalPreviewNoteText}>
                            You receive this full amount. The customer pays a separate Stripe processing fee at checkout.
                          </Text>
                        </View>
                      </View>
                    ) : null}
                    <Text style={styles.quoteTypeHint}>
                      Full quotes require your review and approval before submission. This is a formal quotation.
                    </Text>
                  </View>
                )}

                {/* Contractor protection note */}
                <View style={styles.contractorProtectionBox}>
                  <Text style={styles.contractorProtectionTitle}>Contractor Protection</Text>
                  <Text style={styles.contractorProtectionText}>
                    {PLATFORM_PRINCIPLES.NO_COMMISSION}
                  </Text>
                  <Text style={[styles.contractorProtectionText, { marginTop: 4 }]}>
                    {PLATFORM_PRINCIPLES.AI_ASSIST_ONLY}
                  </Text>
                </View>

                <Pressable
                  style={[styles.submitBtn, applying && { opacity: 0.6 }]}
                  onPress={handleApply}
                  disabled={applying}
                >
                  {applying
                    ? <ActivityIndicator size="small" color={Colors.textInverse} />
                    : <Text style={styles.submitBtnText}>
                        {quoteType === 'quick' ? 'Submit Quick Quote' : 'Submit Full Quote'}
                      </Text>}
                </Pressable>
              </View>
            )
          ) : null}

          {/* ── CUSTOMER OWN POST: applications list ──────────── */}
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
  const [acceptedApp, setAcceptedApp] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useAuth();

  // Customer: open (get-or-create) the message thread with the hired contractor.
  const openThread = async (contractorId: string, contractorName: string) => {
    if (!user?.id) return;
    const { conversation } = await ensureConversation({ jobPostId, customerId: user.id, contractorId });
    if (conversation) {
      router.push({ pathname: '/chat', params: { id: conversation.id, title: contractorName } });
    }
  };

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

      {/* Estimate disclaimer for customer */}
      <View style={styles.disclaimerBox}>
        <MaterialIcons name="info-outline" size={13} color={Colors.textMuted} />
        <Text style={styles.disclaimerText}>{PLATFORM_PRINCIPLES.ESTIMATE_DISCLAIMER}</Text>
      </View>

      {apps.length === 0 ? (
        <View style={styles.emptyApps}>
          <Text style={styles.emptyAppsText}>No quotes yet. Tradespeople will appear here once they apply.</Text>
        </View>
      ) : (
        apps.map(app => {
          const totals = calculateCheckoutTotal(parseFloat(app.quote_amount));
          return (
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
                  <Text style={styles.appAmount}>£{totals.contractorQuote.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</Text>
                  {app.eta_days ? <Text style={styles.appEta}>{app.eta_days} days</Text> : null}
                </View>
              </View>
              {app.message ? (
                <Text style={styles.appMessage} numberOfLines={4}>{app.message}</Text>
              ) : null}

              {/* Fee breakdown — always visible before accepting */}
              {isOpen && app.status === 'pending' ? (
                <View style={styles.feeBreakdown}>
                  <View style={styles.feeRow}>
                    <Text style={styles.feeLabel}>Contractor quote</Text>
                    <Text style={styles.feeVal}>£{totals.contractorQuote.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</Text>
                  </View>
                  <View style={styles.feeRow}>
                    <Text style={styles.feeLabel}>Secure payment processing (Stripe)</Text>
                    <Text style={styles.feeVal}>£{totals.stripeFee.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</Text>
                  </View>
                  <View style={[styles.feeRow, styles.feeTotalRow]}>
                    <Text style={styles.feeTotalLabel}>Your total</Text>
                    <Text style={styles.feeTotalVal}>£{totals.totalDue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</Text>
                  </View>
                  <Text style={styles.feeNote}>{PLATFORM_PRINCIPLES.STRIPE_PROCESSING}</Text>
                </View>
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
                ) : app.status === 'accepted' ? (
                  <Pressable
                    style={styles.messageBtn}
                    onPress={() => openThread(app.contractor_id, app.contractor?.username || 'Contractor')}
                  >
                    <MaterialIcons name="chat-bubble-outline" size={15} color={Colors.primaryGlow} />
                    <Text style={styles.messageBtnText}>Message</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })
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

  // AI section with ESTIMATE badge
  aiSection: { backgroundColor: Colors.primaryDim, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.primary, padding: 16, gap: 10 },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiTitle: { ...Typography.dataMD, color: Colors.primaryGlow, flex: 1 },
  estimateBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill,
    backgroundColor: Colors.warningDim, borderWidth: 1, borderColor: Colors.warning,
  },
  estimateBadgeText: { fontSize: 9, fontWeight: '800', color: Colors.warning, letterSpacing: 0.8 },
  aiContent: { ...Typography.bodyMD, color: Colors.textSecondary, lineHeight: 22 },

  // Disclaimer
  disclaimerBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.cardAlt, borderRadius: Radius.sm, padding: 10,
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  disclaimerText: { ...Typography.labelSM, color: Colors.textMuted, flex: 1, lineHeight: 17 },

  materialsList: { gap: 8 },
  materialItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  materialText: { ...Typography.bodyMD, color: Colors.textSecondary },
  statsRow: { flexDirection: 'row', gap: 24 },
  stat: { gap: 4 },
  statValue: { ...Typography.dataMD },
  statLabel: { ...Typography.labelXS },

  // Apply section
  applySection: { gap: 14 },

  // PAI principle card
  principleCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: Colors.primaryDim, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.primaryLight, padding: 12,
  },
  principleText: { ...Typography.labelSM, color: Colors.primaryGlow, flex: 1, lineHeight: 18 },

  // Quote type toggle
  quoteTypeRow: { flexDirection: 'row', gap: 10 },
  quoteTypeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: Radius.lg, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: Colors.card,
  },
  quoteTypeBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryDim },
  quoteTypeBtnLabel: { ...Typography.labelMD, color: Colors.textSecondary },
  quoteTypeBtnLabelActive: { color: Colors.textPrimary, fontWeight: '600' },
  quoteTypeBtnSub: { ...Typography.labelSM, color: Colors.textMuted, marginTop: 1 },
  quoteTypeBtnSubActive: { color: Colors.primaryLight },
  quoteFields: { gap: 12 },
  fullQuoteAmounts: { flexDirection: 'row', gap: 10 },
  quoteTypeHint: { ...Typography.labelSM, color: Colors.textMuted, lineHeight: 18 },

  // Total preview (full quote)
  totalPreview: {
    backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1,
    borderColor: Colors.border, padding: 14, gap: 8,
  },
  totalPreviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalPreviewLabel: { ...Typography.labelMD, color: Colors.textSecondary },
  totalPreviewVal: { ...Typography.dataLG },
  totalPreviewNote: { gap: 8, flexWrap: 'wrap' },
  totalPreviewNoteText: { ...Typography.labelSM, color: Colors.textMuted, flex: 1, lineHeight: 17 },

  // Contractor protection
  contractorProtectionBox: {
    backgroundColor: Colors.cardAlt, borderRadius: Radius.md, borderWidth: 1,
    borderColor: Colors.border, padding: 14, gap: 6,
  },
  contractorProtectionTitle: { ...Typography.labelXS },
  contractorProtectionText: { ...Typography.labelSM, color: Colors.textMuted, lineHeight: 18 },

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

  // Fee breakdown
  feeBreakdown: {
    backgroundColor: Colors.cardAlt, borderRadius: Radius.md, borderWidth: 1,
    borderColor: Colors.border, padding: 12, gap: 8,
  },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  feeLabel: { ...Typography.labelSM, color: Colors.textSecondary, flex: 1, paddingRight: 8 },
  feeVal: { ...Typography.labelMD },
  feeTotalRow: {
    paddingTop: 8, marginTop: 4,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  feeTotalLabel: { ...Typography.labelMD, fontWeight: '700' },
  feeTotalVal: { ...Typography.dataLG },
  feeNote: { ...Typography.labelSM, color: Colors.textMuted, lineHeight: 17 },

  appFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  appStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.cardAlt },
  appStatusAccepted: { backgroundColor: Colors.successDim, borderColor: Colors.success },
  appStatusRejected: { backgroundColor: Colors.errorDim, borderColor: Colors.error },
  appStatusText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, color: Colors.textMuted },
  appStatusTextAccepted: { color: Colors.success },
  appStatusTextRejected: { color: Colors.error },
  acceptBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.primary, borderRadius: Radius.md },
  acceptBtnText: { ...Typography.btnSM, color: Colors.textInverse },
  messageBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card,
  },
  messageBtnText: { ...Typography.btnSM, color: Colors.primaryGlow },
});
