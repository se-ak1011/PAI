import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { MaterialIcons } from '@expo/vector-icons';
import { useReliability } from '@/hooks/useReliability';
import { ReliabilityBadge } from '@/components/ui/ReliabilityBadge';

interface Dispute {
  id: string;
  job_post_id: string | null;
  contractor_id: string;
  customer_id: string;
  filed_by: string;
  reason: string;
  status: 'open' | 'resolved' | 'closed';
  resolution_note: string | null;
  resolution_outcome: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  amount: number;
  created_at: string;
  // Joined
  contractor_name?: string;
  customer_name?: string;
  job_title?: string;
}

export default function AdminDisputesScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const { user } = useAuth();
  const [disputes, setDisputes] = React.useState<Dispute[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = React.useState('');
  const [resolving, setResolving] = React.useState(false);

  const supabase = getSupabaseClient();
  const [activeTab, setActiveTab] = React.useState<'disputes' | 'reviews'>('disputes');
  const [reviews, setReviews] = React.useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = React.useState(false);

  const loadDisputes = React.useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('disputes')
      .select(`
        *,
        contractor:contractor_id(username),
        customer:customer_id(username),
        job_post:job_post_id(title)
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setDisputes(data.map((d: any) => ({
        ...d,
        contractor_name: d.contractor?.username || 'Unknown Contractor',
        customer_name: d.customer?.username || 'Unknown Customer',
        job_title: d.job_post?.title || 'Job',
      })));
    }
    setLoading(false);
  }, []);

  const loadReviews = React.useCallback(async () => {
    setReviewsLoading(true);
    const { data } = await supabase
      .from('reviews')
      .select('*, author:author_id(username), subject:subject_id(username)')
      .eq('mode', 'contractor_to_customer')
      .order('created_at', { ascending: false });
    if (data) setReviews(data);
    setReviewsLoading(false);
  }, []);

  React.useEffect(() => {
    loadDisputes();
  }, []);

  React.useEffect(() => {
    if (activeTab === 'reviews') loadReviews();
  }, [activeTab]);

  const resolve = async (id: string, outcome: 'release_to_contractor' | 'refund_customer') => {
    if (!resolutionNote.trim()) {
      showAlert('Resolution Note Required', 'You must provide a resolution note before resolving a dispute.');
      return;
    }
    const label = outcome === 'release_to_contractor' ? 'Release to Contractor' : 'Refund Customer';
    showAlert(
      'Resolve Dispute',
      `${label}?\n\nNote: "${resolutionNote}"`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm', onPress: async () => {
            setResolving(true);
            const { error } = await supabase
              .from('disputes')
              .update({
                status: 'resolved',
                resolution_note: resolutionNote,
                resolution_outcome: outcome,
                resolved_by: user?.id,
                resolved_at: new Date().toISOString(),
              })
              .eq('id', id);

            if (error) {
              showAlert('Error', 'Failed to save resolution: ' + error.message);
            } else {
              setResolutionNote('');
              setSelected(null);
              await loadDisputes();
            }
            setResolving(false);
          },
        },
      ]
    );
  };

  const selectedDispute = disputes.find(d => d.id === selected);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textSecondary} />
        </Pressable>
        <View>
          <Text style={styles.title}>Admin</Text>
          <Text style={styles.subtitle}>Internal use only</Text>
        </View>
      </View>

      {/* Tab switcher */}
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.adminTab, activeTab === 'disputes' && styles.adminTabActive]}
          onPress={() => setActiveTab('disputes')}
        >
          <MaterialIcons name="gavel" size={14} color={activeTab === 'disputes' ? Colors.textInverse : Colors.textMuted} />
          <Text style={[styles.adminTabText, activeTab === 'disputes' && styles.adminTabTextActive]}>Disputes</Text>
        </Pressable>
        <Pressable
          style={[styles.adminTab, activeTab === 'reviews' && styles.adminTabActive]}
          onPress={() => setActiveTab('reviews')}
        >
          <MaterialIcons name="rate-review" size={14} color={activeTab === 'reviews' ? Colors.textInverse : Colors.textMuted} />
          <Text style={[styles.adminTabText, activeTab === 'reviews' && styles.adminTabTextActive]}>Client Reviews</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.adminBadge}>
          <MaterialIcons name="admin-panel-settings" size={16} color={Colors.warning} />
          <Text style={styles.adminText}>ADMIN PANEL — Not visible to regular users</Text>
        </View>

        {/* ── Reviews tab ─────────────────────────────────────── */}
        {activeTab === 'reviews' ? (
          reviewsLoading ? (
            <View style={styles.emptyState}><Text style={styles.emptyText}>Loading reviews...</Text></View>
          ) : reviews.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="rate-review" size={36} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No client reviews yet</Text>
            </View>
          ) : (
            reviews.map(r => (
              <View key={r.id} style={styles.reviewCard}>
                <View style={styles.reviewCardHeader}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={styles.reviewCardTitle}>
                      {r.author?.username || 'Contractor'} → {r.subject?.username || 'Customer'}
                    </Text>
                    <View style={[styles.statusBadge, r.status === 'published' ? styles.statusResolved : styles.statusOpen]}>
                      <Text style={[styles.statusText, r.status === 'published' ? styles.statusResolvedText : styles.statusOpenText]}>
                        {(r.status || 'published').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 3 }}>
                    <View style={{ flexDirection: 'row', gap: 2 }}>
                      {Array.from({ length: r.rating }).map((_: any, i: number) => (
                        <MaterialIcons key={i} name="star" size={13} color={Colors.warning} />
                      ))}
                    </View>
                    <Text style={styles.reviewDate}>{new Date(r.created_at).toLocaleDateString('en-GB')}</Text>
                  </View>
                </View>
                {r.tags && r.tags.length > 0 ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {r.tags.map((tag: string) => (
                      <View key={tag} style={styles.reviewTag}>
                        <Text style={styles.reviewTagText}>{tag.replace(/_/g, ' ')}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {r.private_note ? (
                  <View style={styles.privateNoteBox}>
                    <MaterialIcons name="lock" size={12} color={Colors.textMuted} />
                    <Text style={styles.privateNoteText}>Private note: {r.private_note}</Text>
                  </View>
                ) : null}
                {/* Moderation actions */}
                {r.status === 'published' ? (
                  <Pressable
                    style={styles.removeReviewBtn}
                    onPress={() => {
                      showAlert('Remove Review', 'Remove this review from the reliability score?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Remove', style: 'destructive', onPress: async () => {
                          await supabase.from('reviews').update({ status: 'removed' }).eq('id', r.id);
                          loadReviews();
                        }},
                      ]);
                    }}
                  >
                    <MaterialIcons name="delete-outline" size={14} color={Colors.error} />
                    <Text style={styles.removeReviewBtnText}>Remove review</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={styles.restoreReviewBtn}
                    onPress={async () => {
                      await supabase.from('reviews').update({ status: 'published' }).eq('id', r.id);
                      loadReviews();
                    }}
                  >
                    <MaterialIcons name="restore" size={14} color={Colors.primaryGlow} />
                    <Text style={styles.restoreReviewBtnText}>Restore</Text>
                  </Pressable>
                )}
              </View>
            ))
          )
        ) : null}

        {loading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Loading disputes...</Text>
          </View>
        ) : disputes.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="gavel" size={36} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No disputes yet</Text>
          </View>
        ) : (
          <>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{disputes.filter(d => d.status === 'open').length}</Text>
                <Text style={styles.statLabel}>OPEN</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{disputes.filter(d => d.status === 'resolved').length}</Text>
                <Text style={styles.statLabel}>RESOLVED</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>£{disputes.reduce((s, d) => s + d.amount, 0).toLocaleString()}</Text>
                <Text style={styles.statLabel}>TOTAL VALUE</Text>
              </View>
            </View>

            {disputes.map(dispute => (
              <Pressable
                key={dispute.id}
                style={[styles.card, selected === dispute.id && styles.cardSelected]}
                onPress={() => {
                  setSelected(selected === dispute.id ? null : dispute.id);
                  setResolutionNote('');
                }}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{dispute.job_title}</Text>
                    <View style={[styles.statusBadge, dispute.status === 'open' ? styles.statusOpen : styles.statusResolved]}>
                      <Text style={[styles.statusText, dispute.status === 'open' ? styles.statusOpenText : styles.statusResolvedText]}>
                        {dispute.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.cardAmount}>£{dispute.amount.toLocaleString()}</Text>
                </View>

                <View style={styles.partiesRow}>
                  <View style={styles.party}>
                    <MaterialIcons name="construction" size={13} color={Colors.textMuted} />
                    <Text style={styles.partyName}>{dispute.contractor_name}</Text>
                  </View>
                  <Text style={styles.vs}>vs</Text>
                  <View style={styles.party}>
                    <MaterialIcons name="person" size={13} color={Colors.textMuted} />
                    <Text style={styles.partyName}>{dispute.customer_name}</Text>
                  </View>
                </View>

                <View style={styles.filedRow}>
                  <Text style={styles.filedLabel}>FILED BY</Text>
                  <Text style={styles.filedValue}>{dispute.filed_by.toUpperCase()}</Text>
                  <Text style={styles.filedDate}>{new Date(dispute.created_at).toLocaleDateString('en-GB')}</Text>
                </View>

                {selected === dispute.id ? (
                  <View style={styles.expanded}>
                    <Text style={styles.reasonLabel}>REASON</Text>
                    <Text style={styles.reason}>{dispute.reason}</Text>

                    {dispute.resolution_note ? (
                      <View style={styles.resolution}>
                        <MaterialIcons name="check-circle" size={14} color={Colors.success} />
                        <View style={{ flex: 1, gap: 4 }}>
                          <Text style={styles.resolutionText}>{dispute.resolution_outcome === 'release_to_contractor' ? 'Released to contractor' : 'Refunded to customer'}</Text>
                          <Text style={styles.resolutionNote}>{dispute.resolution_note}</Text>
                          {dispute.resolved_at ? (
                            <Text style={styles.resolvedAt}>Resolved {new Date(dispute.resolved_at).toLocaleDateString('en-GB')}</Text>
                          ) : null}
                        </View>
                      </View>
                    ) : null}

                    {dispute.status === 'open' ? (
                      <View style={styles.resolutionForm}>
                        <Text style={styles.resolutionNoteLabel}>RESOLUTION NOTE (required)</Text>
                        <TextInput
                          style={styles.resolutionNoteInput}
                          value={resolutionNote}
                          onChangeText={setResolutionNote}
                          placeholder="Describe the decision and supporting evidence reviewed..."
                          placeholderTextColor={Colors.textMuted}
                          multiline
                          numberOfLines={3}
                          textAlignVertical="top"
                        />
                        <View style={styles.actions}>
                          <Pressable
                            style={[styles.actionBtn, styles.actionBtnRelease, !resolutionNote.trim() && styles.actionBtnDisabled]}
                            onPress={() => resolve(dispute.id, 'release_to_contractor')}
                            disabled={!resolutionNote.trim() || resolving}
                          >
                            <MaterialIcons name="construction" size={14} color={Colors.textInverse} />
                            <Text style={styles.actionBtnText}>Release to Contractor</Text>
                          </Pressable>
                          <Pressable
                            style={[styles.actionBtn, styles.actionBtnRefund, !resolutionNote.trim() && styles.actionBtnDisabled]}
                            onPress={() => resolve(dispute.id, 'refund_customer')}
                            disabled={!resolutionNote.trim() || resolving}
                          >
                            <MaterialIcons name="person" size={14} color={Colors.textInverse} />
                            <Text style={styles.actionBtnText}>Refund Customer</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { ...Typography.brandMD },
  subtitle: { ...Typography.labelSM },
  tabRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.md, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  adminTab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
  },
  adminTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  adminTabText: { ...Typography.labelMD, color: Colors.textMuted },
  adminTabTextActive: { color: Colors.textInverse, fontWeight: '600' },
  scroll: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 80 },
  adminBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.warningDim, borderRadius: Radius.md, padding: 12,
    borderWidth: 1, borderColor: Colors.warning, marginBottom: Spacing.sm,
  },
  adminText: { ...Typography.labelSM, color: Colors.warning },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { ...Typography.bodyMD, color: Colors.textMuted },
  statsRow: {
    flexDirection: 'row', backgroundColor: Colors.card,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: 14, marginBottom: Spacing.sm, gap: 8,
  },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { ...Typography.dataLG },
  statLabel: { ...Typography.labelXS },
  card: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 12,
  },
  cardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryDim },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  cardHeaderLeft: { flex: 1, gap: 6 },
  cardTitle: { ...Typography.dataMD },
  cardAmount: { ...Typography.dataLG, color: Colors.warning },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill, borderWidth: 1 },
  statusOpen: { backgroundColor: Colors.warningDim, borderColor: Colors.warning },
  statusResolved: { backgroundColor: Colors.successDim, borderColor: Colors.success },
  statusText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  statusOpenText: { color: Colors.warning },
  statusResolvedText: { color: Colors.success },
  partiesRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  party: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  partyName: { ...Typography.labelMD, flex: 1 },
  vs: { ...Typography.labelXS, color: Colors.textMuted },
  filedRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  filedLabel: { ...Typography.labelXS },
  filedValue: { ...Typography.labelSM, fontWeight: '700', color: Colors.textPrimary },
  filedDate: { ...Typography.labelSM, color: Colors.textMuted, marginLeft: 'auto' },
  expanded: { gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  reasonLabel: { ...Typography.labelXS },
  reason: { ...Typography.bodyMD, color: Colors.textSecondary, lineHeight: 20 },
  resolution: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: Colors.successDim, padding: 12, borderRadius: Radius.sm },
  resolutionText: { ...Typography.labelMD, color: Colors.success },
  resolutionNote: { ...Typography.labelSM, color: Colors.textSecondary },
  resolvedAt: { ...Typography.labelSM, color: Colors.textMuted },
  resolutionForm: { gap: 10 },
  resolutionNoteLabel: { ...Typography.labelXS },
  resolutionNoteInput: {
    backgroundColor: Colors.cardAlt, borderRadius: Radius.md, borderWidth: 1,
    borderColor: Colors.border, padding: 12, minHeight: 80,
    ...Typography.bodyMD, color: Colors.textPrimary,
  },
  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: 12, borderRadius: Radius.md,
  },
  actionBtnRelease: { backgroundColor: Colors.primary },
  actionBtnRefund: { backgroundColor: Colors.error },
  actionBtnDisabled: { opacity: 0.4 },
  actionBtnText: { ...Typography.btnSM, color: Colors.textInverse },
  // Review moderation
  reviewCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 10,
  },
  reviewCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  reviewCardTitle: { ...Typography.dataMD },
  reviewDate: { ...Typography.labelSM, color: Colors.textMuted },
  reviewTag: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill,
    backgroundColor: Colors.cardAlt, borderWidth: 1, borderColor: Colors.border,
  },
  reviewTagText: { fontSize: 10, color: Colors.textMuted, fontWeight: '500' },
  privateNoteBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: Colors.primaryDim, borderRadius: Radius.sm, padding: 10,
    borderWidth: 1, borderColor: Colors.primaryLight,
  },
  privateNoteText: { ...Typography.labelSM, color: Colors.textSecondary, flex: 1, lineHeight: 17 },
  removeReviewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: Radius.md, backgroundColor: Colors.errorDim, borderWidth: 1, borderColor: Colors.error,
  },
  removeReviewBtnText: { ...Typography.labelSM, color: Colors.error, fontWeight: '600' },
  restoreReviewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: Radius.md, backgroundColor: Colors.primaryDim, borderWidth: 1, borderColor: Colors.primaryLight,
  },
  restoreReviewBtnText: { ...Typography.labelSM, color: Colors.primaryGlow, fontWeight: '600' },
});
