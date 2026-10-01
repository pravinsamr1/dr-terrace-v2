import { cacheDirectory, copyAsync, deleteAsync, getInfoAsync, writeAsStringAsync } from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { TurboModuleRegistry } from 'react-native';

/**
 * Shared "HTML -> PDF file in the app cache -> share sheet" flow used by the quotation, receipt, warranty
 * and proforma screens.
 *
 * Why the PDF bytes are written to the cache folder ourselves: the file expo-print returns lives under
 * cache/Print/, which JS (copyAsync / shareAsync) cannot read in Expo Go. printToFileAsync({ base64: true })
 * + writeAsStringAsync into cacheDirectory works in Expo Go, dev builds and release builds.
 */

/** Keeps letters, digits, "_" and "-". Names that contain no such characters (e.g. Tamil) fall back to `fallback`. */
export const toSafeFileName = (value, fallback = 'Customer') => {
  const cleaned = String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return /^_*$/.test(cleaned) ? fallback : cleaned;
};

/**
 * Prints `html` to a PDF and returns a file:// uri that can be shared. The file is named `fileName` inside the
 * app cache folder; an existing file with that name is replaced. Pass width/height (points) to override the
 * expo-print default page size (US Letter).
 */
export const createPdfFile = async ({ html, fileName, width, height }) => {
  const printOptions = { html, base64: true };
  if (width && height) {
    printOptions.width = width;
    printOptions.height = height;
  }
  const { uri, base64 } = await Print.printToFileAsync(printOptions);
  const targetUri = cacheDirectory ? `${cacheDirectory}${fileName}` : null;

  if (targetUri && base64) {
    try {
      await writeAsStringAsync(targetUri, base64, { encoding: 'base64' });
      return targetUri;
    } catch (writeErr) {
      console.warn('PDF write failed, trying to copy the print file:', writeErr?.message);
    }
  }

  if (targetUri && uri) {
    try {
      const existing = await getInfoAsync(targetUri);
      if (existing.exists) await deleteAsync(targetUri, { idempotent: true });
      await copyAsync({ from: uri, to: targetUri });
      return targetUri;
    } catch (copyErr) {
      console.warn('PDF copy failed, using the print file directly:', copyErr?.message);
    }
  }

  if (!uri) throw new Error('The PDF could not be created. Please try again.');
  return uri;
};

/** Opens the system share sheet for a PDF file. */
export const sharePdfFile = async ({ uri, title }) => {
  // TEMP TEST BUILD F: send through react-native-share instead of expo-sharing (installed builds only)
  if (TurboModuleRegistry.get('RNShare')) {
    const RNShare = require('react-native-share');
    const Share = RNShare?.default ?? RNShare;
    await Share.open({
      url: uri,
      type: 'application/pdf',
      filename: String(uri).split('/').pop(),
      title,
      failOnCancel: false,
    });
    return;
  }
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not supported on this device.');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: title,
    UTI: 'com.adobe.pdf',
  });
};
