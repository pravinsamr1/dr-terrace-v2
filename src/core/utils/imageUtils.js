import { getInfoAsync } from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { API_BASE_URL } from '../config/config';

/**
 * Compresses an image to fit within a target file size (≤ 300 KB).
 *
 * Strategy: start at quality 0.7 and step down by 0.1 until the file is ≤ 300 KB,
 * but never go below quality 0.2 to avoid unacceptable visual degradation.
 * If the image is already ≤ 300 KB it is returned unchanged.
 *
 * @param {string} uri - Local file URI of the image to compress.
 * @returns {Promise<string>} - URI of the compressed image (original if already small or on error).
 */
export async function compressImage(uri) {
  try {
    const originalInfo = await getInfoAsync(uri, { size: true });
    const originalSize = originalInfo.exists ? (originalInfo.size || 0) : 0;

    // Already within target — no compression needed
    if (originalSize > 0 && originalSize <= 300 * 1024) {
      return uri;
    }

    let quality = 0.7;
    let compressedUri = uri;

    while (quality >= 0.2) {
      const context = ImageManipulator.manipulate(compressedUri);
      const imageRef = await context.renderAsync();
      const result = await imageRef.saveAsync({
        format: SaveFormat.JPEG,
        compress: quality,
      });

      compressedUri = result.uri;
      const compressedInfo = await getInfoAsync(compressedUri, { size: true });
      const compressedSize = compressedInfo.exists ? (compressedInfo.size || 0) : 0;

      if (compressedSize > 0 && compressedSize <= 300 * 1024) {
        break;
      }

      quality -= 0.1;
    }

    return compressedUri;
  } catch (err) {
    console.warn('[compressImage] Compression failed, using original:', err);
    return uri;
  }
}

/**
 * Formats bytes into a human-readable file size string (e.g., "245 KB", "1.2 MB").
 *
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (!bytes || isNaN(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Derives the root server URL (origin) from API_BASE_URL by stripping `/api/v1` or `/api/v2` suffixes.
 * E.g., 'https://example.com/api/v2' -> 'https://example.com'
 */
export function getServerOrigin() {
  const base = API_BASE_URL || '';
  return base.replace(/\/api\/v[12]\/?$/i, '').replace(/\/$/, '');
}

/**
 * Resolves a backend proof image path or URL into a fully-qualified, reachable URL for React Native.
 *
 * Handles:
 * 1. Falsy values -> returns null.
 * 2. Local file URIs, data URIs, or blob URIs -> returns as-is.
 * 3. Relative paths (e.g. '/uploads/payments/xyz.png' or 'uploads/payments/xyz.png') -> prepends server origin.
 * 4. LAN / localhost URLs (e.g. 'http://192.168.1.10:9000/uploads/...') when connecting via remote/ngrok ->
 *    rewrites origin to active server origin so the device can access the image.
 * 5. Valid remote full URLs -> returns as-is.
 *
 * @param {string|null|undefined} pathOrUrl
 * @returns {string|null}
 */
export function resolveProofImageUrl(pathOrUrl) {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return null;

  const trimmed = pathOrUrl.trim();
  if (!trimmed) return null;

  // Local device file, data URI, or blob
  if (
    trimmed.startsWith('file://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('content://')
  ) {
    return trimmed;
  }

  const origin = getServerOrigin();

  // Relative path starting with '/'
  if (trimmed.startsWith('/')) {
    return origin ? `${origin}${trimmed}` : trimmed;
  }

  // Relative path without leading '/'
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return origin ? `${origin}/${trimmed}` : trimmed;
  }

  // If it is a full URL, check if it points to a local LAN/localhost IP that needs rewriting
  try {
    const parsed = new URL(trimmed);
    const originUrl = origin ? new URL(origin) : null;

    const isLocalHost =
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname.startsWith('192.168.') ||
      parsed.hostname.startsWith('10.') ||
      parsed.hostname.startsWith('172.');

    // If active origin is remote (not local), and the image URL has a local host, rewrite to remote origin
    if (originUrl && isLocalHost && originUrl.hostname !== parsed.hostname) {
      return `${origin}${parsed.pathname}${parsed.search}`;
    }

    return trimmed;
  } catch (_err) {
    // If URL parsing fails, fallback to prepending origin
    return origin ? `${origin}/${trimmed}` : trimmed;
  }
}

/**
 * Extracts a friendly filename from a proof image path or URL.
 *
 * @param {string|null|undefined} pathOrUrl
 * @param {string} [fallback]
 * @returns {string}
 */
export function getProofFilename(pathOrUrl, fallback = 'Proof_Document.png') {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return fallback;
  const clean = pathOrUrl.split('?')[0].split('#')[0];
  const parts = clean.split('/');
  const filename = parts[parts.length - 1];
  return filename && filename.includes('.') ? filename : fallback;
}
