import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { createTestServices, renderWithServices } from '@/test-utils/renderWithServices';

import { SettingsScreen } from '../SettingsScreen';

describe('SettingsScreen', () => {
  it('changes units, auto-pause, weight and haptics', async () => {
    const { services } = await createTestServices({ seed: false });
    await renderWithServices(<SettingsScreen />, services);

    await fireEvent.press(screen.getByTestId('units-imperial'));
    await fireEvent.press(screen.getByTestId('auto-pause-high'));
    await fireEvent.press(screen.getByLabelText('Increase weight'));
    await fireEvent.press(screen.getByLabelText('Increase weight'));
    await fireEvent.press(screen.getByLabelText('Decrease weight'));
    await fireEvent(screen.getByTestId('haptics'), 'valueChange', false);

    expect(services.settings.store.get()).toMatchObject({
      units: 'imperial',
      autoPause: 'high',
      weightKg: 71,
      haptics: false,
    });
    expect(screen.getByTestId('weight').props.children).toBe('71 kg');
  });

  it('only offers coaches that are available here', async () => {
    const { services } = await createTestServices({ seed: false });
    await renderWithServices(<SettingsScreen />, services);
    await waitFor(() =>
      expect(screen.getByTestId('coach-provider-onDevice').props.accessibilityState.disabled).toBe(
        true,
      ),
    );
    expect(screen.getByTestId('coach-provider-server').props.accessibilityState.disabled).toBe(
      true,
    );
    expect(screen.getByText(/On device needs iOS 26/)).toBeTruthy();
  });

  it('states exactly what leaves the phone', async () => {
    const { services } = await createTestServices({ seed: false });
    await renderWithServices(<SettingsScreen />, services);
    expect(screen.getByText(/stored only on this phone/)).toBeTruthy();
    expect(screen.getByText(/Never coordinates/)).toBeTruthy();
  });

  it('imports a GPX picked from Files', async () => {
    const env = await createTestServices({ seed: false });
    (env.gpx.pick as jest.Mock).mockResolvedValueOnce({
      name: 'a.gpx',
      text: '<gpx><trk><trkseg><trkpt lat="1" lon="1"/></trkseg></trk></gpx>',
    });
    await renderWithServices(<SettingsScreen />, env.services);
    await fireEvent.press(screen.getByTestId('import-gpx'));
    expect(await screen.findByText('That file has no track Stride can read.')).toBeTruthy();
  });
});
