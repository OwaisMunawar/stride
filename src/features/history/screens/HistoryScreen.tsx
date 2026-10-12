import { LegendList } from '@legendapp/list/react-native';
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { View } from 'react-native';

import { useServices } from '@/composition/ServicesProvider';
import { useQuery } from '@/core/hooks/useQuery';
import { useStore } from '@/core/hooks/useStore';
import { useTheme } from '@/core/theme';
import { EmptyState, Screen, Text } from '@/core/ui';

import { RunRow } from '../components/RunRow';
import { WeekCard } from '../components/WeekCard';
import { currentStreak, previousWeekDistance, weekTotals } from '../lib/weekly';
import { type RunRecord } from '../model';

export function HistoryScreen() {
  const { runs, settings, now } = useServices();
  const router = useRouter();
  const { spacing } = useTheme();
  const { units } = useStore(settings.store);
  const subscribe = useCallback((onChange: () => void) => runs.subscribe(onChange), [runs]);
  const read = useCallback(() => runs.list(), [runs]);
  const { data, loading } = useQuery('runs', read, subscribe);

  const header = useMemo(() => {
    const list = (data ?? []).map((r) => ({
      startedAt: r.startedAt,
      distanceM: r.summary.distanceM,
      movingMs: r.summary.movingMs,
    }));
    const t = now();
    return {
      week: weekTotals(list, t),
      previous: previousWeekDistance(list, t),
      streak: currentStreak(list, t),
      todayIndex: (new Date(t).getDay() + 6) % 7,
    };
  }, [data, now]);

  const open = useCallback(
    (id: string) => router.push({ pathname: '/run/[id]', params: { id } }),
    [router],
  );

  return (
    <Screen testID="history-screen" contentStyle={{ paddingBottom: 0 }}>
      <LegendList<RunRecord>
        data={data ?? []}
        keyExtractor={(run) => run.id}
        estimatedItemSize={92}
        recycleItems
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListHeaderComponent={
          <View style={{ gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg }}>
            <Text variant="display">History</Text>
            <WeekCard
              week={header.week}
              previousDistanceM={header.previous}
              streak={header.streak}
              todayIndex={header.todayIndex}
              units={units}
            />
            {data && data.length > 0 ? (
              <Text variant="overline" color="textFaint">
                All activities
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              icon="run"
              title="No activities yet"
              message="Record a run or a ride, or import a GPX file from Settings."
            />
          )
        }
        renderItem={({ item }) => <RunRow run={item} units={units} onPress={open} />}
      />
    </Screen>
  );
}
