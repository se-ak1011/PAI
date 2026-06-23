import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { listConversations, type ConversationSummary } from '@/services/messageService';

export default function MessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const data = await listConversations(user.id);
    setItems(data);
    setLoading(false);
  }, [user?.id]);

  // Refresh whenever the screen regains focus (e.g. returning from a chat).
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.nav}>
        <Pressable onPress={goBack} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textSecondary} />
        </Pressable>
        <Text style={styles.navTitle}>Messages</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primaryGlow} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={c => c.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primaryGlow} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="forum" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No conversations yet</Text>
              <Text style={styles.emptySub}>A chat opens once a quote is accepted — between you and the person you hired (or who hired you).</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => router.push({ pathname: '/chat', params: { id: item.id, title: item.other_name } })}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(item.other_name || '?').charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.rowTop}>
                  <Text style={styles.name} numberOfLines={1}>{item.other_name}</Text>
                  {item.unread > 0 ? (
                    <View style={styles.unreadDot}><Text style={styles.unreadText}>{item.unread}</Text></View>
                  ) : null}
                </View>
                <Text style={styles.job} numberOfLines={1}>{item.job_title}</Text>
                <Text style={[styles.preview, item.unread > 0 && styles.previewUnread]} numberOfLines={1}>
                  {item.last_message || 'No messages yet'}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={Colors.textMuted} />
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  nav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  navTitle: { ...Typography.headingMD },
  list: { padding: Spacing.md, gap: Spacing.sm, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 80, paddingHorizontal: 32 },
  emptyText: { ...Typography.bodyMD, color: Colors.textMuted },
  emptySub: { ...Typography.labelSM, color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1,
    borderColor: Colors.border, padding: 14,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primaryDim,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { ...Typography.dataMD, color: Colors.primaryGlow },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { ...Typography.dataMD, flex: 1 },
  job: { ...Typography.labelSM, color: Colors.textSecondary },
  preview: { ...Typography.labelSM, color: Colors.textMuted },
  previewUnread: { color: Colors.textPrimary, fontWeight: '600' },
  unreadDot: {
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  unreadText: { fontSize: 11, fontWeight: '800', color: Colors.textInverse },
});
