import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { toAppError } from '@/core/errors/AppError';

/**
 * File-system edges of export and import. The GPX itself is built and parsed
 * by pure functions in ../lib; this only moves strings in and out of files.
 */
export type GpxFiles = {
  share(fileName: string, gpx: string): Promise<void>;
  /** Resolves to null when the user cancels the picker. */
  pick(): Promise<{ name: string; text: string } | null>;
};

export function createGpxFiles(): GpxFiles {
  return {
    async share(fileName, gpx) {
      try {
        const file = new File(Paths.cache, fileName);
        if (file.exists) file.delete();
        file.write(gpx);
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/gpx+xml',
          UTI: 'com.topografix.gpx',
          dialogTitle: 'Export GPX',
        });
      } catch (error) {
        throw toAppError(error, 'EXPORT_FAILED');
      }
    },
    async pick() {
      const result = await DocumentPicker.getDocumentAsync({
        // GPX has no registered MIME type on most systems; filter by content instead.
        type: [
          'application/gpx+xml',
          'application/xml',
          'text/xml',
          'application/octet-stream',
          '*/*',
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return null;
      const asset = result.assets[0];
      if (!asset) return null;
      return { name: asset.name, text: await new File(asset.uri).text() };
    },
  };
}
