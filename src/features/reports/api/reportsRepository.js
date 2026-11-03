import { cacheDirectory, deleteAsync, downloadAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { apiClient } from '../../../core/api/apiClient';
import { API_BASE_URL, API_ENDPOINTS } from '../../../core/config/config';
import { authRepository } from '../../auth/api/authRepository';

// Safety limit when adding up every paid row of a month
const MAX_PAGES = 20;

const unwrap = (response) => response?.data?.data ?? response?.data ?? null;

const cleanParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );

const toPage = (data) => ({
  items: Array.isArray(data) ? data : data?.items || [],
  page: data?.page || 1,
  totalPages: data?.totalPages || 1,
  totalItems: data?.totalItems ?? (Array.isArray(data) ? data.length : 0),
});

const get = async (path, params) =>
  unwrap(await apiClient.get(path, { params: cleanParams(params) }));

/** First and last day of a YYYY-MM month, for the routes that filter by date range */
export const monthToRange = (month) => {
  const [year, mon] = month.split('-').map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  return { fromDate: `${month}-01`, toDate: `${month}-${String(lastDay).padStart(2, '0')}` };
};

export const reportsRepository = {
  getHome: (month) => get(API_ENDPOINTS.REPORTS_HOME, { month }),
  getAppointmentOverview: (params) => get(API_ENDPOINTS.REPORTS_APPOINTMENTS, params),

  getAppointments: async (params) => toPage(await get(`${API_ENDPOINTS.QUOTATION_REPORTS}/appointments`, params)),
  getFollowUpSummary: async (params) => (await get(`${API_ENDPOINTS.QUOTATION_REPORTS}/summary`, params))?.followUps || null,
  getFollowUpsDue: async (params) => toPage(await get(`${API_ENDPOINTS.QUOTATION_REPORTS}/follow-ups/due`, params)),

  /** Follow-up rows have no phone number, so it is read from the appointment report when Call is pressed */
  getCustomerMobile: async (appointmentId) => {
    const page = toPage(await get(`${API_ENDPOINTS.QUOTATION_REPORTS}/appointments`, { appointmentId, limit: 1 }));
    return page.items[0]?.customerMobile || '';
  },

  /** Bars for two date ranges. Each range is one conversion report: the same numbers the API guide maps to these bars. */
  getAppointmentComparison: async ({ primary, baseline, employeeId }) => {
    const [current, previous] = await Promise.all([
      get(`${API_ENDPOINTS.QUOTATION_REPORTS}/conversion`, { ...primary, employeeId }),
      get(`${API_ENDPOINTS.QUOTATION_REPORTS}/conversion`, { ...baseline, employeeId }),
    ]);
    return [
      { label: 'Visits', key: 'appointments' },
      { label: 'Quotes Given', key: 'quoted' },
      { label: 'Won Deals', key: 'converted' },
      { label: 'Pending', key: 'open' },
    ].map(({ label, key }) => ({ label, previous: previous?.totals?.[key], current: current?.totals?.[key] }));
  },

  /** Summaries for the two months in the stat cards. Payment reports only filter by month. */
  getCollectionStats: async ({ primary, baseline, employeeId }) => {
    const [current, previous] = await Promise.all([
      get(`${API_ENDPOINTS.PAYMENT_REPORTS}/summary`, { month: primary, employeeId }),
      get(`${API_ENDPOINTS.PAYMENT_REPORTS}/summary`, { month: baseline, employeeId }),
    ]);
    return { current, previous };
  },

  /** Amount collected in each of the `count` months ending with `endMonth`, oldest first */
  getCollectionTrend: async ({ endMonth, count, employeeId }) => {
    const [year, mon] = endMonth.split('-').map(Number);
    const months = Array.from({ length: count }, (_, i) => {
      const date = new Date(year, mon - 1 - (count - 1 - i), 1);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    });
    const summaries = await Promise.all(
      months.map((month) => get(`${API_ENDPOINTS.PAYMENT_REPORTS}/summary`, { month, employeeId }))
    );
    return months.map((month, i) => ({ month, collected: summaries[i]?.collected }));
  },

  /**
   * Amount paid per day or per week of one month, added up from the paid payment rows.
   * The API has no daily or weekly totals. Returns null when the rows carry no payment date.
   */
  getCollectionsByDay: async ({ month, employeeId, groupBy }) => {
    const rows = [];
    for (let page = 1, totalPages = 1; page <= totalPages && page <= MAX_PAGES; page += 1) {
      const result = toPage(await get(`${API_ENDPOINTS.PAYMENT_REPORTS}/payments`, { month, employeeId, status: 'PAID', page, limit: 100 }));
      rows.push(...result.items);
      totalPages = result.totalPages;
    }
    const [year, mon] = month.split('-').map(Number);
    const daysInMonth = new Date(year, mon, 0).getDate();
    const totals = Array(daysInMonth).fill(0);
    let dated = 0;
    rows.filter((row) => row.kind === 'payment').forEach((row) => {
      const raw = row.date || row.paidAt || row.paymentDate || row.createdAt;
      const date = raw && new Date(String(raw).length === 10 ? `${raw}T00:00:00` : raw);
      if (!date || Number.isNaN(date.getTime()) || date.getFullYear() !== year || date.getMonth() !== mon - 1) return;
      totals[date.getDate() - 1] += Number(row.amount) || 0;
      dated += 1;
    });
    if (rows.length > 0 && dated === 0) return null;
    if (groupBy === 'day') return totals.map((value, i) => ({ label: String(i + 1), value }));
    const weeks = [];
    for (let start = 0; start < daysInMonth; start += 7) {
      weeks.push({ label: `W${weeks.length + 1}`, value: totals.slice(start, start + 7).reduce((sum, v) => sum + v, 0) });
    }
    return weeks;
  },

  getCollectionsOverview: (params) => get(`${API_ENDPOINTS.PAYMENT_REPORTS}/overview`, params),
  getCollectionsSummary: (params) => get(`${API_ENDPOINTS.PAYMENT_REPORTS}/summary`, params),
  getPayments: async (params) =>
    toPage(await get(`${API_ENDPOINTS.PAYMENT_REPORTS}/payments`, { basis: 'receivable', ...params })),

  getReceivablesSummary: (params) => get(`${API_ENDPOINTS.PAYMENT_REPORTS}/receivables/summary`, params),
  getReceivables: async (params) => toPage(await get(`${API_ENDPOINTS.PAYMENT_REPORTS}/receivables`, params)),

  /** Downloads a CSV with the login token and opens the share sheet */
  exportCsv: async (path, params, filename) => {
    const token = await authRepository.getToken();
    const query = new URLSearchParams(cleanParams(params)).toString();
    const target = `${cacheDirectory}${filename}`;
    const result = await downloadAsync(`${API_BASE_URL}${path}${query ? `?${query}` : ''}`, target, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // downloadAsync does not throw on HTTP errors, so an error page would otherwise be shared as the CSV
    if (result.status < 200 || result.status >= 300) {
      await deleteAsync(target, { idempotent: true });
      throw new Error(
        result.status === 403
          ? 'You do not have permission to export this report.'
          : `The report could not be exported (HTTP ${result.status}).`
      );
    }
    await Sharing.shareAsync(result.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
  },
};
