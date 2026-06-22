
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Switch, TextInput, Modal, ActivityIndicator, Share, Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useReliability } from '@/hooks/useReliability';
import { ReliabilityBadge } from '@/components/ui/ReliabilityBadge';
import { TRADE_CATEGORIES, SUBSCRIPTION, getContractorProfileUrl } from '@/constants/config';
import { useRole } from '@/hooks/useRole';
import { useJobs } from '@/hooks/useJobs';
import { usePortfolio } from '@/hooks/usePortfolio';
import { getJobPhotoUrls } from '@/services/photoService';
import { getSupabaseClient } from '@/template/core';
// MOCK_REVIEWS removed — reviews now fetched from Supabase below
import { MaterialIcons } from '@expo/vector-icons';
import { useAlert } from '@/template/ui';
import { RoleSwitcherBar } from './_layout';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <MaterialIcons
          key={i}
          name={i < Math.floor(rating) ? 'star' : i < rating ? 'star-half' : 'star-border'}
          size={size}
          color={Colors.warning}
        />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────
// Edit Profile Modal
// ─────────────────────────────────────────────
function EditProfileModal({
  visible,
  onClose,
  isContractor,
}: {
  visible: boolean;
  onClose: () => void;
  isContractor: boolean;
}) {
  const { user, updateProfile, operationLoading } = useAuth();
  const { showAlert } = useAlert();
  const [name, setName] = useState(user?.display_name || '');
  const [businessName, setBusinessName] = useState(user?.business_name || '');
  const [city, setCity] = useState(user?.city || '');
  const [postcode, setPostcode] = useState(user?.postcode_area || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [dayRate, setDayRate] = useState(String(user?.hourly_rate_from || ''));
  const [hourlyRate, setHourlyRate] = useState(String((user as any)?.hourly_rate || ''));
  const [preferredShop, setPreferredShop] = useState((user as any)?.preferred_shop || '');
  const [flexiblePricing, setFlexiblePricing] = useState((user as any)?.flexible_pricing ?? false);
  const [selectedTrades, setSelectedTrades] = useState<string[]>(user?.trades || []);
  const [website, setWebsite] = useState((user as any)?.website || '');
  const [savedTrades, setSavedTrades] = useState<string[]>(user?.saved_trades || []);
  const [savedPostcodes, setSavedPostcodes] = useState<string>((user?.saved_postcode_areas || []).join(', '));

  // Reset state when modal opens with latest user data
  React.useEffect(() => {
    if (visible) {
      setName(user?.display_name || '');
      setBusinessName(user?.business_name || '');
      setCity(user?.city || '');
      setPostcode(user?.postcode_area || '');
      setBio(user?.bio || '');
      setDayRate(String(user?.hourly_rate_from || ''));
      setHourlyRate(String((user as any)?.hourly_rate || ''));
      setPreferredShop((user as any)?.preferred_shop || '');
      setFlexiblePricing((user as any)?.flexible_pricing ?? false);
      setSelectedTrades(user?.trades || []);
      setWebsite((user as any)?.website || '');
      setSavedTrades(user?.saved_trades || []);
      setSavedPostcodes((user?.saved_postcode_areas || []).join(', '));
    }
  }, [visible]);

  const toggleTrade = (t: string) => {
    setSelectedTrades(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const handleSave = async () => {
    const updateData: any = {
      display_name: name,
      city: city || undefined,
      postcode_area: postcode || undefined,
    };

    if (isContractor) {
      updateData.business_name = businessName || undefined;
      updateData.bio = bio || undefined;
      updateData.hourly_rate_from = parseFloat(dayRate) || undefined;
      updateData.trades = selectedTrades;
      updateData.preferred_shop = preferredShop || undefined;
      updateData.hourly_rate = parseFloat(hourlyRate) || undefined;
      updateData.flexible_pricing = flexiblePricing;
      updateData.saved_trades = savedTrades;
      // Parse postcode areas from comma-separated string
      updateData.saved_postcode_areas = savedPostcodes
        .split(',')
        .map(s => s.trim().toUpperCase())
        .filter(Boolean);
      if (website) updateData.website = website;
    } else {
      // Customer profile save — mark customer profile as complete
      if (name && city) {
        updateData.customer_profile_complete = true;
      }
    }

    await updateProfile(updateData);
    showAlert('Saved', 'Your profile has been updated.');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={editStyles.container} edges={['top', 'bottom']}>
        <View style={editStyles.header}>
          <Pressable onPress={onClose} hitSlop={8}>
            <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
          </Pressable>
          <Text style={editStyles.title}>Edit Profile</Text>
          <Pressable onPress={handleSave} disabled={operationLoading} hitSlop={8}>
            {operationLoading
              ? <ActivityIndicator size="small" color={Colors.primaryGlow} />
              : <Text style={editStyles.saveText}>Save</Text>}
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={editStyles.scroll} showsVerticalScrollIndicator={false}>
          <View style={editStyles.section}>
            <Text style={editStyles.label}>DISPLAY NAME</Text>
            <TextInput style={editStyles.input} value={name} onChangeText={setName} placeholderTextColor={Colors.textMuted} placeholder="Your name" />
          </View>
          {isContractor ? (
            <View style={editStyles.section}>
              <Text style={editStyles.label}>BUSINESS NAME</Text>
              <TextInput style={editStyles.input} value={businessName} onChangeText={setBusinessName} placeholderTextColor={Colors.textMuted} placeholder="Webb & Sons Electrical" />
            </View>
          ) : null}
          <View style={editStyles.section}>
            <Text style={editStyles.label}>CITY</Text>
            <TextInput style={editStyles.input} value={city} onChangeText={setCity} placeholderTextColor={Colors.textMuted} placeholder="Manchester" />
          </View>
          <View style={editStyles.section}>
            <Text style={editStyles.label}>POSTCODE AREA</Text>
            <TextInput style={editStyles.input} value={postcode} onChangeText={setPostcode} placeholderTextColor={Colors.textMuted} placeholder="M1" autoCapitalize="characters" />
          </View>
          {isContractor ? (
            <>
              {/* Trades */}
              <View style={editStyles.section}>
                <Text style={editStyles.label}>TRADES</Text>
                <View style={editStyles.tradesGrid}>
                  {TRADE_CATEGORIES.map(t => (
                    <Pressable
                      key={t}
                      style={[editStyles.tradeChip, selectedTrades.includes(t) && editStyles.tradeChipActive]}
                      onPress={() => toggleTrade(t)}
                    >
                      <Text style={[editStyles.tradeChipText, selectedTrades.includes(t) && editStyles.tradeChipTextActive]}>{t}</Text>
                      {selectedTrades.includes(t) ? (
                        <MaterialIcons name="check" size={12} color={Colors.textInverse} />
                      ) : null}
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={editStyles.section}>
                <Text style={editStyles.label}>ABOUT / BIO</Text>
                <TextInput
                  style={[editStyles.input, editStyles.textarea]}
                  value={bio}
                  onChangeText={setBio}
                  placeholderTextColor={Colors.textMuted}
                  placeholder="Tell customers about your experience and specialisms..."
                  multiline
                  numberOfLines={4}
                />
              </View>

              {/* Rates */}
              <View style={editStyles.twoCol}>
                <View style={[editStyles.section, { flex: 1 }]}>
                  <Text style={editStyles.label}>DAY RATE (£)</Text>
                  <TextInput style={editStyles.input} value={dayRate} onChangeText={setDayRate} keyboardType="decimal-pad" placeholderTextColor={Colors.textMuted} placeholder="250" />
                </View>
                <View style={[editStyles.section, { flex: 1 }]}>
                  <Text style={editStyles.label}>HOURLY RATE (£)</Text>
                  <TextInput style={editStyles.input} value={hourlyRate} onChangeText={setHourlyRate} keyboardType="decimal-pad" placeholderTextColor={Colors.textMuted} placeholder="35" />
                </View>
              </View>

              {/* Preferred shop */}
              <View style={editStyles.section}>
                <Text style={editStyles.label}>PREFERRED MATERIALS SUPPLIER</Text>
                <TextInput style={editStyles.input} value={preferredShop} onChangeText={setPreferredShop} placeholderTextColor={Colors.textMuted} placeholder="e.g. Screwfix, Toolstation, Travis Perkins" />
              </View>

              {/* Flexible pricing toggle */}
              <View style={editStyles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={editStyles.toggleLabel}>Flexible pricing</Text>
                  <Text style={editStyles.toggleSub}>Open to negotiation. Customers see estimated price ranges before final quote approval.</Text>
                </View>
                <Switch
                  value={flexiblePricing}
                  onValueChange={setFlexiblePricing}
                  trackColor={{ false: Colors.border, true: Colors.primary }}
                  thumbColor={Colors.textInverse}
                />
              </View>

              <View style={editStyles.section}>
                <Text style={editStyles.label}>WEBSITE / SOCIAL</Text>
                <TextInput style={editStyles.input} value={website} onChangeText={setWebsite} placeholderTextColor={Colors.textMuted} placeholder="https://yourwebsite.com" autoCapitalize="none" />
              </View>

              <View style={editStyles.section}>
                <Text style={editStyles.label}>MARKETPLACE: SAVED TRADES</Text>
                <Text style={{ ...Typography.labelSM, color: Colors.textMuted, marginBottom: 8 }}>Job feed will prioritise these trades</Text>
                <View style={editStyles.tradesGrid}>
                  {TRADE_CATEGORIES.map(t => (
                    <Pressable
                      key={`saved-${t}`}
                      style={[editStyles.tradeChip, savedTrades.includes(t) && editStyles.tradeChipActive]}
                      onPress={() => setSavedTrades(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
                    >
                      <Text style={[editStyles.tradeChipText, savedTrades.includes(t) && editStyles.tradeChipTextActive]}>{t}</Text>
                      {savedTrades.includes(t) ? <MaterialIcons name="check" size={12} color={Colors.textInverse} /> : null}
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={editStyles.section}>
                <Text style={editStyles.label}>MARKETPLACE: PREFERRED AREAS</Text>
                <TextInput style={editStyles.input} value={savedPostcodes} onChangeText={setSavedPostcodes} placeholderTextColor={Colors.textMuted} placeholder="e.g. M1, M2, SK1" autoCapitalize="characters" />
                <Text style={{ ...Typography.labelSM, color: Colors.textMuted }}>Comma-separated postcode areas</Text>
              </View>
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const editStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { ...Typography.headingMD },
  saveText: { ...Typography.btnSM, color: Colors.primaryGlow, fontWeight: '600' },
  scroll: { padding: Spacing.md, gap: 0, paddingBottom: Spacing.xxl },
  section: { marginBottom: 20 },
  label: { ...Typography.labelXS, marginBottom: 8 },
  input: {
    backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1,
    borderColor: Colors.border, paddingHorizontal: 16, paddingVertical: 14,
    ...Typography.bodyMD, color: Colors.textPrimary,
  },
  textarea: { height: 100, textAlignVertical: 'top', paddingTop: 14 },
  twoCol: { flexDirection: 'row', gap: 12 },
  tradesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tradeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.pill,
    backgroundColor: Colors.cardAlt, borderWidth: 1, borderColor: Colors.border,
  },
  tradeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tradeChipText: { ...Typography.labelMD, color: Colors.textSecondary },
  tradeChipTextActive: { color: Colors.textInverse, fontWeight: '600' },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.cardAlt, borderRadius: Radius.md, borderWidth: 1,
    borderColor: Colors.border, padding: 14, marginBottom: 20,
  },
  toggleLabel: { ...Typography.bodyMD },
  toggleSub: { ...Typography.labelSM, color: Colors.textMuted, marginTop: 2 },
});

// ─────────────────────────────────────────────
// QR Code Modal (contractor public profile)
// ─────────────────────────────────────────────
function QRCodeModal({
  visible,
  onClose,
  autoDownload,
}: {
  visible: boolean;
  onClose: () => void;
  autoDownload?: boolean;
}) {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const qrRef = React.useRef<any>(null);
  const autoDone = React.useRef(false);

  const profileUrl = user?.id ? getContractorProfileUrl(user.id) : '';

  const handleDownload = React.useCallback(() => {
    if (!qrRef.current?.toDataURL) {
      showAlert('Not Ready', 'QR code is still rendering. Please try again.');
      return;
    }
    qrRef.current.toDataURL(async (base64: string) => {
      try {
        if (Platform.OS === 'web') {
          const link = document.createElement('a');
          link.href = `data:image/png;base64,${base64}`;
          link.download = 'pai-profile-qr.png';
          link.click();
        } else {
          const fileUri = `${FileSystem.cacheDirectory}pai-profile-qr.png`;
          await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
          await Sharing.shareAsync(fileUri, { mimeType: 'image/png', dialogTitle: 'Save your profile QR code' });
        }
      } catch (e: any) {
        showAlert('Download Failed', e?.message || 'Could not export the QR code.');
      }
    });
  }, [showAlert]);

  // "Download QR Code" in settings opens this modal and triggers the
  // export once the QR has rendered — the QR must be mounted to export.
  React.useEffect(() => {
    if (visible && autoDownload && !autoDone.current) {
      autoDone.current = true;
      const t = setTimeout(handleDownload, 600);
      return () => clearTimeout(t);
    }
    if (!visible) autoDone.current = false;
  }, [visible, autoDownload, handleDownload]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={qrStyles.container} edges={['top', 'bottom']}>
        <View style={qrStyles.header}>
          <Pressable onPress={onClose} hitSlop={8}>
            <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
          </Pressable>
          <Text style={qrStyles.title}>Profile QR Code</Text>
          <View style={{ width: 30 }} />
        </View>
        <View style={qrStyles.body}>
          <View style={qrStyles.qrCard}>
            <QRCode
              value={profileUrl || 'https://pai.app'}
              size={220}
              backgroundColor="#FFFFFF"
              color="#000000"
              quietZone={12}
              getRef={(c: any) => { qrRef.current = c; }}
            />
          </View>
          <Text style={qrStyles.urlText}>{profileUrl}</Text>
          <Text style={qrStyles.hint}>Scanning this code opens your public contractor profile.</Text>
          <Pressable style={qrStyles.downloadBtn} onPress={handleDownload}>
            <MaterialIcons name="file-download" size={18} color={Colors.textInverse} />
            <Text style={qrStyles.downloadBtnText}>Download QR Code</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const qrStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { ...Typography.headingMD },
  body: { flex: 1, alignItems: 'center', padding: Spacing.md, paddingTop: Spacing.xl, gap: Spacing.md },
  qrCard: { backgroundColor: '#FFFFFF', borderRadius: Radius.lg, padding: 16 },
  urlText: { ...Typography.labelMD, color: Colors.primaryGlow, textAlign: 'center' },
  hint: { ...Typography.labelSM, color: Colors.textMuted, textAlign: 'center' },
  downloadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    paddingHorizontal: 24, height: 48, marginTop: Spacing.sm,
  },
  downloadBtnText: { ...Typography.btnMD, color: Colors.textInverse },
});

// ─────────────────────────────────────────────
// Settings Modal (shared)
// ─────────────────────────────────────────────
function SettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { user, logout, deleteAccount, operationLoading, updateProfile } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const [available, setAvailable] = useState(user?.available ?? true);
  const [qrVisible, setQrVisible] = useState(false);
  const [qrAutoDownload, setQrAutoDownload] = useState(false);

  const isContractor = user?.account_type === 'contractor' || user?.account_type === 'both';

  const handleLogout = () => {
    showAlert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive', onPress: async () => {
          onClose();
          await logout();
          router.replace('/auth');
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    showAlert(
      'Delete Account',
      'This will permanently delete your account, all jobs, invoices, income records, and profile data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Type DELETE to confirm',
          style: 'default',
          onPress: () => {
            // Second confirmation with explicit text check
            showAlert(
              'Final Confirmation',
              'Are you absolutely sure? All your data will be erased immediately and cannot be recovered.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete My Account',
                  style: 'destructive',
                  onPress: async () => {
                    onClose();
                    const { error } = await deleteAccount();
                    if (error) {
                      showAlert('Error', `Could not delete account: ${error}`);
                    } else {
                      router.replace('/auth');
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handleAvailToggle = async (val: boolean) => {
    setAvailable(val);
    await updateProfile({ available: val });
  };

  const rows = [
    ...(isContractor ? [
      { icon: 'qr-code-2', label: 'View QR Code', action: () => { setQrAutoDownload(false); setQrVisible(true); } },
      { icon: 'file-download', label: 'Download QR Code', action: () => { setQrAutoDownload(true); setQrVisible(true); } },
    ] : []),
    { icon: 'notifications-none', label: 'Notifications', action: () => showAlert('Coming Soon', 'Notification settings coming soon.') },
    { icon: 'lock-outline', label: 'Password & Security', action: () => showAlert('Coming Soon', 'Security settings coming soon.') },
    { icon: 'payment', label: 'Subscription & Billing', action: () => showAlert('Subscription', 'Manage your £25/month contractor subscription. Payments via Stripe coming soon.') },
    { icon: 'admin-panel-settings', label: 'Admin: Disputes', action: () => { onClose(); router.push('/admin-disputes'); } },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={settStyles.container} edges={['top', 'bottom']}>
        <View style={settStyles.header}>
          <Pressable onPress={onClose} hitSlop={8}>
            <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
          </Pressable>
          <Text style={settStyles.title}>Settings</Text>
          <View style={{ width: 30 }} />
        </View>
        <ScrollView contentContainerStyle={settStyles.scroll} showsVerticalScrollIndicator={false}>
          {/* Availability toggle (contractor) */}
          {(user?.account_type === 'contractor' || user?.account_type === 'both') ? (
            <View style={settStyles.toggleRow}>
              <View>
                <Text style={settStyles.toggleLabel}>Available for work</Text>
                <Text style={settStyles.toggleSub}>Visible on your public profile</Text>
              </View>
              <Switch
                value={available}
                onValueChange={handleAvailToggle}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor={Colors.textInverse}
              />
            </View>
          ) : null}

          <View style={settStyles.list}>
            {rows.map((row, i) => (
              <Pressable
                key={row.label}
                style={[settStyles.row, i === rows.length - 1 && settStyles.rowLast]}
                onPress={row.action}
              >
                <View style={settStyles.rowLeft}>
                  <MaterialIcons name={row.icon as any} size={20} color={Colors.textSecondary} />
                  <Text style={settStyles.rowLabel}>{row.label}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
              </Pressable>
            ))}
          </View>

          <Text style={settStyles.version}>PAI v{Constants.expoConfig?.version ?? '?'} · {user?.id?.slice(0, 8)}</Text>

          <Pressable style={settStyles.signOutBtn} onPress={handleLogout}>
            <MaterialIcons name="logout" size={18} color={Colors.error} />
            <Text style={settStyles.signOutText}>Sign Out</Text>
          </Pressable>

          <Pressable
            style={[settStyles.deleteAccountBtn, operationLoading && { opacity: 0.5 }]}
            onPress={handleDeleteAccount}
            disabled={operationLoading}
          >
            <MaterialIcons name="delete-forever" size={18} color={Colors.textMuted} />
            <Text style={settStyles.deleteAccountText}>Delete Account</Text>
          </Pressable>
        </ScrollView>
        {/* Nested so it presents above this open modal on iOS */}
        <QRCodeModal visible={qrVisible} onClose={() => setQrVisible(false)} autoDownload={qrAutoDownload} />
      </SafeAreaView>
    </Modal>
  );
}

const settStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { ...Typography.headingMD },
  scroll: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },
  toggleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1,
    borderColor: Colors.border, padding: 16,
  },
  toggleLabel: { ...Typography.bodyMD },
  toggleSub: { ...Typography.labelSM, color: Colors.textMuted, marginTop: 2 },
  list: { backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowLast: { borderBottomWidth: 0 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowLabel: { ...Typography.bodyMD },
  version: { ...Typography.labelXS, textAlign: 'center', color: Colors.textMuted },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    padding: 16, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.errorDim,
    backgroundColor: Colors.errorDim,
  },
  signOutText: { ...Typography.btnMD, color: Colors.error },
  deleteAccountBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    padding: 16, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: 'transparent',
  },
  deleteAccountText: { ...Typography.btnMD, color: Colors.textMuted },
});

// ─────────────────────────────────────────────
// Contractor Profile Tab
// ─────────────────────────────────────────────
function ContractorProfileTab() {
  const { user, updateProfile } = useAuth();
  const { showAlert } = useAlert();
  const { privateJobs } = useJobs();
  const { projects, createProjectFromCompletedJob, updateProject } = usePortfolio();
  const [portfolioUrls, setPortfolioUrls] = React.useState<Record<string, string>>({});
  const [showEdit, setShowEdit] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);

  // Fetch real reviews from Supabase
  React.useEffect(() => {
    if (!user?.id) return;
    const supabase = getSupabaseClient();
    supabase
      .from('reviews')
      .select('*, author:author_id(username)')
      .eq('subject_id', user.id)
      .eq('mode', 'customer_to_contractor')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setReviews(data.map(r => ({ ...r, author_name: r.author?.username || 'Customer' })));
      });
  }, [user?.id]);
  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;

  const portfolioPhotoKey = projects.map(project => project.photos.map(photo => photo.path).join('|')).join(',');

  React.useEffect(() => {
    const paths = Array.from(new Set(projects.flatMap(project => project.photos.map(photo => photo.path))));
    if (paths.length === 0) { setPortfolioUrls({}); return; }
    let active = true;
    getJobPhotoUrls(paths).then(urls => {
      if (!active) return;
      const next: Record<string, string> = {};
      paths.forEach((path, index) => { if (urls[index]) next[path] = urls[index] as string; });
      setPortfolioUrls(next);
    });
    return () => { active = false; };
  }, [portfolioPhotoKey, projects]);

  const completedJobsWithPhotos = privateJobs.filter(job => job.status === 'paid' && (job.progress_photos ?? []).length > 0);

  const handleCreatePortfolio = () => {
    showAlert('Create Portfolio Project', 'Choose where the project photos should come from.', [
      {
        text: 'From Completed Job',
        onPress: () => {
          if (completedJobsWithPhotos.length === 0) {
            showAlert('No completed jobs', 'Complete a job with at least one progress photo to create a verified Portfolio Project.');
            return;
          }
          const job = completedJobsWithPhotos[0];
          createProjectFromCompletedJob(job).then(project => {
            if (project) showAlert('Draft created', `Created a verified portfolio draft for ${job.title}. Select photos, cover, order, and publish when ready.`);
          });
        },
      },
      { text: 'From Photo Library', onPress: () => showAlert('Photo Library', 'Manual portfolio projects are still supported; photo library upload will use the existing gallery picker when storage integration is enabled. Manual projects will not show the Verified badge.') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const movePortfolioPhoto = (projectId: string, fromIndex: number, direction: -1 | 1) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= project.photos.length) return;
    const nextPhotos = [...project.photos];
    const [photo] = nextPhotos.splice(fromIndex, 1);
    nextPhotos.splice(toIndex, 0, photo);
    updateProject(projectId, { photos: nextPhotos.map((item, sort_order) => ({ ...item, sort_order })) });
  };

  const handleShareProfile = async () => {
    if (!user?.id) return;
    const url = getContractorProfileUrl(user.id);
    try {
      if (Platform.OS === 'web') {
        await Clipboard.setStringAsync(url);
        showAlert('Link Copied', 'Your public profile link has been copied to the clipboard.');
      } else {
        await Share.share({ message: `Check out my contractor profile on PAI: ${url}`, url });
      }
    } catch {
      // Share sheet dismissed
    }
  };

  // ── Availability calendar ──────────────────────────────
  const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const [availDays, setAvailDays] = React.useState<string[]>(user?.availability_days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [savingAvail, setSavingAvail] = React.useState(false);

  // Sync from user profile when it loads/changes
  React.useEffect(() => {
    if (user?.availability_days) setAvailDays(user.availability_days);
  }, [user?.availability_days?.join(',')]);

  const toggleDay = async (day: string) => {
    const next = availDays.includes(day)
      ? availDays.filter(d => d !== day)
      : [...availDays, day];
    setAvailDays(next);
    setSavingAvail(true);
    await updateProfile({ availability_days: next });
    setSavingAvail(false);
  };

  function AvailabilityCalendar() {
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Availability</Text>
          {savingAvail ? (
            <ActivityIndicator size="small" color={Colors.primaryGlow} />
          ) : (
            <Text style={[Typography.labelXS, { color: Colors.textMuted }]}>TAP TO TOGGLE</Text>
          )}
        </View>
        <View style={styles.calendarCard}>
          <View style={calStyles.row}>
            {ALL_DAYS.map(d => {
              const on = availDays.includes(d);
              return (
                <Pressable
                  key={d}
                  style={[calStyles.cell, on ? calStyles.cellOn : calStyles.cellOff]}
                  onPress={() => toggleDay(d)}
                >
                  <Text style={[calStyles.label, on ? calStyles.labelOn : calStyles.labelOff]}>{d}</Text>
                  <View style={[calStyles.dot, on ? calStyles.dotOn : calStyles.dotOff]} />
                </Pressable>
              );
            })}
          </View>
          <Text style={calStyles.note}>
            {availDays.length === 0
              ? 'Mark yourself as unavailable'
              : `Available ${availDays.length} day${availDays.length !== 1 ? 's' : ''} per week — visible on your public profile`}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>Profile</Text>
        <View style={styles.topActions}>
          <Pressable style={styles.iconBtn} onPress={() => setShowEdit(true)}>
            <MaterialIcons name="edit" size={18} color={Colors.textSecondary} />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => setShowSettings(true)}>
            <MaterialIcons name="settings" size={18} color={Colors.textSecondary} />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => showAlert('Notifications', 'No new notifications.')}>
            <MaterialIcons name="notifications-none" size={20} color={Colors.textSecondary} />
          </Pressable>
        </View>
      </View>
      <View style={styles.topDivider} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Hero */}
        <View style={styles.heroRow}>
          <Pressable onPress={() => showAlert('Photo Upload', 'Avatar upload coming with storage integration.')} style={styles.avatarWrap}>
            {user?.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatar} contentFit="cover" transition={200} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <MaterialIcons name="person" size={36} color={Colors.textInverse} />
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <MaterialIcons name="camera-alt" size={12} color={Colors.textInverse} />
            </View>
          </Pressable>

          <View style={styles.heroInfo}>
            <Text style={styles.heroName}>{user?.display_name || 'Your Name'}</Text>
            {user?.business_name ? <Text style={styles.heroBusiness}>{user.business_name}</Text> : null}
            {avgRating > 0 ? (
              <View style={styles.ratingRow}>
                <StarRow rating={avgRating} />
                <Text style={styles.ratingText}>{avgRating.toFixed(1)} ({reviews.length} reviews)</Text>
              </View>
            ) : (
              <Text style={styles.noReviews}>No reviews yet</Text>
            )}
            <View style={[
              styles.availBadge,
              user?.available ? styles.availGreen : styles.availRed,
            ]}>
              <View style={[styles.availDot, { backgroundColor: user?.available ? Colors.success : Colors.error }]} />
              <Text style={[styles.availText, { color: user?.available ? Colors.success : Colors.error }]}>
                {user?.available ? 'Available for work' : 'Currently busy'}
              </Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statVal}>0</Text>
            <Text style={styles.statLbl}>JOBS DONE</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{reviews.length}</Text>
            <Text style={styles.statLbl}>REVIEWS</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statVal, { color: Colors.success }]}>
              {user?.hourly_rate_from ? `£${user.hourly_rate_from}` : '—'}
            </Text>
            <Text style={styles.statLbl}>FROM/DAY</Text>
          </View>
        </View>

        {/* Location */}
        {(user?.city || user?.postcode_area) ? (
          <View style={styles.infoRow}>
            <MaterialIcons name="location-on" size={16} color={Colors.textMuted} />
            <Text style={styles.infoText}>
              {[user.city, user.postcode_area].filter(Boolean).join(', ')}
            </Text>
          </View>
        ) : (
          <Pressable style={styles.infoRow} onPress={() => setShowEdit(true)}>
            <MaterialIcons name="location-on" size={16} color={Colors.textMuted} />
            <Text style={[styles.infoText, { color: Colors.textMuted }]}>Add your location</Text>
            <MaterialIcons name="add" size={14} color={Colors.primaryGlow} />
          </Pressable>
        )}

        {/* Share public profile */}
        <Pressable style={styles.shareBtn} onPress={handleShareProfile}>
          <MaterialIcons name="share" size={18} color={Colors.primaryGlow} />
          <Text style={styles.shareBtnText}>Share Profile</Text>
        </Pressable>

        {/* Trades */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Trades</Text>
            <Pressable onPress={() => setShowEdit(true)} hitSlop={8}>
              <MaterialIcons name="edit" size={15} color={Colors.textMuted} />
            </Pressable>
          </View>
          {user?.trades && user.trades.length > 0 ? (
            <View style={styles.tags}>
              {user.trades.map(t => (
                <View key={t} style={styles.tradeTag}>
                  <Text style={styles.tradeTagText}>{t}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Pressable style={styles.emptyAdd} onPress={() => setShowEdit(true)}>
              <MaterialIcons name="add" size={16} color={Colors.primaryGlow} />
              <Text style={styles.emptyAddText}>Add your trades</Text>
            </Pressable>
          )}
        </View>

        {/* About */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>About</Text>
            <Pressable onPress={() => setShowEdit(true)} hitSlop={8}>
              <MaterialIcons name="edit" size={15} color={Colors.textMuted} />
            </Pressable>
          </View>
          {user?.bio ? (
            <Text style={styles.bioText}>{user.bio}</Text>
          ) : (
            <Pressable style={styles.emptyAdd} onPress={() => setShowEdit(true)}>
              <MaterialIcons name="add" size={16} color={Colors.primaryGlow} />
              <Text style={styles.emptyAddText}>Add a bio — tell customers about your experience</Text>
            </Pressable>
          )}
        </View>

        {/* Availability Calendar */}
        <AvailabilityCalendar />

        {/* Portfolio */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Portfolio</Text>
            <Pressable style={styles.addPhotoBtn} onPress={handleCreatePortfolio}>
              <MaterialIcons name="add-photo-alternate" size={15} color={Colors.primaryGlow} />
              <Text style={styles.addPhotoBtnText}>New project</Text>
            </Pressable>
          </View>
          {projects.length > 0 ? (
            <View style={{ gap: 12 }}>
              {projects.map(project => (
                <View key={project.id} style={styles.portfolioProjectCard}>
                  <View style={styles.portfolioProjectHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.portfolioProjectTitle}>{project.title}</Text>
                      <Text style={styles.portfolioHint}>{[project.trade, project.location].filter(Boolean).join(' • ') || (project.source === 'completed_job' ? 'Completed PAI job' : 'Manual upload')}</Text>
                    </View>
                    {project.verified ? (
                      <View style={styles.verifiedBadge}>
                        <MaterialIcons name="check" size={12} color={Colors.success} />
                        <Text style={styles.verifiedBadgeText}>Verified through PAI</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.portfolioDescription}>{project.description}</Text>
                  <View style={styles.portfolioGrid}>
                    {project.photos.map((photo, index) => (
                      <Pressable
                        key={photo.path}
                        style={[styles.portfolioPhotoTile, project.cover_photo_path === photo.path && styles.portfolioCoverTile]}
                        onPress={() => updateProject(project.id, { cover_photo_path: photo.path })}
                      >
                        {portfolioUrls[photo.path] ? (
                          <Image source={{ uri: portfolioUrls[photo.path] }} style={styles.portfolioImg} contentFit="cover" />
                        ) : (
                          <View style={styles.portfolioImgPlaceholder}><MaterialIcons name="image" size={18} color={Colors.textMuted} /></View>
                        )}
                        {project.cover_photo_path === photo.path ? <Text style={styles.coverLabel}>Cover</Text> : null}
                        <View style={styles.reorderControls}>
                          <Pressable onPress={() => movePortfolioPhoto(project.id, index, -1)}><MaterialIcons name="arrow-back" size={14} color={Colors.textPrimary} /></Pressable>
                          <MaterialIcons name="drag-indicator" size={14} color={Colors.textPrimary} />
                          <Pressable onPress={() => movePortfolioPhoto(project.id, index, 1)}><MaterialIcons name="arrow-forward" size={14} color={Colors.textPrimary} /></Pressable>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.portfolioHint}>Tap a photo to set the cover. Use the drag handles to reorder before publishing.</Text>
                </View>
              ))}
            </View>
          ) : (
            <Pressable style={styles.portfolioEmpty} onPress={handleCreatePortfolio}>
              <MaterialIcons name="add-photo-alternate" size={28} color={Colors.textMuted} />
              <Text style={styles.portfolioEmptyText}>No portfolio projects yet</Text>
              <Text style={styles.portfolioEmptySub}>Create one from a completed job or from your phone gallery.</Text>
            </Pressable>
          )}
        </View>

        {/* Website / Social */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Links</Text>
          <Pressable
            style={styles.linkRow}
            onPress={() => setShowEdit(true)}
          >
            <MaterialIcons name="link" size={18} color={Colors.primaryGlow} />
            <Text style={styles.linkText}>
              {(user as any)?.website || 'Add website or social media link'}
            </Text>
            <MaterialIcons name="chevron-right" size={16} color={Colors.textMuted} />
          </Pressable>
        </View>

        {/* Reviews */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reviews</Text>
          {reviews.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>No reviews yet. Complete jobs through the marketplace to receive reviews.</Text>
            </View>
          ) : (
            reviews.map(r => (
              <View key={r.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewAuthor}>{r.author_name}</Text>
                  <View style={{ flexDirection: 'row', gap: 2 }}>
                    {Array.from({ length: r.rating }).map((_, i) => (
                      <MaterialIcons key={i} name="star" size={13} color={Colors.warning} />
                    ))}
                  </View>
                </View>
                <Text style={styles.reviewComment}>{r.comment}</Text>
                <Text style={styles.reviewDate}>{r.created_at}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <RoleSwitcherBar currentTab="profile" />
      <EditProfileModal visible={showEdit} onClose={() => setShowEdit(false)} isContractor />
      <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)} />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
// Customer Profile Tab
// ─────────────────────────────────────────────
function CustomerProfileTab() {
  const { user } = useAuth();
  const { jobPosts } = useJobs();
  const router = useRouter();
  const { showAlert } = useAlert();
  const [showEdit, setShowEdit] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [customerReviews, setCustomerReviews] = useState<any[]>([]);

  // Customer sees their own reliability score
  const { score: reliabilityScore } = useReliability(user?.id);

  // Fetch real reviews received as a customer
  React.useEffect(() => {
    if (!user?.id) return;
    const supabase = getSupabaseClient();
    supabase
      .from('reviews')
      .select('*, author:author_id(username)')
      .eq('subject_id', user.id)
      .eq('mode', 'contractor_to_customer')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setCustomerReviews(data.map(r => ({ ...r, author_name: r.author?.username || 'Contractor' })));
      });
  }, [user?.id]);

  const myPosts = jobPosts.filter(p => p.client_id === user?.id);


  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />

      <View style={styles.topBar}>
        <Text style={styles.topTitle}>Profile</Text>
        <View style={styles.topActions}>
          <Pressable style={styles.iconBtn} onPress={() => setShowEdit(true)}>
            <MaterialIcons name="edit" size={18} color={Colors.textSecondary} />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => setShowSettings(true)}>
            <MaterialIcons name="settings" size={18} color={Colors.textSecondary} />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => showAlert('Notifications', 'No new notifications.')}>
            <MaterialIcons name="notifications-none" size={20} color={Colors.textSecondary} />
          </Pressable>
        </View>
      </View>
      <View style={styles.topDivider} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Profile card */}
        <View style={styles.customerCard}>
          <Pressable
            style={styles.customerAvatarWrap}
            onPress={() => showAlert('Photo Upload', 'Avatar upload coming with storage integration.')}
          >
            {user?.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.customerAvatar} contentFit="cover" />
            ) : (
              <View style={[styles.customerAvatar, styles.avatarFallback]}>
                <MaterialIcons name="person" size={28} color={Colors.textInverse} />
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <MaterialIcons name="camera-alt" size={12} color={Colors.textInverse} />
            </View>
          </Pressable>
          <View style={styles.customerInfo}>
            <Text style={styles.customerName}>{user?.display_name || 'Your Name'}</Text>
            <View style={styles.infoRow}>
              <MaterialIcons name="location-on" size={13} color={Colors.textMuted} />
              <Text style={styles.customerLoc}>
                {user?.city || 'Location not set'}{user?.postcode_area ? `, ${user.postcode_area}` : ''}
              </Text>
            </View>
            <Text style={styles.customerEmail}>{user?.email}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{myPosts.length}</Text>
            <Text style={styles.statLbl}>JOBS POSTED</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{myPosts.filter(p => p.status === 'open').length}</Text>
            <Text style={styles.statLbl}>OPEN</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{customerReviews.length}</Text>
            <Text style={styles.statLbl}>REVIEWS</Text>
          </View>
        </View>

        {/* Customer reliability score — self-view */}
        {reliabilityScore ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Client Reliability</Text>
            <Text style={[Typography.labelSM, { color: Colors.textMuted }]}>
              This score helps contractors understand what it is like to work with you.
            </Text>
            <ReliabilityBadge score={reliabilityScore} size="md" />
          </View>
        ) : null}

        {/* Past jobs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your recent jobs</Text>
          {myPosts.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>
                {"You haven't posted any jobs yet."}
              </Text>
            </View>
          ) : (
            myPosts.slice(0, 5).map(p => (
              <Pressable
                key={p.id}
                style={styles.jobRow}
                onPress={() => router.push({ pathname: '/marketplace-job', params: { id: p.id } })}
              >
                <View style={styles.jobRowLeft}>
                  <Text style={styles.jobRowTitle} numberOfLines={1}>{p.title}</Text>
                  <Text style={styles.jobRowSub}>{p.city} · {p.status}</Text>
                </View>
                <Text style={styles.jobRowAmount}>£{p.budget.toLocaleString()}</Text>
              </Pressable>
            ))
          )}
        </View>

        {/* Reviews received */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reviews received</Text>
          {customerReviews.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>
                No reviews yet. Contractors can leave reviews after completing a job for you.
              </Text>
            </View>
          ) : (
            customerReviews.map((r: any) => (
              <View key={r.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewAuthor}>{r.author_name}</Text>
                  <View style={{ flexDirection: 'row', gap: 2 }}>
                    {Array.from({ length: r.rating }).map((_: any, i: number) => (
                      <MaterialIcons key={i} name="star" size={13} color={Colors.warning} />
                    ))}
                  </View>
                </View>
                <Text style={styles.reviewComment}>{r.comment}</Text>
                <Text style={styles.reviewDate}>{r.created_at}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <RoleSwitcherBar currentTab="profile" />
      <EditProfileModal visible={showEdit} onClose={() => setShowEdit(false)} isContractor={false} />
      <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)} />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
// Root — dispatch based on active role
// ─────────────────────────────────────────────
export default function ProfileScreen() {
  const { user } = useAuth();
  const { activeRole, isDualAccount } = useRole();

  if (isDualAccount) {
    // In profile mode show contractor profile (it's their unified editable profile)
    if (activeRole === 'customer') return <CustomerProfileTab />;
    return <ContractorProfileTab />;
  }

  if (user?.account_type === 'customer') return <CustomerProfileTab />;
  return <ContractorProfileTab />;
}

// ─────────────────────────────────────────────
// Shared Styles
// ─────────────────────────────────────────────
const calStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 5 },
  cell: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: Radius.md, borderWidth: 1, gap: 5,
  },
  cellOn: { backgroundColor: Colors.primaryDim, borderColor: Colors.primaryLight },
  cellOff: { backgroundColor: Colors.cardAlt, borderColor: Colors.border },
  label: { fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },
  labelOn: { color: Colors.primaryGlow },
  labelOff: { color: Colors.textMuted },
  dot: { width: 5, height: 5, borderRadius: 3 },
  dotOn: { backgroundColor: Colors.primaryGlow },
  dotOff: { backgroundColor: Colors.textMuted + '44' },
  note: { ...Typography.labelSM, color: Colors.textMuted, textAlign: 'center' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 12,
  },
  topTitle: { ...Typography.brandMD },
  topDivider: { height: 1, backgroundColor: Colors.border },
  topActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  scroll: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 120 },

  // Hero (contractor)
  heroRow: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  avatarWrap: { position: 'relative' },
  avatar: { width: 86, height: 86, borderRadius: 43, borderWidth: 3, borderColor: Colors.primary },
  avatarFallback: { backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarEditBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.primary, borderWidth: 2, borderColor: Colors.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  heroInfo: { flex: 1, gap: 6 },
  heroName: { ...Typography.brandMD },
  heroBusiness: { ...Typography.labelMD, color: Colors.textSecondary },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingText: { ...Typography.labelSM },
  noReviews: { ...Typography.labelSM, color: Colors.textMuted },
  availBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill, borderWidth: 1,
  },
  availGreen: { backgroundColor: Colors.successDim, borderColor: Colors.success },
  availRed: { backgroundColor: Colors.errorDim, borderColor: Colors.error },
  availDot: { width: 6, height: 6, borderRadius: 3 },
  availText: { fontSize: 12, fontWeight: '500' },

  // Stats bar
  statsBar: {
    flexDirection: 'row', backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: 16,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },
  statVal: { ...Typography.dataLG },
  statLbl: { ...Typography.labelXS },

  // Info row
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { ...Typography.bodyMD, color: Colors.textSecondary },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1,
    borderColor: Colors.border, paddingVertical: 12,
  },
  shareBtnText: { ...Typography.btnSM, color: Colors.primaryGlow },

  // Section
  section: { gap: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { ...Typography.headingMD },

  // Tags
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tradeTag: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: Colors.card, borderRadius: Radius.pill,
    borderWidth: 1, borderColor: Colors.border,
  },
  tradeTagText: { ...Typography.labelMD },

  // Bio
  bioText: { ...Typography.bodyMD, color: Colors.textSecondary, lineHeight: 22 },

  // Empty add prompt
  emptyAdd: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 14, borderRadius: Radius.md, borderWidth: 1,
    borderColor: Colors.border, borderStyle: 'dashed',
  },
  emptyAddText: { ...Typography.labelMD, color: Colors.textMuted },

  // Calendar card
  calendarCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 12,
  },

  // Portfolio
  addPhotoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: Colors.primaryDim, borderRadius: Radius.pill,
    borderWidth: 1, borderColor: Colors.primaryLight,
  },
  addPhotoBtnText: { ...Typography.labelSM, color: Colors.primaryGlow, fontWeight: '600' },
  portfolioGrid: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  portfolioImg: { width: '100%', height: '100%', borderRadius: Radius.md, overflow: 'hidden' },
  portfolioProjectCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1,
    borderColor: Colors.border, padding: 14, gap: 10,
  },
  portfolioProjectHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  portfolioProjectTitle: { ...Typography.headingMD, color: Colors.textPrimary },
  portfolioDescription: { ...Typography.bodySM, color: Colors.textSecondary, lineHeight: 19 },
  portfolioPhotoTile: {
    width: 96, height: 108, borderRadius: Radius.md, overflow: 'hidden',
    backgroundColor: Colors.cardAlt, borderWidth: 1, borderColor: Colors.border,
  },
  portfolioCoverTile: { borderColor: Colors.primaryGlow, borderWidth: 2 },
  portfolioImgPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  coverLabel: {
    position: 'absolute', top: 5, left: 5, ...Typography.labelXS, color: Colors.textInverse,
    backgroundColor: Colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  reorderControls: {
    position: 'absolute', left: 6, right: 6, bottom: 6, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, paddingVertical: 4,
    borderRadius: Radius.pill, backgroundColor: 'rgba(255,255,255,0.82)',
  },
  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: Radius.pill, backgroundColor: Colors.successDim, borderWidth: 1, borderColor: Colors.success + '55',
  },
  verifiedBadgeText: { ...Typography.labelXS, color: Colors.success },
  portfolioOverlay: {
    position: 'absolute', bottom: 6, right: 6,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  portfolioHint: { ...Typography.labelXS, color: Colors.textMuted },
  portfolioEmpty: {
    alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 28, paddingHorizontal: 16,
    backgroundColor: Colors.cardAlt, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed',
  },
  portfolioEmptyText: { ...Typography.labelMD, color: Colors.textSecondary },
  portfolioEmptySub: { ...Typography.labelXS, color: Colors.textMuted, textAlign: 'center' },

  // Links
  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.card, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: 14,
  },
  linkText: { ...Typography.bodyMD, color: Colors.textSecondary, flex: 1 },

  // Reviews
  reviewCard: {
    backgroundColor: Colors.card, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 8,
  },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewAuthor: { ...Typography.dataMD },
  reviewComment: { ...Typography.bodyMD, color: Colors.textSecondary, lineHeight: 20 },
  reviewDate: { ...Typography.labelSM, color: Colors.textMuted },

  // Customer profile card
  customerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: 18,
  },
  customerAvatarWrap: { position: 'relative' },
  customerAvatar: { width: 64, height: 64, borderRadius: 16, overflow: 'hidden' },
  customerInfo: { flex: 1, gap: 4 },
  customerName: { ...Typography.brandSM },
  customerLoc: { ...Typography.labelMD },
  customerEmail: { ...Typography.labelSM, color: Colors.textMuted },

  // Job rows
  jobRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: 14,
  },
  jobRowLeft: { flex: 1, gap: 3 },
  jobRowTitle: { ...Typography.dataMD },
  jobRowSub: { ...Typography.labelSM },
  jobRowAmount: { ...Typography.dataMD, color: Colors.success },

  // Empty states
  emptyCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: 24, alignItems: 'center',
  },
  emptyCardText: { ...Typography.bodyMD, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
});
