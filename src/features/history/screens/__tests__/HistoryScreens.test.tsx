import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { createTestServices, renderWithServices } from '@/test-utils/renderWithServices';

import { HistoryScreen } from '../HistoryScreen';
import { RunDetailScreen } from '../RunDetailScreen';

const { __router: router } = jest.requireMock<{ __router: { push: jest.Mock; back: jest.Mock } }>(
  'expo-router',
);

describe('HistoryScreen', () => {
  it('shows the week, the streak and every run with a thumbnail', async () => {
    const { services } = await createTestServices();
    await renderWithServices(<HistoryScreen />, services);
    await waitFor(() => expect(screen.getAllByTestId(/^run-row-/)).toHaveLength(10));
    expect(screen.getByTestId('week-card')).toBeTruthy();
    expect(screen.getByTestId('streak').props.accessibilityLabel).toBe('2 day streak');

    const [first] = await services.runs.list();
    await fireEvent.press(screen.getByTestId(`run-row-${first!.id}`));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/run/[id]', params: { id: first!.id } });
  });

  it('shows an empty state with no runs', async () => {
    const { services } = await createTestServices({ seed: false });
    await renderWithServices(<HistoryScreen />, services);
    expect(await screen.findByText('No activities yet')).toBeTruthy();
  });
});

describe('RunDetailScreen', () => {
  it('shows stats, the coach, charts and splits, and exports GPX', async () => {
    const env = await createTestServices();
    const [run] = await env.services.runs.list();
    await renderWithServices(<RunDetailScreen id={run!.id} />, env.services);

    expect(await screen.findByTestId('run-title')).toBeTruthy();
    expect(screen.getByTestId('detail-distance')).toBeTruthy();
    expect(screen.getByTestId('pace-chart')).toBeTruthy();
    expect(screen.getByTestId('elevation-chart')).toBeTruthy();
    expect(screen.getByTestId('splits-table')).toBeTruthy();
    expect(await screen.findByTestId('coach-summary')).toBeTruthy();
    expect(screen.getByTestId('coach-provider').props.children).toContain('Rule-based coach');
    expect(screen.getByTestId('next-run')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('export-gpx'));
    await waitFor(() =>
      expect(env.gpx.share).toHaveBeenCalledWith(
        expect.stringMatching(/\.gpx$/),
        expect.stringContaining('<gpx'),
      ),
    );
  });

  it('deletes after confirmation', async () => {
    const env = await createTestServices();
    const [run] = await env.services.runs.list();
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    await renderWithServices(<RunDetailScreen id={run!.id} />, env.services);
    await fireEvent.press(await screen.findByTestId('delete-run'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(await env.services.runs.count()).toBe(9);
  });

  it('says so when the run does not exist', async () => {
    const env = await createTestServices({ seed: false });
    await renderWithServices(<RunDetailScreen id="missing" />, env.services);
    expect(await screen.findByText('Run not found')).toBeTruthy();
  });
});
