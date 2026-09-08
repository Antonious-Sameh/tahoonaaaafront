import { apiGet, apiPost, withQuery } from '@/lib/apiClient';

export const listPurchases = (params) => apiGet(withQuery('/purchases', params));
export const getPurchase = (id) => apiGet(`/purchases/${id}`);
export const createPurchase = (data) => apiPost('/purchases', data);
