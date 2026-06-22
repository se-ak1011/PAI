import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Haptics only fire on device (no-op on web). All calls are fire-and-forget and
// never throw, so they're safe to sprinkle anywhere.
const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

export const haptics = {
  /** Light tap — default for button presses. */
  tap: () => { if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); },
  /** Medium impact — for heavier/primary confirmations. */
  medium: () => { if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); },
  /** Success buzz — job saved, invoice paid, quote generated, photo uploaded. */
  success: () => { if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); },
  /** Warning buzz — validation / recoverable issue. */
  warn: () => { if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); },
  /** Error buzz — failed action. */
  error: () => { if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); },
  /** Selection tick — toggles, chips, tab/role changes. */
  select: () => { if (enabled) Haptics.selectionAsync().catch(() => {}); },
};
