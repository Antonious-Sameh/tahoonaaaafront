import { apiGet, apiPost, apiDelete, withQuery } from '@/lib/apiClient';

export const listSupplierPayments = (params) => apiGet(withQuery('/supplier-payments', params));
export const createSupplierPayment = (data) => apiPost('/supplier-payments', data);
export const deleteSupplierPayment = (id) => apiDelete(`/supplier-payments/${id}`);