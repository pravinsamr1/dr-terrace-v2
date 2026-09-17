/**
 * Form and Input validation utility functions
 */

export const sanitizeNumeric = (text) => {
  if (typeof text !== "string") return "";
  return text.replace(/[^0-9]/g, "");
};

export const sanitizeDecimal = (text) => {
  if (typeof text !== "string") return "";
  // Allow only digits and at most one decimal point
  const sanitized = text.replace(/[^0-9.]/g, "");
  const parts = sanitized.split(".");
  if (parts.length > 2) {
    return `${parts[0]}.${parts.slice(1).join("")}`;
  }
  return sanitized;
};

export const isValidPhone = (phone) => {
  if (!phone) return false;
  const digits = phone.replace(/[^0-9]/g, "");
  // Exactly 10 digits starting with 6, 7, 8, or 9 (Indian mobile numbers) or valid 10-digit mobile
  return digits.length === 10 && /^[6-9]\d{9}$/.test(digits);
};

export const isValidAadhaar = (aadhaar) => {
  if (!aadhaar) return false;
  const digits = aadhaar.replace(/[^0-9]/g, "");
  return digits.length === 12;
};

export const isValidPassword = (password, minLength = 4) => {
  if (!password) return false;
  return password.trim().length >= minLength;
};

export const isValidPositiveNumber = (val) => {
  if (val === null || val === undefined || val === "") return false;
  const num = Number(val);
  return !isNaN(num) && num > 0;
};

export const isValidNonNegativeNumber = (val) => {
  if (val === null || val === undefined || val === "") return false;
  const num = Number(val);
  return !isNaN(num) && num >= 0;
};

export const isValidDateString = (dateStr) => {
  if (!dateStr || typeof dateStr !== "string") return false;
  const parts = dateStr.trim().split(/[-/.]/);
  if (parts.length !== 3) return false;

  let day, month, year;
  if (parts[0].length === 4) {
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
  } else {
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    year = parseInt(parts[2], 10);
  }

  if (isNaN(day) || isNaN(month) || isNaN(year)) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 1900 || year > 2100) return false;

  const date = new Date(year, month - 1, day);
  return (
    date.getDate() === day &&
    date.getMonth() === month - 1 &&
    date.getFullYear() === year
  );
};

export const isPastDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== "string") return false;
  const trimmed = dateStr.trim();
  const parts = trimmed.split(/[-/.]/);
  if (parts.length !== 3) return false;

  let day, month, year;
  if (parts[0].length === 4) {
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
  } else {
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    year = parseInt(parts[2], 10);
  }

  if (isNaN(day) || isNaN(month) || isNaN(year)) return false;

  const date = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return date < today;
};
