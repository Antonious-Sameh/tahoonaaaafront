import { apiGet, apiPost, withQuery } from '@/lib/apiClient';

export const listSupplierPayments = (params) => apiGet(withQuery('/supplier-payments', params));
export const createSupplierPayment = (data) => apiPost('/supplier-payments', data);
