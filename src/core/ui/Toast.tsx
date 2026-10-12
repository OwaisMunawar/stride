import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/core/theme';

import { ScalePressable } from './Pressable';
import { Text } from './Text';

type ToastOptions = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Runs when the toast leaves without its action being used. */
  onExpire?: () => void;
  durationMs?: number;
};

type ToastApi = { show(options: ToastOptions): void };

const ToastContext = createContext<ToastApi>({ show: () => undefined });

/**
 * Single-slot toast. A new toast expires the current one first, so an undo
 * window always closes (and commits its action) before the next opens.
 */
export function ToastProvider({
  children,
  bottomOffset = 96,
}: {
  children: ReactNode;
  bottomOffset?: number;
}) {
  const [toast, setToast] = useState<(ToastOptions & { key: number }) | null>(null);
  const current = useRef<(ToastOptions & { key: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { colors, radii, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  const dismiss = useCallback((expired: boolean) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const active = current.current;
    current.current = null;
    setToast(null);
    if (expired) active?.onExpire?.();
  }, []);

  const show = useCallback(
    (options: ToastOptions) => {
      if (current.current) dismiss(true);
      const next = { ...options, key: Date.now() };
      current.current = next;
      setToast(next);
      timer.current = setTimeout(() => dismiss(true), options.durationMs ?? 5_000);
    },
    [dismiss],
  );

  useEffect(() => () => dismiss(true), [dismiss]);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext value={api}>
      {children}
      {toast && (
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + bottomOffset }}>
          <Animated.View
            key={toast.key}
            entering={FadeInDown.springify().damping(18)}
            exiting={FadeOutDown.duration(160)}
            accessibilityLiveRegion="polite"
            style={{
              marginHorizontal: spacing.lg,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.lg,
              borderRadius: radii.md,
              backgroundColor: colors.text,
            }}>
            <Text variant="callout" style={{ flex: 1, color: colors.background }}>
              {toast.message}
            </Text>
            {toast.actionLabel && (
              <ScalePressable
                testID="toast-action"
                accessibilityRole="button"
                onPress={() => {
                  toast.onAction?.();
                  dismiss(false);
                }}>
                <Text variant="headline" style={{ color: colors.accentSoft }}>
                  {toast.actionLabel}
                </Text>
              </ScalePressable>
            )}
          </Animated.View>
        </View>
      )}
    </ToastContext>
  );
}

export function useToast(): ToastApi {
  return use(ToastContext);
}
