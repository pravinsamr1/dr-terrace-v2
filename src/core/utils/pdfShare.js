import {
  cacheDirectory,
  copyAsync,
  deleteAsync,
  documentDirectory,
  EncodingType,
  getInfoAsync,
  moveAsync,
  readAsStringAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform, TurboModuleRegistry } from 'react-native';

/**
 * Shared "HTML → PDF file → share" flow used by the quotation, receipt, warranty and proforma screens.
 *
 * Key decisions:
 *
 * 1. cacheDirectory on Android
 *    On Android, cacheDirectory is configured in Expo's and react-native-share's FileProvider,
 *    allowing apps like WhatsApp to resolve content:// URIs cleanly.
 *
 * 2. Raw PDF bytes preserved
 *    Print.printToFileAsync produces a structurally valid PDF. We do NOT manipulate raw bytes
 *    or convert to base64, preserving xref tables and stream offsets so Android's PdfRenderer
 *    and WhatsApp can parse the file without error.
 *
 * 3. shareToWhatsApp uses react-native-share when available
 *    react-native-share's shareSingle with Social.Whatsapp fires a targeted ACTION_SEND intent
 *    directly to com.whatsapp, falling back to expo-sharing system share sheet.
 */

/** Standard A4 dimensions in points (72 DPI): 8.27in × 11.69in = 595 × 842 */
const DEFAULT_A4_WIDTH = 595;
const DEFAULT_A4_HEIGHT = 842;

/** Keeps letters, digits, "_" and "-". Names that contain no such characters fall back to `fallback`. */
export const toSafeFileName = (value, fallback = 'Customer') => {
  const cleaned = String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return /^_*$/.test(cleaned) ? fallback : cleaned;
};

/** Returns true when react-native-share's native module is linked (dev/release builds only). */
const isRNShareAvailable = () => {
  try {
    return !!TurboModuleRegistry.get('RNShare');
  } catch (_e) {
    return false;
  }
};

// Thumbnail manipulation removed: binary string parsing in Hermes corrupted
// the PDF cross-reference table and byte offsets, causing Android's PdfRenderer
// and WhatsApp to fail with 'Could not share'. The raw PDF from expo-print is structurally
// valid and should be shared directly without modification.

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Prints `html` to a PDF, copies it to cache with a safe filename,
 * verifies the raw PDF file, and returns the file:// URI.
 */
export const createPdfFile = async ({
  html,
  fileName,
  width  = DEFAULT_A4_WIDTH,
  height = DEFAULT_A4_HEIGHT,
}) => {
  // printToFileAsync uses the native Android WebView print adapter — same engine as the
  // system "Print & Save as PDF" dialog. The resulting PDF is structurally valid; no
  // post-processing of raw bytes is required.
  console.log('[PDF] printToFileAsync started');
  const { uri: printedUri } = await Print.printToFileAsync({ html, width, height });
  console.log('[PDF] PDF created');
  console.log('[PDF] PDF URI:', printedUri);

  // On Android, use cacheDirectory so both expo-sharing and react-native-share
  // (whose FileProvider configures <cache-path>) can resolve content:// URIs cleanly.
  const baseDir   = Platform.OS === 'android' ? (cacheDirectory || documentDirectory) : (documentDirectory || cacheDirectory);
  const targetUri = baseDir ? `${baseDir}${fileName}` : null;

  if (targetUri && printedUri) {
    try {
      const existing = await getInfoAsync(targetUri);
      if (existing.exists) await deleteAsync(targetUri, { idempotent: true });
      try {
        await copyAsync({ from: printedUri, to: targetUri });
      } catch (copyFailure) {
        console.warn('[pdfShare] copyAsync failed, trying moveAsync:', copyFailure?.message);
        try {
          await moveAsync({ from: printedUri, to: targetUri });
        } catch (moveFailure) {
          // The print file is not readable by this app (seen on Expo Go / some devices), so re-print
          // and take the PDF bytes straight from expo-print as base64 instead of reading the file.
          console.warn('[pdfShare] moveAsync failed, re-printing with base64 output:', moveFailure?.message);
          const printed = await Print.printToFileAsync({ html, width, height, base64: true });
          if (!printed?.base64) throw moveFailure;
          await writeAsStringAsync(targetUri, printed.base64, { encoding: EncodingType.Base64 });
        }
      }

      const fileInfo = await getInfoAsync(targetUri);
      console.log('[PDF] file exists:', !!fileInfo.exists);
      console.log('[PDF] file size:', fileInfo.size);

      try {
        const header = await readAsStringAsync(targetUri, { length: 5 });
        console.log('[PDF] PDF header valid:', header === '%PDF-');
      } catch (_) {}

      return targetUri;
    } catch (copyErr) {
      console.warn('[pdfShare] PDF copy failed, using the print file directly:', copyErr?.message, copyErr);
    }
  }

  if (!printedUri) throw new Error('The PDF could not be created. Please try again.');
  const fileInfo = await getInfoAsync(printedUri);
  console.log('[PDF] file exists:', !!fileInfo.exists);
  console.log('[PDF] file size:', fileInfo.size);
  return printedUri;
};

/** Opens the system share sheet for a PDF using Expo's SharingFileProvider. */
export const sharePdfFile = async ({ uri, title }) => {
  const pdfUri = uri;
  console.log('[PDF SHARE] URI:', pdfUri);
  console.log('[PDF SHARE] URI TYPE:', typeof pdfUri);
  console.log('[PDF SHARE] URI LENGTH:', pdfUri?.length);

  const canShare = await Sharing.isAvailableAsync();
  console.log('[PDF SHARE] CAN SHARE:', canShare);
  console.log('[PDF] sharing available:', canShare);
  if (!canShare) {
    throw new Error('Sharing is not available on this device');
  }

  if (!pdfUri) {
    throw new Error('PDF URI is invalid or null.');
  }

  const finalUri = pdfUri;
  console.log('[PDF SHARE] final URI:', finalUri);
  console.log('[PDF SHARE] FINAL URI:', finalUri);
  console.log('[PDF SHARE] URI type:', typeof finalUri);
  console.log('[PDF SHARE] FINAL URI TYPE:', typeof finalUri);
  console.log('[PDF SHARE] URI:', JSON.stringify(finalUri));
  console.log('[PDF SHARE] MIME:', 'application/pdf');

  console.log('[PDF] share/open started');
  await Sharing.shareAsync(finalUri, {
    mimeType:    'application/pdf',
    dialogTitle: title || 'Share quotation PDF',
    UTI:         'com.adobe.pdf',
  });
};

/**
 * Shares a PDF directly to WhatsApp on Android (dev/release builds) using
 * react-native-share's shareSingle which fires a targeted ACTION_SEND intent
 * to com.whatsapp with FLAG_GRANT_READ_URI_PERMISSION via ClipData.
 *
 * Falls back to Expo's system share sheet on iOS and Expo Go.
 */
export const shareToWhatsApp = async ({ uri, title, phone }) => {
  console.log('[PDF] share/open started');
  if (Platform.OS === 'android' && isRNShareAvailable()) {
    try {
      const RNShare = require('react-native-share');
      const Share   = RNShare?.default ?? RNShare;
      const Social  = Share?.Social ?? RNShare?.Social;
      if (Share?.shareSingle && Social?.Whatsapp) {
        console.log('[PDF SHARE] final URI:', uri);
        console.log('[PDF SHARE] URI type:', typeof uri);
        console.log('[PDF SHARE] URI:', JSON.stringify(uri));
        console.log('[PDF SHARE] MIME:', 'application/pdf');
        await Share.shareSingle({
          social:        Social.Whatsapp,
          url:           uri,
          type:          'application/pdf',
          filename:      String(uri).split('/').pop(),
          title,
          ...(phone ? { recipient: String(phone).replace(/[^0-9]/g, '') } : {}),
          failOnCancel:  false,
        });
        return;
      }
    } catch (rnShareErr) {
      console.warn('[pdfShare] react-native-share to WhatsApp failed, falling back:', rnShareErr?.message);
    }
  }
  return sharePdfFile({ uri, title });
};