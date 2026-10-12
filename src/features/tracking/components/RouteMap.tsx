import { Camera, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';
import { useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { MAP_STYLES } from '@/core/map/mapStyle';
import { paceRamp, useTheme } from '@/core/theme';

import { boundsOf } from '../lib/geo';
import { paceSegments } from '../lib/paceSegments';
import { simplify } from '../lib/simplify';
import { type TrackPoint } from '../lib/types';

type Props = {
  points: readonly TrackPoint[];
  /** `follow` keeps the latest point centred (live); `fit` frames the whole route (detail). */
  mode: 'follow' | 'fit';
  colorByPace?: boolean;
  interactive?: boolean;
  /** Fallback centre before the first fix arrives, [lon, lat]. */
  initialCenter?: [number, number];
  style?: ViewStyle;
  bottomInset?: number;
  testID?: string;
};

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

/**
 * The route on a MapLibre map. Geometry is simplified before it crosses the
 * bridge: the live map re-sends the whole line every second and a two-hour
 * ride at 1 Hz would otherwise be 7,000 vertices per update.
 */
export function RouteMap({
  points,
  mode,
  colorByPace = false,
  interactive = true,
  initialCenter,
  style,
  bottomInset = 0,
  testID,
}: Props) {
  const { scheme, colors } = useTheme();

  const route = useMemo<GeoJSON.FeatureCollection>(() => {
    if (points.length < 2) return EMPTY;
    if (colorByPace) {
      return {
        type: 'FeatureCollection',
        features: paceSegments(points, paceRamp.length).map((segment) => ({
          type: 'Feature',
          properties: { level: segment.level },
          geometry: { type: 'LineString', coordinates: segment.coordinates },
        })),
      };
    }
    const bySegment: Record<number, TrackPoint[]> = {};
    for (const p of points) (bySegment[p.segment] ??= []).push(p);
    return {
      type: 'FeatureCollection',
      features: Object.values(bySegment)
        .filter((segment) => segment.length >= 2)
        .map((segment) => ({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: simplify(segment, 1.5).map((p) => [p.lon, p.lat]),
          },
        })),
    };
  }, [points, colorByPace]);

  const first = points[0];
  const last = points[points.length - 1];
  const markers = useMemo<GeoJSON.FeatureCollection>(() => {
    const features: GeoJSON.Feature[] = [];
    if (first && mode === 'fit') {
      features.push(pointFeature(first, 'start'));
    }
    if (last) features.push(pointFeature(last, mode === 'fit' ? 'end' : 'current'));
    return { type: 'FeatureCollection', features };
  }, [first, last, mode]);

  const bounds = useMemo(() => {
    const b = boundsOf(points);
    return b
      ? ([b.minLon, b.minLat, b.maxLon, b.maxLat] as [number, number, number, number])
      : null;
  }, [points]);

  const camera =
    mode === 'fit' && bounds
      ? { bounds, padding: { top: 48, left: 40, right: 40, bottom: 48 + bottomInset }, duration: 0 }
      : last
        ? {
            center: [last.lon, last.lat] as [number, number],
            zoom: 15.3,
            padding: { top: 0, left: 0, right: 0, bottom: bottomInset },
            duration: 800,
            easing: 'ease' as const,
          }
        : initialCenter
          ? { center: initialCenter, zoom: 14, duration: 0 }
          : { zoom: 2, duration: 0 };

  const lineColor: unknown = colorByPace
    ? [
        'match',
        ['get', 'level'],
        ...paceRamp.flatMap((color, level) => [level, color]),
        colors.accent,
      ]
    : colors.accent;

  return (
    <View style={[styles.container, style]} testID={testID}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={MAP_STYLES[scheme]}
        attribution
        attributionPosition={{ top: 8, right: 8 }}
        logo={false}
        compass={false}
        scaleBar={false}
        dragPan={interactive}
        touchZoom={interactive}
        touchRotate={false}
        touchPitch={false}>
        <Camera {...camera} />
        <GeoJSONSource id="route" data={route} lineMetrics={false}>
          <Layer
            id="route-casing"
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{
              'line-color': scheme === 'dark' ? '#0D0F12' : '#FFFFFF',
              'line-width': 9,
              'line-opacity': 0.9,
            }}
          />
          <Layer
            id="route-line"
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            // The expression type from the style spec is deeper than TS can check here.
            paint={{ 'line-color': lineColor as string, 'line-width': 5 }}
          />
        </GeoJSONSource>
        <GeoJSONSource id="markers" data={markers}>
          <Layer
            id="marker-halo"
            type="circle"
            paint={{
              'circle-radius': ['match', ['get', 'kind'], 'current', 14, 9],
              'circle-color': ['match', ['get', 'kind'], 'current', colors.accent, '#FFFFFF'],
              'circle-opacity': ['match', ['get', 'kind'], 'current', 0.22, 1],
            }}
          />
          <Layer
            id="marker-dot"
            type="circle"
            paint={{
              'circle-radius': 6,
              'circle-color': [
                'match',
                ['get', 'kind'],
                'start',
                colors.success,
                'end',
                colors.text,
                colors.accent,
              ],
              'circle-stroke-color': '#FFFFFF',
              'circle-stroke-width': 2,
            }}
          />
        </GeoJSONSource>
      </Map>
    </View>
  );
}

function pointFeature(point: TrackPoint, kind: 'start' | 'end' | 'current'): GeoJSON.Feature {
  return {
    type: 'Feature',
    properties: { kind },
    geometry: { type: 'Point', coordinates: [point.lon, point.lat] },
  };
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
});
