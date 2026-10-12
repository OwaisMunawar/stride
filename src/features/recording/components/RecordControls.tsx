import { View } from 'react-native';

import { useTheme } from '@/core/theme';
import { RoundButton } from '@/core/ui';

import { type RecordingStatus } from '../lib/machine';

/**
 * Transport controls for each state. Finishing needs a long press: ending a
 * run by accident is the one mistake that cannot be undone mid-run.
 */
export function RecordControls({
  status,
  busy,
  onStart,
  onPause,
  onResume,
  onFinish,
}: {
  status: RecordingStatus | null;
  busy: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
}) {
  const { spacing } = useTheme();

  if (status === null || status === 'idle' || status === 'finished') {
    return (
      <RoundButton
        testID="start-button"
        icon="play"
        label="Start"
        size={92}
        disabled={busy}
        onPress={onStart}
      />
    );
  }

  const paused = status === 'paused';
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.xxl }}>
      {paused ? (
        <RoundButton
          testID="resume-button"
          icon="play"
          label="Resume"
          onPress={onResume}
          disabled={busy}
        />
      ) : (
        <RoundButton
          testID="pause-button"
          icon="pause"
          label="Pause"
          tone="neutral"
          onPress={onPause}
          disabled={busy}
        />
      )}
      <RoundButton
        testID="finish-button"
        icon="stop"
        label="Finish"
        hint="Hold"
        tone="danger"
        onLongPress={onFinish}
        disabled={busy}
      />
    </View>
  );
}
