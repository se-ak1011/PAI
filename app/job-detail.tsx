import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput, Modal, Linking,
} from 'react-native';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { findNearbyShops, shopMapsUrl, NearbyShop } from '@/services/shopsService';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { useJobs } from '@/hooks/useJobs';
import { useAuth } from '@/hooks/useAuth';
import { pickAndUploadJobPhoto, getJobPhotoUrls, deleteJobPhoto } from '@/services/photoService';
import { haptics } from '@/lib/haptics';
import { getSupabaseClient } from '@/template/core';
import { getConversation, ensureConversation } from '@/services/messageService';
import { useTaxPot } from '@/hooks/useTaxPot';
import { useAlert } from '@/template/ui';
import { JOB_STATUS_ACTIONS, PLATFORM_PRINCIPLES } from '@/constants/config';
import { CustomerReviewModal } from '@/components/feature/CustomerReviewModal';
import { useReliability } from '@/hooks/useReliability';
import { usePortfolio } from '@/hooks/usePortfolio';
import { ReliabilityBadge } from '@/components/ui/ReliabilityBadge';
import { MaterialIcons } from '@expo/vector-icons';

const STATUS_LABELS: Record<string, string> = {
  draft: 'DRAFT',
  sent: 'QUOTE SENT',
  accepted: 'ACCEPTED',
  in_progress: 'IN PROGRESS',
  contractor_marked_done: 'AWAITING INVOICE',
  invoiced: 'INVOICED',
  paid: 'PAID',
  cancelled: 'CANCELLED',
};

const STATUS_COLORS: Record<string, string> = {
  draft: Colors.textMuted,
  sent: Colors.info,
  accepted: Colors.primaryGlow,
  in_progress: Colors.primaryGlow,
  contractor_marked_done: Colors.warning,
  invoiced: Colors.warning,
  paid: Colors.success,
  cancelled: Colors.error,
};

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { privateJobs, updatePrivateJob, deletePrivateJob } = useJobs();
  const { addPAIJobIncome } = useTaxPot();
  const { user } = useAuth();
  const { createProjectFromCompletedJob } = usePortfolio();
  const { showAlert } = useAlert();

  const job = privateJobs.find(j => j.id === id);
  const [updating, setUpdating] = useState(false);
  const [messageBusy, setMessageBusy] = useState(false);

  // Open the message thread with the customer (marketplace-accepted jobs only).
  const handleMessageCustomer = async () => {
    if (!job?.source_job_post_id || !user?.id) return;
    setMessageBusy(true);
    // The conversation is created when the customer accepts; just open it.
    let convo = await getConversation(job.source_job_post_id, user.id);
    if (!convo) {
      // Legacy jobs accepted before messaging existed: fetch the customer and create it.
      const supabase = getSupabaseClient();
      const { data: post } = await supabase
        .from('job_posts').select('client_id').eq('id', job.source_job_post_id).maybeSingle();
      if (post?.client_id) {
        const res = await ensureConversation({ jobPostId: job.source_job_post_id, customerId: post.client_id, contractorId: user.id });
        convo = res.conversation;
      }
    }
    setMessageBusy(false);
    if (convo) {
      router.push({ pathname: '/chat', params: { id: convo.id, title: job.customer || 'Customer' } });
    } else {
      showAlert('Messaging unavailable', 'The chat will be available once the customer opens it from their side.');
    }
  };

  // Progress photos: resolve private storage paths -> temporary signed URLs.
  const photoPaths = job?.progress_photos ?? [];
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [photoBusy, setPhotoBusy] = useState(false);
  React.useEffect(() => {
    let active = true;
    if (photoPaths.length === 0) { setPhotoUrls({}); return; }
    (async () => {
      const urls = await getJobPhotoUrls(photoPaths);
      if (!active) return;
      const map: Record<string, string> = {};
      photoPaths.forEach((p, i) => { const u = urls[i]; if (u) map[p] = u; });
      setPhotoUrls(map);
    })();
    return () => { active = false; };
  }, [photoPaths.join('|')]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  // Actual hours prompt for hourly jobs
  const [showHoursPrompt, setShowHoursPrompt] = useState(false);
  const [actualHoursStr, setActualHoursStr] = useState('');
  // Shops near me
  const [showShops, setShowShops] = useState(false);
  const [shops, setShops] = useState<NearbyShop[]>([]);
  const [shopsLoading, setShopsLoading] = useState(false);

  // Reliability score — look up customer on PAI-marketplace jobs (have source_job_post_id + client_id)
  const [customerId, setCustomerId] = React.useState<string | null>(null);
  const { score: reliabilityScore } = useReliability(customerId);

  // Fetch customer user_id for marketplace-originated jobs
  React.useEffect(() => {
    if (!job?.source_job_post_id) return;
    const supabase = getSupabaseClient();
    supabase
      .from('job_posts')
      .select('client_id')
      .eq('id', job.source_job_post_id)
      .maybeSingle()
      .then(({ data }) => { if (data?.client_id) setCustomerId(data.client_id); });
  }, [job?.source_job_post_id]);

  if (!job) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Job not found</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backLink}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const nextAction = JOB_STATUS_ACTIONS[job.status];
  const statusColor = STATUS_COLORS[job.status] ?? Colors.textMuted;
  const statusLabel = STATUS_LABELS[job.status] ?? job.status.toUpperCase();

  const handleStatusUpdate = async () => {
    if (!nextAction) return;

    // "Send Invoice" — for hourly jobs, prompt for actual hours first
    if (nextAction.next === 'invoiced' && job.job_type === 'hourly') {
      setActualHoursStr(job.estimated_hours ? String(job.estimated_hours) : '');
      setShowHoursPrompt(true);
      return;
    }

    // "Send Invoice" — update status then open invoice screen
    if (nextAction.next === 'invoiced') {
      setUpdating(true);
      await updatePrivateJob(job.id, {
        status: 'invoiced',
        invoiced_at: new Date().toISOString().split('T')[0],
      });
      setUpdating(false);
      router.push({ pathname: '/invoice', params: { id: job.id } });
      return;
    }

    setUpdating(true);
    const updates: Record<string, unknown> = { status: nextAction.next };
    if (nextAction.next === 'paid') {
      updates.paid_at = new Date().toISOString().split('T')[0];
      await updatePrivateJob(job.id, updates);
      // Auto-add to Tax Pot
      await addPAIJobIncome({
        job_id: job.id,
        job_title: job.title,
        customer_name: job.customer || '',
        amount: job.total,
        date_completed: updates.paid_at as string,
      });
      setUpdating(false);
      showAlert('Payment Recorded', 'Income added to your Tax Pot.');
      return;
    }
    await updatePrivateJob(job.id, updates);
    setUpdating(false);
  };

  const handleConfirmActualHours = async () => {
    const actualHours = parseFloat(actualHoursStr) || 0;
    if (actualHours <= 0) {
      showAlert('Required', 'Please enter the actual hours worked.');
      return;
    }
    const hourlyRate = job.hourly_rate || 0;
    const newLabour = actualHours * hourlyRate;
    const newVat = job.vat > 0 ? Math.round((newLabour + job.materials) * 0.2 * 100) / 100 : 0;
    const newTotal = newLabour + job.materials + newVat;
    const today = new Date().toISOString().split('T')[0];

    setShowHoursPrompt(false);
    setUpdating(true);
    await updatePrivateJob(job.id, {
      status: 'invoiced',
      invoiced_at: today,
      actual_hours: actualHours,
      labour: newLabour,
      vat: newVat,
      total: newTotal,
    });
    setUpdating(false);
    router.push({ pathname: '/invoice', params: { id: job.id } });
  };

  const doAddPhoto = async (source: 'camera' | 'library') => {
    if (!user?.id || !job) return;
    setPhotoBusy(true);
    const { path, error, cancelled } = await pickAndUploadJobPhoto(user.id, job.id, source);
    setPhotoBusy(false);
    if (cancelled) return;
    if (error || !path) { haptics.error(); showAlert('Upload failed', error || 'Could not upload the photo.'); return; }
    await updatePrivateJob(job.id, { progress_photos: [...(job.progress_photos ?? []), path] });
    haptics.success();
  };

  const handleAddPhoto = () => {
    showAlert('Add progress photo', 'Attach a photo of the work to this job.', [
      { text: 'Take photo', onPress: () => doAddPhoto('camera') },
      { text: 'Choose from library', onPress: () => doAddPhoto('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleDeletePhoto = (path: string) => {
    showAlert('Remove photo', 'Remove this photo from the job?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          await deleteJobPhoto(path);
          if (job) await updatePrivateJob(job.id, { progress_photos: (job.progress_photos ?? []).filter(p => p !== path) });
        },
      },
    ]);
  };

  const handleCreatePortfolioProject = async () => {
    const project = await createProjectFromCompletedJob(job);
    if (!project) {
      haptics.error();
      showAlert('Portfolio project', 'Could not create a portfolio project from this job.');
      return;
    }
    haptics.success();
    showAlert(
      'Portfolio draft created',
      'All job photos were linked to a new verified Portfolio Project. Open your Portfolio to choose photos, set the cover, reorder, and edit the AI-generated description before publishing.',
      [
        { text: 'Later', style: 'cancel' },
        { text: 'Open Portfolio', onPress: () => router.push('/(tabs)/profile') },
      ],
    );
  };

  const handlePortfolioPrompt = () => {
    showAlert('Add this project to your Portfolio?', 'Create a verified Portfolio Project from this completed job using its existing photos. No duplicate uploads are needed.', [
      { text: 'Not now', style: 'cancel' },
      { text: 'Yes', onPress: handleCreatePortfolioProject },
    ]);
  };

  const toggleMaterial = (index: number) => {
    if (!job) return;
    haptics.select();
    const items = (job.materials_items || []).map((m, i) => i === index ? { ...m, got: !m.got } : m);
    updatePrivateJob(job.id, { materials_items: items });
  };

  const handleFindShops = async () => {
    setShowShops(true);
    setShopsLoading(true);
    setShops([]);
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) {
      setShopsLoading(false);
      showAlert('Location needed', 'Allow location access to find trade shops near you.');
      return;
    }
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { shops: found, error } = await findNearbyShops(pos.coords.latitude, pos.coords.longitude);
      setShopsLoading(false);
      if (error) { haptics.warn(); showAlert('Lookup failed', error); return; }
      setShops(found);
      if (found.length === 0) showAlert('No shops found', 'No trade shops found nearby. Try again from a different spot.');
    } catch {
      setShopsLoading(false);
      showAlert('Location error', 'Could not get your location. Try again.');
    }
  };

  const handleDelete = () => {
    showAlert('Delete Job', 'This will permanently delete this job. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deletePrivateJob(job.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textSecondary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{job.title}</Text>
          <View style={[styles.statusBadge, { borderColor: statusColor + '60', backgroundColor: statusColor + '1A' }]}>
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>
        <Pressable onPress={handleDelete} hitSlop={8}>
          <MaterialIcons name="delete-outline" size={22} color={Colors.error} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Customer & Dates */}
        <View style={styles.metaCard}>
          <View style={styles.metaRow}>
            <MaterialIcons name="person" size={16} color={Colors.textMuted} />
            <Text style={styles.metaLabel}>CUSTOMER</Text>
            <Text style={styles.metaValue}>{job.customer}</Text>
          </View>
          <View style={styles.metaRow}>
            <MaterialIcons name="calendar-today" size={16} color={Colors.textMuted} />
            <Text style={styles.metaLabel}>CREATED</Text>
            <Text style={styles.metaValue}>{new Date(job.created_at).toLocaleDateString('en-GB')}</Text>
          </View>
          {job.invoiced_at ? (
            <View style={styles.metaRow}>
              <MaterialIcons name="receipt" size={16} color={Colors.warning} />
              <Text style={styles.metaLabel}>INVOICED</Text>
              <Text style={styles.metaValue}>{job.invoiced_at}</Text>
            </View>
          ) : null}
          {job.paid_at ? (
            <View style={styles.metaRow}>
              <MaterialIcons name="check-circle" size={16} color={Colors.success} />
              <Text style={styles.metaLabel}>PAID</Text>
              <Text style={[styles.metaValue, { color: Colors.success }]}>{job.paid_at}</Text>
            </View>
          ) : null}
          {job.source_job_post_id ? (
            <View style={styles.metaRow}>
              <MaterialIcons name="storefront" size={16} color={Colors.primaryGlow} />
              <Text style={styles.metaLabel}>SOURCE</Text>
              <Text style={[styles.metaValue, { color: Colors.primaryGlow }]}>PAI Marketplace</Text>
            </View>
          ) : null}
        </View>

        {/* Message the customer — only for marketplace-accepted jobs (a real customer account) */}
        {job.source_job_post_id ? (
          <Pressable style={styles.messageCustomerBtn} onPress={handleMessageCustomer} disabled={messageBusy}>
            {messageBusy ? (
              <ActivityIndicator size="small" color={Colors.primaryGlow} />
            ) : (
              <>
                <MaterialIcons name="chat-bubble-outline" size={18} color={Colors.primaryGlow} />
                <Text style={styles.messageCustomerText}>Message {job.customer || 'customer'}</Text>
              </>
            )}
          </Pressable>
        ) : null}

        {/* Status timeline */}
        <View style={styles.timeline}>
          {['draft', 'sent', 'accepted', 'in_progress', 'contractor_marked_done', 'invoiced', 'paid'].map((s, i) => {
            const statuses = ['draft', 'sent', 'accepted', 'in_progress', 'contractor_marked_done', 'invoiced', 'paid'];
            const currentIdx = statuses.indexOf(job.status);
            const isDone = i < currentIdx;
            const isCurrent = s === job.status;
            return (
              <View key={s} style={styles.timelineItem}>
                <View style={[styles.timelineDot, isDone && styles.timelineDotDone, isCurrent && styles.timelineDotCurrent]}>
                  {isDone ? <MaterialIcons name="check" size={10} color={Colors.textInverse} /> : null}
                </View>
                <Text style={[styles.timelineLabel, isCurrent && styles.timelineLabelCurrent, isDone && styles.timelineLabelDone]}>
                  {STATUS_LABELS[s] ?? s}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Description */}
        {job.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Scope of Work</Text>
            <Text style={styles.description}>{job.description}</Text>
          </View>
        ) : null}

        {/* Progress photos */}
        <View style={styles.section}>
          <View style={styles.photoHeader}>
            <Text style={styles.sectionTitle}>Progress Photos</Text>
            <Pressable style={styles.addPhotoBtn} onPress={handleAddPhoto} disabled={photoBusy} hitSlop={8}>
              {photoBusy ? (
                <ActivityIndicator size="small" color={Colors.primaryGlow} />
              ) : (
                <>
                  <MaterialIcons name="add-a-photo" size={15} color={Colors.primaryGlow} />
                  <Text style={styles.addPhotoBtnText}>Add</Text>
                </>
              )}
            </Pressable>
          </View>
          {photoPaths.length === 0 ? (
            <Text style={styles.photoEmpty}>No photos yet. Snap before/after shots to document the work.</Text>
          ) : (
            <>
              <View style={styles.photoGrid}>
                {photoPaths.map(p => (
                  <Pressable key={p} onLongPress={() => handleDeletePhoto(p)} style={styles.photoThumb}>
                    {photoUrls[p] ? (
                      <Image source={{ uri: photoUrls[p] }} style={styles.photoImg} contentFit="cover" transition={150} />
                    ) : (
                      <View style={styles.photoLoading}><ActivityIndicator size="small" color={Colors.textMuted} /></View>
                    )}
                  </Pressable>
                ))}
              </View>
              <Text style={styles.photoHint}>Long-press a photo to remove it.</Text>
            </>
          )}
        </View>

        {/* Completed job portfolio prompt */}
        {job.status === 'paid' && photoPaths.length > 0 ? (
          <View style={styles.portfolioPromptCard}>
            <View style={styles.portfolioPromptIcon}>
              <MaterialIcons name="workspace-premium" size={20} color={Colors.primaryGlow} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.portfolioPromptTitle}>Add this project to your Portfolio?</Text>
              <Text style={styles.portfolioPromptText}>Use these job photos to create a verified project draft without uploading them again.</Text>
            </View>
            <Pressable style={styles.portfolioPromptBtn} onPress={handlePortfolioPrompt}>
              <Text style={styles.portfolioPromptBtnText}>Yes</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Client reliability — visible only for marketplace-sourced jobs */}
        {job.source_job_post_id && reliabilityScore ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Client Reliability</Text>
            <ReliabilityBadge score={reliabilityScore} size="md" />
          </View>
        ) : null}

        {/* Contractor protection notice */}
        <View style={styles.protectionCard}>
          <MaterialIcons name="verified" size={15} color={Colors.primaryGlow} />
          <Text style={styles.protectionText}>{PLATFORM_PRINCIPLES.NO_COMMISSION}</Text>
        </View>

        {/* Financial breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {job.job_type === 'hourly' ? 'Hourly Estimate Breakdown' : 'Quote Breakdown'}
          </Text>
          <View style={styles.breakdownCard}>
            {job.job_type === 'hourly' ? (
              <>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>
                    {job.actual_hours != null
                      ? `Labour (${job.actual_hours} hrs × £${job.hourly_rate}/hr)`
                      : `Labour est. (~${job.estimated_hours ?? '?'} hrs × £${job.hourly_rate ?? '?'}/hr)`}
                  </Text>
                  <Text style={styles.breakdownValue}>£{job.labour.toLocaleString()}</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Materials</Text>
                  <Text style={styles.breakdownValue}>£{job.materials.toLocaleString()}</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>VAT (20%)</Text>
                  <Text style={styles.breakdownValue}>£{job.vat.toLocaleString()}</Text>
                </View>
                <View style={styles.breakdownDivider} />
                <View style={styles.breakdownRow}>
                  <Text style={styles.totalLabel}>
                    {job.actual_hours != null ? 'INVOICE TOTAL' : 'ESTIMATE TOTAL'}
                  </Text>
                  <Text style={styles.totalValue}>£{job.total.toLocaleString()}</Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Labour</Text>
                  <Text style={styles.breakdownValue}>£{job.labour.toLocaleString()}</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Materials</Text>
                  <Text style={styles.breakdownValue}>£{job.materials.toLocaleString()}</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>VAT (20%)</Text>
                  <Text style={styles.breakdownValue}>£{job.vat.toLocaleString()}</Text>
                </View>
                <View style={styles.breakdownDivider} />
                <View style={styles.breakdownRow}>
                  <Text style={styles.totalLabel}>TOTAL</Text>
                  <Text style={styles.totalValue}>£{job.total.toLocaleString()}</Text>
                </View>
              </>
            )}
          </View>

          {/* View Estimate button for hourly pre-invoice jobs */}
          {job.job_type === 'hourly' && !['invoiced', 'paid'].includes(job.status) ? (
            <Pressable
              style={styles.viewEstimateBtn}
              onPress={() => router.push({ pathname: '/invoice', params: { id: job.id } })}
            >
              <MaterialIcons name="description" size={16} color={Colors.info} />
              <Text style={styles.viewEstimateBtnText}>View & Share Estimate</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Shopping list (materials, checkable) */}
        {job.materials_items && job.materials_items.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.photoHeader}>
              <Text style={styles.sectionTitle}>
                Shopping List ({job.materials_items.filter((m: any) => m.got).length}/{job.materials_items.length})
              </Text>
              <Pressable style={styles.shopsBtn} onPress={handleFindShops} hitSlop={8}>
                <MaterialIcons name="store" size={15} color={Colors.primaryGlow} />
                <Text style={styles.shopsBtnText}>Shops near me</Text>
              </Pressable>
            </View>
            {job.materials_items.map((item: any, i: number) => (
              <Pressable key={i} style={styles.materialRow} onPress={() => toggleMaterial(i)}>
                <MaterialIcons
                  name={item.got ? 'check-box' : 'check-box-outline-blank'}
                  size={20}
                  color={item.got ? Colors.success : Colors.textMuted}
                />
                <Text style={[styles.materialName, item.got && styles.materialNameDone]}>{item.name}</Text>
                <Text style={styles.materialQty}>{item.qty} {item.unit || '×'}</Text>
                <Text style={styles.materialPrice}>
                  £{(item.estimatedPrice ?? (item.qty * (item.price ?? 0))).toFixed(2)}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {/* Shops near me modal */}
      <Modal visible={showShops} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowShops(false)}>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <Pressable onPress={() => setShowShops(false)} hitSlop={8} style={styles.backBtn}>
              <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
            </Pressable>
            <View style={styles.headerCenter}><Text style={styles.headerTitle}>Trade shops near you</Text></View>
            <View style={{ width: 36 }} />
          </View>
          <ScrollView contentContainerStyle={styles.scroll}>
            {shopsLoading ? (
              <View style={{ alignItems: 'center', paddingVertical: 50, gap: 12 }}>
                <ActivityIndicator color={Colors.primaryGlow} size="large" />
                <Text style={styles.materialQty}>Finding shops near you…</Text>
              </View>
            ) : (
              shops.map((s, i) => (
                <Pressable key={i} style={styles.shopRow} onPress={() => Linking.openURL(shopMapsUrl(s))}>
                  <View style={styles.shopIcon}><MaterialIcons name="store" size={18} color={Colors.primaryGlow} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.materialName}>{s.name}</Text>
                    <Text style={styles.materialQty}>{s.distanceKm.toFixed(1)} km away · tap for directions</Text>
                  </View>
                  <MaterialIcons name="directions" size={20} color={Colors.textMuted} />
                </Pressable>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Action Footer */}
      {nextAction ? (
        <View style={styles.footer}>
          {/* Show View Invoice button alongside for invoiced state */}
          {job.status === 'invoiced' ? (
            <Pressable
              style={styles.viewInvoiceBtn}
              onPress={() => router.push({ pathname: '/invoice', params: { id: job.id } })}
            >
              <MaterialIcons name="receipt" size={18} color={Colors.primaryGlow} />
              <Text style={styles.viewInvoiceBtnText}>View Invoice</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={[styles.actionBtn, updating && styles.actionBtnDisabled]}
            onPress={handleStatusUpdate}
            disabled={updating}
          >
            {updating ? (
              <ActivityIndicator size="small" color={Colors.textInverse} />
            ) : (
              <>
                <MaterialIcons
                  name={nextAction.next === 'invoiced' ? 'receipt' : 'arrow-forward'}
                  size={18}
                  color={Colors.textInverse}
                />
                <Text style={styles.actionBtnText}>{nextAction.label}</Text>
              </>
            )}
          </Pressable>
        </View>
      ) : job.status === 'paid' ? (
        <View style={styles.footer}>
          <Pressable
            style={styles.viewInvoiceBtn}
            onPress={() => router.push({ pathname: '/invoice', params: { id: job.id } })}
          >
            <MaterialIcons name="receipt" size={18} color={Colors.primaryGlow} />
            <Text style={styles.viewInvoiceBtnText}>View Invoice</Text>
          </Pressable>
          <View style={[styles.paidBanner, { flex: 1 }]}>
            <MaterialIcons name="check-circle" size={20} color={Colors.success} />
            <Text style={styles.paidText}>Payment received</Text>
          </View>
        </View>
      ) : null}

      {/* Review customer — only for paid marketplace jobs */}
      {job.status === 'paid' && job.source_job_post_id && customerId ? (
        <Pressable
          style={styles.reviewCustomerBtn}
          onPress={() => setShowReviewModal(true)}
        >
          <MaterialIcons name="rate-review" size={16} color={Colors.textMuted} />
          <Text style={styles.reviewCustomerText}>Leave a client review</Text>
        </Pressable>
      ) : null}

      {job.source_job_post_id && customerId ? (
        <CustomerReviewModal
          visible={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          jobPostId={job.source_job_post_id}
          customerId={customerId}
          customerName={job.customer || 'Customer'}
          jobTitle={job.title}
        />
      ) : null}

      {/* Actual hours prompt for hourly invoicing */}
      {showHoursPrompt ? (
        <Pressable style={styles.promptOverlay} onPress={() => setShowHoursPrompt(false)}>
          <Pressable style={styles.promptCard} onPress={(e) => e.stopPropagation?.()}>
            <View style={styles.promptHeader}>
              <MaterialIcons name="schedule" size={20} color={Colors.primaryGlow} />
              <Text style={styles.promptTitle}>Enter Actual Hours</Text>
            </View>
            <Text style={styles.promptSub}>
              How many hours did you actually work on this job?
              {job.estimated_hours ? ` (Estimated: ${job.estimated_hours} hrs)` : ''}
            </Text>
            <View style={styles.promptInputWrap}>
              <TextInput
                style={styles.promptInput}
                value={actualHoursStr}
                onChangeText={setActualHoursStr}
                keyboardType="decimal-pad"
                placeholder="e.g. 8"
                placeholderTextColor={Colors.textMuted}
                autoFocus
              />
              <Text style={styles.promptInputUnit}>hrs</Text>
            </View>
            {job.hourly_rate && parseFloat(actualHoursStr) > 0 ? (
              <Text style={styles.promptCalc}>
                Labour: {parseFloat(actualHoursStr)} hrs × £{job.hourly_rate}/hr = £{(parseFloat(actualHoursStr) * job.hourly_rate).toFixed(2)}
              </Text>
            ) : null}
            <View style={styles.promptBtns}>
              <Pressable style={styles.promptCancel} onPress={() => setShowHoursPrompt(false)}>
                <Text style={styles.promptCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.promptConfirm} onPress={handleConfirmActualHours}>
                <Text style={styles.promptConfirmText}>Create Invoice</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  notFoundText: { ...Typography.headingMD },
  backLink: { ...Typography.labelMD, color: Colors.primaryLight },
  protectionCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: Colors.primaryDim, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.primaryLight, padding: 12,
  },
  protectionText: { ...Typography.labelSM, color: Colors.primaryGlow, flex: 1, lineHeight: 18 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1, gap: 4 },
  headerTitle: { ...Typography.headingMD },
  statusBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: Radius.pill, borderWidth: 1,
  },
  statusBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  scroll: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 120 },
  metaCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1,
    borderColor: Colors.border, padding: 16, gap: 12,
  },
  messageCustomerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1,
    borderColor: Colors.border, paddingVertical: 13,
  },
  messageCustomerText: { ...Typography.btnSM, color: Colors.primaryGlow },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaLabel: { ...Typography.labelXS, width: 80 },
  metaValue: { ...Typography.bodyMD, flex: 1 },
  // Timeline
  timeline: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  timelineItem: { flex: 1, alignItems: 'center', gap: 4 },
  timelineDot: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.cardAlt, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  timelineDotDone: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  timelineDotCurrent: { borderColor: Colors.primaryGlow, borderWidth: 2 },
  timelineLabel: { fontSize: 8, fontWeight: '500', color: Colors.textMuted, textAlign: 'center', letterSpacing: 0.3 },
  timelineLabelCurrent: { color: Colors.primaryGlow },
  timelineLabelDone: { color: Colors.textSecondary },
  section: { gap: 12 },
  sectionTitle: { ...Typography.headingMD },
  description: { ...Typography.bodyMD, color: Colors.textSecondary, lineHeight: 22 },
  photoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addPhotoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 56, justifyContent: 'center',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.pill,
    backgroundColor: Colors.primaryDim, borderWidth: 1, borderColor: Colors.primaryLight,
  },
  addPhotoBtnText: { ...Typography.labelSM, color: Colors.primaryGlow },
  photoEmpty: { ...Typography.bodySM, color: Colors.textMuted, lineHeight: 20 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoThumb: {
    width: 96, height: 96, borderRadius: Radius.md, overflow: 'hidden',
    backgroundColor: Colors.cardAlt, borderWidth: 1, borderColor: Colors.border,
  },
  photoImg: { width: '100%', height: '100%' },
  photoLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  photoHint: { ...Typography.labelXS, color: Colors.textMuted },
  portfolioPromptCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1,
    borderColor: Colors.primaryLight, padding: 14,
  },
  portfolioPromptIcon: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primaryDim,
  },
  portfolioPromptTitle: { ...Typography.labelMD, color: Colors.textPrimary },
  portfolioPromptText: { ...Typography.bodySM, color: Colors.textSecondary, lineHeight: 18 },
  portfolioPromptBtn: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
  },
  portfolioPromptBtnText: { ...Typography.btnSM, color: Colors.textInverse },
  breakdownCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1,
    borderColor: Colors.border, padding: 16, gap: 10,
  },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between' },
  breakdownLabel: { ...Typography.labelMD, color: Colors.textSecondary },
  breakdownValue: { ...Typography.dataMD },
  breakdownDivider: { height: 1, backgroundColor: Colors.border },
  totalLabel: { ...Typography.labelMD, fontWeight: '700' },
  totalValue: { ...Typography.dataLG },
  materialRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.card, borderRadius: Radius.sm, padding: 12,
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  materialName: { ...Typography.bodyMD, flex: 1 },
  materialNameDone: { color: Colors.textMuted, textDecorationLine: 'line-through' },
  materialQty: { ...Typography.labelMD, color: Colors.textMuted },
  materialPrice: { ...Typography.dataMD },
  shopsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.pill,
    backgroundColor: Colors.primaryDim, borderWidth: 1, borderColor: Colors.primaryLight,
  },
  shopsBtnText: { ...Typography.labelSM, color: Colors.primaryGlow },
  shopRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.card, borderRadius: Radius.md, padding: 14,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 8,
  },
  shopIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primaryDim, alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', gap: 10, padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.bg },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    height: 54, backgroundColor: Colors.primary, borderRadius: Radius.lg,
  },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { ...Typography.btnMD, color: Colors.textInverse },
  viewInvoiceBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 54, paddingHorizontal: 16,
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
  },
  viewInvoiceBtnText: { ...Typography.btnSM, color: Colors.primaryGlow },
  paidBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Colors.successDim, borderRadius: Radius.md, padding: 14,
  },
  paidText: { ...Typography.dataMD, color: Colors.success },
  reviewCustomerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: 12, marginHorizontal: Spacing.md, marginBottom: 4,
  },
  reviewCustomerText: { ...Typography.labelSM, color: Colors.textMuted },

  // View Estimate button
  viewEstimateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.info + '44',
    backgroundColor: Colors.infoDim, padding: 12, marginTop: 8,
  },
  viewEstimateBtnText: { ...Typography.labelMD, color: Colors.info },

  // Actual hours prompt overlay
  promptOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 200, padding: Spacing.md,
  },
  promptCard: {
    width: '100%', backgroundColor: Colors.card, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border, padding: 20, gap: 14,
  },
  promptHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  promptTitle: { ...Typography.headingMD },
  promptSub: { ...Typography.bodyMD, color: Colors.textSecondary, lineHeight: 22 },
  promptInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.cardAlt, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14,
  },
  promptInput: {
    flex: 1, height: 52, ...Typography.dataLG, color: Colors.textPrimary,
  },
  promptInputUnit: { ...Typography.labelMD, color: Colors.textMuted },
  promptCalc: { ...Typography.labelMD, color: Colors.primaryGlow },
  promptBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  promptCancel: {
    flex: 1, height: 48, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.cardAlt, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  promptCancelText: { ...Typography.btnSM, color: Colors.textSecondary },
  promptConfirm: {
    flex: 2, height: 48, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primary, borderRadius: Radius.md,
  },
  promptConfirmText: { ...Typography.btnMD, color: Colors.textInverse },
});
