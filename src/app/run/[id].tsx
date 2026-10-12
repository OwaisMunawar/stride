import { useLocalSearchParams } from 'expo-router';

import { RunDetailScreen } from '@/features/history/screens/RunDetailScreen';

export default function RunRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RunDetailScreen id={id} />;
}
