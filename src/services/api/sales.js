import { apiGet, apiPost, withQuery } from '@/lib/apiClient';

export const listSales = (params) => apiGet(withQuery('/sales', params));
export const getSale = (id) => apiGet(`/sales/${id}`);
export const createSale = (data) => apiPost('/sales', data);
