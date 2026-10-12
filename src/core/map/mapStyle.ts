/**
 * Key-less vector tiles from OpenFreeMap (https://openfreemap.org), built from
 * OpenStreetMap data with the OpenMapTiles schema. No account, no API key, no
 * usage tracking. Attribution (OpenFreeMap, OpenMapTiles, OpenStreetMap
 * contributors) is carried by the style and shown by the map's info button.
 */
export const MAP_STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
} as const;

export const MAP_ATTRIBUTION = '© OpenFreeMap © OpenMapTiles © OpenStreetMap contributors';
