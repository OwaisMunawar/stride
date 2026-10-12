import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, monospacedDigit, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

import { type RunActivityProps } from './types';

export { type RunActivityProps } from './types';

function RunActivityLayout(props: RunActivityProps, environment: LiveActivityEnvironment) {
  'widget';
  const accent = environment.isLuminanceReduced ? '#FFFFFF' : '#FF5A1F';
  const muted = '#A9AEB6';
  const symbol = props.activity === 'ride' ? 'bicycle' : 'figure.run';
  const statusText =
    props.status === 'recording'
      ? 'Recording'
      : props.status === 'paused'
        ? 'Paused'
        : 'Auto-paused';
  const statusColor = props.status === 'recording' ? accent : '#EDB341';

  const clock = (size: number) =>
    props.timerStart !== null ? (
      <Text
        timerInterval={{
          lower: new Date(props.timerStart),
          upper: new Date(props.timerStart + 86_400_000),
        }}
        pauseTime={props.pausedAt !== null ? new Date(props.pausedAt) : undefined}
        countsDown={false}
        modifiers={[font({ size, weight: 'bold', design: 'rounded' }), monospacedDigit()]}
      />
    ) : (
      <Text modifiers={[font({ size, weight: 'bold', design: 'rounded' }), monospacedDigit()]}>
        {props.elapsed}
      </Text>
    );

  const metric = (value: string, unit: string, align: 'leading' | 'trailing') => (
    <VStack alignment={align} spacing={0}>
      <Text modifiers={[font({ size: 22, weight: 'bold', design: 'rounded' }), monospacedDigit()]}>
        {value}
      </Text>
      <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundStyle(muted)]}>{unit}</Text>
    </VStack>
  );

  return {
    banner: (
      <VStack alignment="leading" spacing={8} modifiers={[padding({ all: 16 })]}>
        <HStack spacing={6}>
          <Image systemName={symbol} color={accent} size={14} />
          <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(statusColor)]}>
            {statusText}
          </Text>
          <Spacer />
          <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(muted)]}>
            Stride
          </Text>
        </HStack>
        <HStack alignment="lastTextBaseline">
          {clock(34)}
          <Spacer />
          {metric(props.distance, props.distanceUnit, 'trailing')}
          {metric(props.pace, props.paceLabel, 'trailing')}
        </HStack>
      </VStack>
    ),
    compactLeading: <Image systemName={symbol} color={statusColor} size={14} />,
    compactTrailing: (
      <Text
        modifiers={[font({ size: 14, weight: 'semibold', design: 'rounded' }), monospacedDigit()]}>
        {props.distance}
      </Text>
    ),
    minimal: <Image systemName={symbol} color={statusColor} size={12} />,
    expandedLeading: (
      <VStack alignment="leading" spacing={2} modifiers={[padding({ leading: 6, top: 6 })]}>
        <HStack spacing={4}>
          <Image systemName={symbol} color={accent} size={12} />
          <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(statusColor)]}>
            {statusText}
          </Text>
        </HStack>
        {clock(22)}
      </VStack>
    ),
    expandedTrailing: (
      <VStack alignment="trailing" spacing={2} modifiers={[padding({ trailing: 6, top: 6 })]}>
        <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundStyle(muted)]}>
          {props.distanceUnit}
        </Text>
        <Text
          modifiers={[font({ size: 26, weight: 'bold', design: 'rounded' }), monospacedDigit()]}>
          {props.distance}
        </Text>
      </VStack>
    ),
    expandedBottom: (
      <HStack modifiers={[padding({ horizontal: 6, bottom: 4 })]}>
        <Text modifiers={[font({ size: 13, weight: 'medium' }), foregroundStyle(muted)]}>
          Current pace
        </Text>
        <Spacer />
        <Text
          modifiers={[
            font({ size: 15, weight: 'semibold', design: 'rounded' }),
            monospacedDigit(),
          ]}>
          {`${props.pace} ${props.paceLabel}`}
        </Text>
      </HStack>
    ),
  };
}

export const RunActivity = createLiveActivity<RunActivityProps>('RunActivity', RunActivityLayout);
