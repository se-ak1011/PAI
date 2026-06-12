import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { PButton, PInput } from '@/components';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { TRADE_CATEGORIES } from '@/constants/config';
import { useAuth } from '@/hooks/useAuth';
import { useAlert } from '@/template';
import { MaterialIcons } from '@expo/vector-icons';

// Steps: 0=Welcome, 1=Profile, 2=Trades(contractor), 3=TaxRate(contractor) or Done(customer)
export default function OnboardingScreen() {
  const router = useRouter();
  const { user, completeOnboarding, operationLoading } = useAuth();
  const { showAlert } = useAlert();
  const [step, setStep] = useState(0);

  const accountType = (user?.account_type ?? 'contractor') as 'contractor' | 'customer' | 'both';
  const isContractor = accountType === 'contractor' || accountType === 'both';

  // Steps depend on role:
  // contractor/both: Welcome → Profile → Trades → TaxRate → Done (4 steps, indices 0-3)
  // customer: Welcome → Profile → Done (3 steps, indices 0-2, skipping trades/tax)
  const STEPS = isContractor ? 4 : 3;

  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [businessName, setBusinessName] = useState('');
  const [city, setCity] = useState('');
  const [postcode, setPostcode] = useState('');
  const [selectedTrades, setSelectedTrades] = useState<string[]>([]);
  const [hourlyRate, setHourlyRate] = useState('');
  const [taxRate, setTaxRate] = useState<20 | 30>(30);

  const toggleTrade = (trade: string) => {
    setSelectedTrades(prev =>
      prev.includes(trade) ? prev.filter(t => t !== trade) : [...prev, trade]
    );
  };

  const handleFinish = async () => {
    // Prevent null account_type — must be set before completing onboarding
    if (!accountType) {
      showAlert('Account type missing', 'Please restart setup.');
      return;
    }
    await completeOnboarding({
      account_type: accountType,
      display_name: displayName || undefined,
      business_name: businessName || undefined,
      city: city || undefined,
      postcode_area: postcode || undefined,
      trades: selectedTrades,
      hourly_rate_from: parseFloat(hourlyRate) || undefined,
      tax_rate: taxRate,
      onboarding_complete: true,
    });
    router.replace('/(tabs)');
  };

  // Map logical step index to content, skipping trades/tax for customers
  // contractor/both: 0=Welcome 1=Profile 2=Trades 3=TaxRate
  // customer:        0=Welcome 1=Profile 2=Done
  const renderStep = () => {
    if (step === 0) {
      return (
        <View style={styles.stepContent}>
          <Image
            source={{ uri: 'https://cdn-ai.onspace.ai/onspace/files/ZibWAkHU6zWf7ApvJcL3qb/1EFBAB4B-5F3B-4856-989A-9BF46663706D.png' }}
            style={styles.heroLogo}
            contentFit="contain"
            transition={300}
          />
          <View style={styles.stepText}>
            <Text style={styles.brandTitle}>Welcome to PAI.</Text>
            <Text style={styles.stepSubtitle}>
              Your personal assistant for trades business. Let us set you up in a couple of minutes.
            </Text>
          </View>
          <View style={styles.featureList}>
            {(isContractor ? [
              'AI-powered job quoting & invoicing',
              'Tax set-aside calculator',
              'Marketplace to find new work',
              'Manage your full job pipeline',
            ] : [
              'Post jobs to local tradespeople',
              'Compare quotes side by side',
              'Secure escrow payments',
              'Leave reviews after work is complete',
            ]).map(f => (
              <View key={f} style={styles.featureItem}>
                <MaterialIcons name="check-circle" size={18} color={Colors.success} />
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </View>
        </View>
      );
    }

    if (step === 1) {
      return (
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>Your Profile</Text>
          <Text style={styles.stepSubtitle}>How should people know you?</Text>
          <PInput
            label="Display Name"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            autoCapitalize="words"
          />
          {isContractor ? (
            <PInput
              label="Business Name (optional)"
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="Webb & Sons Electrical"
            />
          ) : null}
          <PInput
            label="City"
            value={city}
            onChangeText={setCity}
            placeholder="Manchester"
          />
          <PInput
            label="Postcode Area"
            value={postcode}
            onChangeText={setPostcode}
            placeholder="M1"
            autoCapitalize="characters"
          />
        </View>
      );
    }

    if (step === 2 && isContractor) {
      return (
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>Your Trades</Text>
          <Text style={styles.stepSubtitle}>What do you specialise in?</Text>
          <View style={styles.tradesGrid}>
            {TRADE_CATEGORIES.map(trade => (
              <Pressable
                key={trade}
                style={[styles.tradeChip, selectedTrades.includes(trade) && styles.tradeChipActive]}
                onPress={() => toggleTrade(trade)}
              >
                <Text style={[styles.tradeChipText, selectedTrades.includes(trade) && styles.tradeChipTextActive]}>
                  {trade}
                </Text>
                {selectedTrades.includes(trade) ? (
                  <MaterialIcons name="check" size={14} color={Colors.textInverse} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </View>
      );
    }

    if (step === 3 && isContractor) {
      return (
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>Tax Status</Text>
          <Text style={styles.stepSubtitle}>
            Sets your automatic set-aside rate in the Tax Pot. You can change this later in Settings.
          </Text>
          {([
            { rate: 30 as const, label: 'Self-Employed', desc: 'Standard self-assessment — 30% recommended set-aside' },
            { rate: 20 as const, label: 'CIS Subcontractor', desc: 'Construction Industry Scheme — 20% deducted at source' },
          ]).map(option => (
            <Pressable
              key={option.rate}
              style={[styles.taxCard, taxRate === option.rate && styles.taxCardActive]}
              onPress={() => setTaxRate(option.rate)}
            >
              <View style={styles.taxCardHeader}>
                <Text style={[styles.taxCardTitle, taxRate === option.rate && styles.taxCardTitleActive]}>
                  {option.label}
                </Text>
                <Text style={[styles.taxRateLabel, taxRate === option.rate && styles.taxRateLabelActive]}>
                  {option.rate}%
                </Text>
              </View>
              <Text style={styles.taxCardDesc}>{option.desc}</Text>
            </Pressable>
          ))}
          <PInput
            label="Day Rate From (£, optional)"
            value={hourlyRate}
            onChangeText={setHourlyRate}
            keyboardType="decimal-pad"
            placeholder="e.g. 250"
          />
        </View>
      );
    }

    // Final step (step 2 for customer, step 4 for contractor — shouldn't reach here normally)
    // This is the "all set" summary shown right before handleFinish
    return (
      <View style={styles.stepContent}>
        <Text style={styles.brandTitle}>You are all set.</Text>
        <Text style={styles.stepSubtitle}>
          {isContractor
            ? 'Your PAI workspace is ready. Start by creating a job or exploring the marketplace.'
            : 'Post your first job and get quotes from local tradespeople.'}
        </Text>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryName}>{displayName || 'Your Name'}</Text>
          {businessName ? <Text style={styles.summaryDetail}>{businessName}</Text> : null}
          {city ? <Text style={styles.summaryDetail}>{city}{postcode ? `, ${postcode}` : ''}</Text> : null}
          {selectedTrades.length > 0 ? (
            <Text style={styles.summaryDetail}>{selectedTrades.join(' · ')}</Text>
          ) : null}
          {isContractor ? (
            <Text style={styles.summaryDetail}>
              Tax status: {taxRate === 30 ? 'Self-Employed (30%)' : 'CIS (20%)'}
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  const isLastStep = step === STEPS - 1;
  const canProgress = step === 1 ? !!displayName.trim() : true;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="light" />

      {/* Progress */}
      <View style={styles.progress}>
        {Array.from({ length: STEPS }, (_, i) => i).map((i) => (
          <View
            key={i}
            style={[
              styles.progressDot,
              i <= step && styles.progressDotActive,
              i === step && styles.progressDotCurrent,
            ]}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {renderStep()}
      </ScrollView>

      <View style={styles.footer}>
        {step > 0 ? (
          <Pressable style={styles.backBtn} onPress={() => setStep(s => s - 1)}>
            <MaterialIcons name="arrow-back" size={20} color={Colors.textSecondary} />
          </Pressable>
        ) : null}
        <PButton
          label={isLastStep ? 'Get Started' : 'Continue'}
          onPress={isLastStep ? handleFinish : () => setStep(s => s + 1)}
          disabled={!canProgress || operationLoading}
          loading={operationLoading && isLastStep}
          style={styles.nextBtn}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  progress: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: Spacing.md },
  progressDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.border },
  progressDotActive: { backgroundColor: Colors.primaryDim },
  progressDotCurrent: { width: 24, backgroundColor: Colors.primary },
  scroll: { padding: Spacing.md, paddingBottom: Spacing.xl },
  stepContent: { gap: 20 },
  heroLogo: { width: '100%', height: 180, borderRadius: Radius.lg, overflow: 'hidden' },
  brandTitle: { ...Typography.brandLG },
  stepTitle: { ...Typography.brandMD },
  stepSubtitle: { ...Typography.bodyMD, color: Colors.textSecondary },
  stepText: { gap: 8 },
  tradesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tradeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: Radius.pill,
    backgroundColor: Colors.cardAlt, borderWidth: 1, borderColor: Colors.border,
  },
  tradeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tradeChipText: { ...Typography.labelMD, color: Colors.textSecondary },
  tradeChipTextActive: { color: Colors.textInverse, fontWeight: '600' },
  taxCard: {
    padding: 16, borderRadius: Radius.lg, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: Colors.card, gap: 6,
  },
  taxCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryDim },
  taxCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  taxCardTitle: { ...Typography.headingMD, color: Colors.textSecondary },
  taxCardTitleActive: { color: Colors.textPrimary },
  taxRateLabel: { ...Typography.dataLG, color: Colors.textMuted },
  taxRateLabelActive: { color: Colors.primaryGlow },
  taxCardDesc: { ...Typography.bodySM },
  featureList: { gap: 14 },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureText: { ...Typography.bodyMD },
  summaryCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: 20,
    borderWidth: 1, borderColor: Colors.primary, gap: 6,
  },
  summaryName: { ...Typography.dataLG },
  summaryDetail: { ...Typography.labelMD },
  footer: {
    flexDirection: 'row', gap: 12, padding: Spacing.md,
    paddingBottom: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  backBtn: {
    width: 48, height: 48, borderRadius: Radius.md, backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
  },
  nextBtn: { flex: 1 },
});
