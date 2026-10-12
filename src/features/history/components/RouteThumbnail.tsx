import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/core/theme';

import { projectToBox, thumbnailToLatLon, type Thumbnail } from '../lib/thumbnail';

/**
 * The route drawn as a Skia path from the simplified polyline stored with the
 * run. No map tiles, no network: a list of fifty runs renders instantly and
 * offline.
 */
export const RouteThumbnail = memo(function RouteThumbnail({
  thumbnail,
  size = 56,
}: {
  thumbnail: Thumbnail;
  size?: number;
}) {
  const { colors, radii } = useTheme();
  const path = useMemo(() => {
    const builder = Skia.PathBuilder.Make();
    for (const line of projectToBox(thumbnailToLatLon(thumbnail), size, size, 8)) {
      line.forEach((p, i) => (i === 0 ? builder.moveTo(p.x, p.y) : builder.lineTo(p.x, p.y)));
    }
    return builder.detach();
  }, [thumbnail, size]);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radii.md,
        backgroundColor: colors.surfaceSunken,
        overflow: 'hidden',
      }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Canvas style={{ width: size, height: size }}>
        <Path
          path={path}
          color={colors.accent}
          style="stroke"
          strokeWidth={2.25}
          strokeJoin="round"
          strokeCap="round"
        />
      </Canvas>
    </View>
  );
});
