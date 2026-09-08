import { apiGet, apiPost, withQuery } from '@/lib/apiClient';

export const listCashboxTransactions = (params) => apiGet(withQuery('/cashbox', params));
export const getCashboxSummary = () => apiGet('/cashbox/summary');
export const createCashTransaction = (data) => apiPost('/cashbox', data);
