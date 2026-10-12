import { Canvas, LinearGradient, Path, Skia, vec } from '@shopify/react-native-skia';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { chartGeometry, downsample, type Sample } from '@/core/lib/chartGeometry';
import { useTheme } from '@/core/theme';

import { Text } from './Text';

/**
 * A filled line chart drawn with Skia. Used for pace and elevation. The
 * geometry is computed in a pure function; this component only turns it into
 * paths, so the maths is unit-tested and the drawing stays trivial.
 */
export function AreaChart({
  samples,
  height = 140,
  color,
  fill,
  invert = false,
  minSpan,
  formatGuide,
  accessibilityLabel,
  testID,
}: {
  samples: readonly Sample[];
  height?: number;
  color: string;
  fill: string;
  invert?: boolean;
  minSpan?: number;
  formatGuide: (value: number) => string;
  accessibilityLabel: string;
  testID?: string;
}) {
  const { colors, spacing } = useTheme();
  const [width, setWidth] = useState(0);

  const geometry = useMemo(
    () =>
      chartGeometry(
        downsample(samples, Math.max(2, Math.round(width / 2))),
        { width, height, top: 8, bottom: 8 },
        { invert, minSpan, guides: 2 },
      ),
    [samples, width, height, invert, minSpan],
  );

  const { line, area } = useMemo(() => {
    const lineBuilder = Skia.PathBuilder.Make();
    const areaBuilder = Skia.PathBuilder.Make();
    const pts = geometry.points;
    pts.forEach((p, i) => {
      if (i === 0) {
        lineBuilder.moveTo(p.x, p.y);
        areaBuilder.moveTo(p.x, height);
        areaBuilder.lineTo(p.x, p.y);
      } else {
        lineBuilder.lineTo(p.x, p.y);
        areaBuilder.lineTo(p.x, p.y);
      }
    });
    const last = pts[pts.length - 1];
    if (last) {
      areaBuilder.lineTo(last.x, height);
      areaBuilder.close();
    }
    return { line: lineBuilder.detach(), area: areaBuilder.detach() };
  }, [geometry, height]);

  return (
    <View
      testID={testID}
      style={{ height }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}>
      {width > 0 && geometry.points.length > 1 && (
        <>
          <Canvas style={{ width, height }}>
            {geometry.guides.map((guide) => (
              <Path
                key={guide.y}
                path={Skia.PathBuilder.Make().moveTo(0, guide.y).lineTo(width, guide.y).detach()}
                color={colors.chartGrid}
                style="stroke"
                strokeWidth={1}
              />
            ))}
            <Path path={area}>
              <LinearGradient
                start={vec(0, 0)}
                end={vec(0, height)}
                colors={[fill, 'transparent']}
              />
            </Path>
            <Path
              path={line}
              color={color}
              style="stroke"
              strokeWidth={2.5}
              strokeJoin="round"
              strokeCap="round"
            />
          </Canvas>
          {geometry.guides.map((guide) => (
            <Text
              key={guide.y}
              variant="mono"
              color="textFaint"
              style={{ position: 'absolute', right: spacing.xs, top: guide.y - 17, fontSize: 11 }}>
              {formatGuide(guide.value)}
            </Text>
          ))}
        </>
      )}
    </View>
  );
}
