import { cacheDirectory, copyAsync, deleteAsync, getInfoAsync, writeAsStringAsync } from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

/**
 * Shared "HTML -> PDF file in the app cache -> expo-sharing" flow used by the quotation, receipt, warranty
 * and proforma screens.
 *
 * Why the PDF bytes are written to cacheDirectory: the file expo-print returns lives under
 * cache/Print/, which JS (copyAsync / shareAsync) cannot read in Expo Go. printToFileAsync({ base64: true })
 * + writeAsStringAsync into cacheDirectory works in Expo Go, dev builds, and release builds.
 *
 * expo-sharing's SharingFileProvider automatically grants package-level READ_URI_PERMISSION
 * to WhatsApp (via context.grantUriPermission), which allows WhatsApp's background PDF renderer
 * to read the file descriptor and generate the first-page thumbnail preview.
 */

/** Standard A4 dimensions in points (72 DPI): 8.27in x 11.69in = 595 x 842 */
const DEFAULT_A4_WIDTH = 595;
const DEFAULT_A4_HEIGHT = 842;

/** Keeps letters, digits, "_" and "-". Names that contain no such characters (e.g. Tamil) fall back to `fallback`. */
export const toSafeFileName = (value, fallback = 'Customer') => {
  const cleaned = String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return /^_*$/.test(cleaned) ? fallback : cleaned;
};

/**
 * Prints `html` to a PDF and returns a file:// uri that can be shared. The file is named `fileName` inside the
 * app cache folder; an existing file with that name is replaced.
 * Uses standard A4 dimensions (595 x 842 points) by default so Android and iOS PDF renderers
 * have consistent MediaBox bounds to generate page thumbnails.
 */
export const createPdfFile = async ({ html, fileName, width = DEFAULT_A4_WIDTH, height = DEFAULT_A4_HEIGHT }) => {
  const printOptions = { html, width, height, base64: true };
  const { uri, base64 } = await Print.printToFileAsync(printOptions);
  const targetUri = cacheDirectory ? `${cacheDirectory}${fileName}` : null;

  if (targetUri && base64) {
    try {
      const existing = await getInfoAsync(targetUri);
      if (existing.exists) await deleteAsync(targetUri, { idempotent: true });
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

/** Opens the system share sheet for a PDF file using Expo's SharingFileProvider. */
export const sharePdfFile = async ({ uri, title }) => {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not supported on this device.');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: title,
    UTI: 'com.adobe.pdf',
  });
};

/**
 * Shares a PDF file to WhatsApp using expo-sharing.
 *
 * expo-sharing's native SharingModule queries all intent activities and calls
 * `context.grantUriPermission(packageName, contentUri, Intent.FLAG_GRANT_READ_URI_PERMISSION)`
 * for com.whatsapp. This gives WhatsApp's background PdfRenderer worker the persistent
 * file access required to generate the first-page thumbnail.
 */
export const shareToWhatsApp = async ({ uri, title }) => {
  return sharePdfFile({ uri, title });
};
