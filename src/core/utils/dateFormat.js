/**
 * Date formatting utility for Dr. Terrace
 * Standard display format: DD-MM-YY (e.g. 12-12-26)
 */

/**
 * Format a Date object, ISO string, timestamp, or date string into DD-MM-YY (e.g. 12-12-26).
 *
 * @param {Date|string|number} dateInput
 * @returns {string} Formatted date string in DD-MM-YY format (e.g. 12-12-26)
 */
export const formatDateDDMMYY = (dateInput) => {
  if (!dateInput) return '';

  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
    const dd = String(dateInput.getDate()).padStart(2, '0');
    const mm = String(dateInput.getMonth() + 1).padStart(2, '0');
    const yy = String(dateInput.getFullYear()).slice(-2);
    return `${dd}-${mm}-${yy}`;
  }

  const str = String(dateInput).trim();
  if (!str) return '';

  // Match ISO YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdMatch) {
    const [, yyyy, mm, dd] = ymdMatch;
    return `${dd.padStart(2, '0')}-${mm.padStart(2, '0')}-${yyyy.slice(-2)}`;
  }

  // Match DD-MM-YYYY or DD/MM/YYYY
  const dmy4Match = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmy4Match) {
    const [, dd, mm, yyyy] = dmy4Match;
    return `${dd.padStart(2, '0')}-${mm.padStart(2, '0')}-${yyyy.slice(-2)}`;
  }

  // Match DD-MM-YY or DD/MM/YY
  const dmy2Match = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);
  if (dmy2Match) {
    const [, dd, mm, yy] = dmy2Match;
    return `${dd.padStart(2, '0')}-${mm.padStart(2, '0')}-${yy}`;
  }

  // Fallback to new Date(str)
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const dd = String(parsed.getDate()).padStart(2, '0');
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const yy = String(parsed.getFullYear()).slice(-2);
    return `${dd}-${mm}-${yy}`;
  }

  return str;
};

/**
 * Format date for API calls: YYYY-MM-DD
 * Supports Date objects, DD-MM-YY (e.g. 12-12-26), DD-MM-YYYY, YYYY-MM-DD
 */
export const toApiDateString = (dateInput) => {
  if (!dateInput) return new Date().toISOString().split('T')[0];

  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
    const y = dateInput.getFullYear();
    const m = String(dateInput.getMonth() + 1).padStart(2, '0');
    const d = String(dateInput.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const str = String(dateInput).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  const parts = str.split(/[-/.]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    const fullYear = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
    return `${fullYear}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }

  return new Date().toISOString().split('T')[0];
};

/**
 * Parse any date string (DD-MM-YY, DD-MM-YYYY, YYYY-MM-DD, ISO) into a valid Date object.
 */
export const parseDateToDateObj = (dateInput) => {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) return dateInput;

  const str = String(dateInput).trim();
  const parts = str.split(/[-/.]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const dt = new Date(y, m, d);
      if (!isNaN(dt.getTime())) return dt;
    } else {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      let y = parseInt(parts[2], 10);
      if (y < 100) y += 2000;
      const dt = new Date(y, m, d);
      if (!isNaN(dt.getTime())) return dt;
    }
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

export const formatDate = formatDateDDMMYY;

export default formatDateDDMMYY;
