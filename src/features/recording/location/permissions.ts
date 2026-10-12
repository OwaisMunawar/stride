import * as Location from 'expo-location';
import { Linking } from 'react-native';

/**
 * The two-step location permission flow.
 *
 * Both platforms want "while using" granted first and "always" requested
 * separately, with the user knowing why. Asking for background straight away
 * gets an instant denial on Android 11+ and a confusing prompt on iOS.
 *
 * - `none`: nothing granted yet, show the rationale screen.
 * - `foreground`: recording works while the app is open; ask for background.
 * - `background`: everything works with the screen locked.
 * - `blocked`: the user said no and the OS will not ask again; send them to Settings.
 */
export type LocationAccess = 'none' | 'foreground' | 'background' | 'blocked';

export type LocationPermissions = {
  check(): Promise<LocationAccess>;
  requestForeground(): Promise<LocationAccess>;
  requestBackground(): Promise<LocationAccess>;
  openSettings(): Promise<void>;
};

export function createLocationPermissions(): LocationPermissions {
  const check = async (): Promise<LocationAccess> => {
    const foreground = await Location.getForegroundPermissionsAsync();
    if (!foreground.granted) return foreground.canAskAgain ? 'none' : 'blocked';
    const background = await Location.getBackgroundPermissionsAsync();
    return background.granted ? 'background' : 'foreground';
  };

  return {
    check,
    async requestForeground() {
      await Location.requestForegroundPermissionsAsync();
      return check();
    },
    async requestBackground() {
      const foreground = await Location.getForegroundPermissionsAsync();
      if (!foreground.granted) await Location.requestForegroundPermissionsAsync();
      await Location.requestBackgroundPermissionsAsync();
      return check();
    },
    openSettings: () => Linking.openSettings(),
  };
}
