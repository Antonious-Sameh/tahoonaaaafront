import { apiGet, apiPost, apiDelete, withQuery } from '@/lib/apiClient';

export const listCashboxTransactions = (params) => apiGet(withQuery('/cashbox', params));
export const getCashboxSummary = () => apiGet('/cashbox/summary');
export const createCashTransaction = (data) => apiPost('/cashbox', data);
export const deleteCashTransaction = (id) => apiDelete(`/cashbox/${id}`);