import { API_BASE_URL } from '../config/config';

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
