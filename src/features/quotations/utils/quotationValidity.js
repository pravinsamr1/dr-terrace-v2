/**
 * The quotation API takes `validTill` as a YYYY-MM-DD date (the "Quote Valid till DD-MM-YY" sentence is derived by
 * the server). The form still shows that sentence, so pull the date back out of it.
 * Accepts YYYY-MM-DD, DD-MM-YYYY and DD-MM-YY (also with / or . separators); returns null when there is no real date.
 */
export const extractValidTillDate = (text) => {
  const str = String(text ?? '');
  let year;
  let month;
  let day;

  const ymd = str.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/);
  if (ymd) {
    [, year, month, day] = ymd;
  } else {
    const dmy = str.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})(?!\d)/);
    if (!dmy) return null;
    day = dmy[1];
    month = dmy[2];
    year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
  }

  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;

  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};
