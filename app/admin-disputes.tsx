import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { PBadge } from '@/components/ui/PBadge';
import { PButton } from '@/components/ui/PButton';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { MOCK_DISPUTES } from '@/services/mockData';
import { useAlert } from '@/template';
import { MaterialIcons } from '@expo/vector-icons';

export default function AdminDisputesScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const [disputes, setDisputes] = useState(MOCK_DISPUTES);
  const [selected, setSelected] = useState<string | null>(null);

  const resolve = (id: string, outcome: 'contractor' | 'customer') => {
    showAlert(
      'Resolve Dispute',
      `Release funds to ${outcome}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm', onPress: () => {
            setDisputes(prev => prev.map(d =>
              d.id === id
                ? { ...d, status: 'resolved', resolution: `Funds released to ${outcome} after admin review.`, resolved_at: new Date().toISOString().split('T')[0] }
                : d
            ));
            setSelected(null);
          }
        }
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
          <Text style={styles.title}>Disputes</Text>
          <Text style={styles.subtitle}>Admin view — internal use only</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.adminBadge}>
          <MaterialIcons name="admin-panel-settings" size={16} color={Colors.warning} />
          <Text style={styles.adminText}>ADMIN PANEL — Not visible to regular users</Text>
        </View>

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
            onPress={() => setSelected(selected === dispute.id ? null : dispute.id)}
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <Text style={styles.cardTitle} numberOfLines={1}>{dispute.job_title}</Text>
                <PBadge
                  label={dispute.status}
                  variant={dispute.status === 'open' ? 'active' : 'paid'}
                />
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
              <Text style={styles.filedDate}>{dispute.created_at}</Text>
            </View>

            {selected === dispute.id ? (
              <View style={styles.expanded}>
                <Text style={styles.reasonLabel}>REASON</Text>
                <Text style={styles.reason}>{dispute.reason}</Text>
                {dispute.resolution ? (
                  <View style={styles.resolution}>
                    <MaterialIcons name="check-circle" size={14} color={Colors.success} />
                    <Text style={styles.resolutionText}>{dispute.resolution}</Text>
                  </View>
                ) : null}
                {dispute.status === 'open' ? (
                  <View style={styles.actions}>
                    <PButton
                      label="Release to Contractor"
                      onPress={() => resolve(dispute.id, 'contractor')}
                      variant="secondary"
                      size="sm"
                      style={styles.actionBtn}
                    />
                    <PButton
                      label="Refund Customer"
                      onPress={() => resolve(dispute.id, 'customer')}
                      variant="secondary"
                      size="sm"
                      style={styles.actionBtn}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { ...Typography.brandMD },
  subtitle: { ...Typography.labelSM },
  scroll: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 80 },
  adminBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.warningDim, borderRadius: Radius.md, padding: 12,
    borderWidth: 1, borderColor: Colors.warning, marginBottom: Spacing.sm,
  },
  adminText: { ...Typography.labelSM, color: Colors.warning },
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
  resolution: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: Colors.successDim, padding: 10, borderRadius: Radius.sm },
  resolutionText: { ...Typography.labelMD, color: Colors.success, flex: 1 },
  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1 },
});
