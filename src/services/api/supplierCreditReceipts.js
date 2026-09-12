import { apiGet, apiPost, apiDelete, withQuery } from '@/lib/apiClient';

export const listSupplierCreditReceipts = (params) => apiGet(withQuery('/supplier-credit-receipts', params));
export const createSupplierCreditReceipt = (data) => apiPost('/supplier-credit-receipts', data);
export const deleteSupplierCreditReceipt = (id) => apiDelete(`/supplier-credit-receipts/${id}`);