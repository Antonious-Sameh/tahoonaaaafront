import { apiGet, apiPost, withQuery } from '@/lib/apiClient';

export const listPurchaseReturns = (params) => apiGet(withQuery('/purchase-returns', params));
export const getReturnableForPurchase = (purchaseId) => apiGet(`/purchase-returns/returnable/${purchaseId}`);
export const createPurchaseReturn = (data) => apiPost('/purchase-returns', data);
