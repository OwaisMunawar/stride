import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { flush } from '@/test-utils/fakes';
import { createTestServices, renderWithServices, TEST_NOW } from '@/test-utils/renderWithServices';
import { straightFixes } from '@/test-utils/tracks';

import { LocationRationaleScreen } from '../LocationRationaleScreen';
import { RecordScreen } from '../RecordScreen';

const { __router: router } = jest.requireMock<{ __router: { push: jest.Mock; back: jest.Mock } }>(
  'expo-router',
);

describe('RecordScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('records, pauses, resumes and finishes a run', async () => {
    const env = await createTestServices({ seed: false });
    await renderWithServices(<RecordScreen />, env.services);
    expect(screen.getByText('Ready when you are')).toBeTruthy();
    expect(screen.getByTestId('simulate-run')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('start-button'));
    expect(await screen.findByText('Recording')).toBeTruthy();
    expect(screen.getByTestId('live-time')).toBeTruthy();

    await act(async () => {
      await env.sources[0]!.push(straightFixes({ speedMps: 4, seconds: 300, startT: TEST_NOW }));
      await flush();
    });
    await waitFor(() => expect(screen.getByTestId('live-distance').props.children).toBe('1.19'));
    expect(screen.getByTestId('last-split')).toBeTruthy();
    expect(screen.getByText(/GPS good/)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('pause-button'));
    expect(await screen.findByText('Paused')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('resume-button'));
    expect(await screen.findByText('Recording')).toBeTruthy();

    await fireEvent(screen.getByTestId('finish-button'), 'longPress');
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/run/[id]',
        params: { id: expect.any(String) },
      }),
    );
    expect(await screen.findByText('Ready when you are')).toBeTruthy();
    expect(await env.services.runs.count()).toBe(1);
    env.services.dispose();
  });

  it('asks for permission before the first recording', async () => {
    const env = await createTestServices({ seed: false });
    env.permissions.set('none');
    await renderWithServices(<RecordScreen />, env.services);
    await fireEvent.press(screen.getByTestId('start-button'));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/permissions'));
    expect(env.services.engine.snapshot.get()).toBeNull();
  });

  it('warns when only foreground location is allowed', async () => {
    const env = await createTestServices({ seed: false });
    env.permissions.set('foreground');
    await renderWithServices(<RecordScreen />, env.services);
    await fireEvent.press(screen.getByTestId('start-button'));
    expect(await screen.findByTestId('background-banner')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('background-banner'));
    expect(router.push).toHaveBeenCalledWith('/permissions');
  });

  it('starts a simulated run in demo mode', async () => {
    const env = await createTestServices({ seed: false });
    await renderWithServices(<RecordScreen />, env.services);
    await fireEvent.press(screen.getByTestId('simulate-run'));
    expect(await screen.findByText('Recording')).toBeTruthy();
    expect(env.services.engine.snapshot.get()?.source).toBe('replay');
  });
});

describe('LocationRationaleScreen', () => {
  it('walks through while-using then always', async () => {
    const env = await createTestServices({ seed: false });
    env.permissions.set('none');
    await renderWithServices(<LocationRationaleScreen />, env.services);
    await fireEvent.press(await screen.findByTestId('allow-foreground'));
    await fireEvent.press(await screen.findByTestId('allow-background'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
  });

  it('sends a user who refused to Settings', async () => {
    const env = await createTestServices({ seed: false });
    env.permissions.set('blocked');
    await renderWithServices(<LocationRationaleScreen />, env.services);
    await fireEvent.press(await screen.findByTestId('open-settings'));
    expect(env.permissions.openSettings).toHaveBeenCalled();
  });
});
