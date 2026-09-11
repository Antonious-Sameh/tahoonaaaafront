import { apiGet, apiPost, apiDelete, withQuery } from '@/lib/apiClient';

export const listCustomerPayments = (params) => apiGet(withQuery('/customer-payments', params));
export const createCustomerPayment = (data) => apiPost('/customer-payments', data);
export const deleteCustomerPayment = (id) => apiDelete(`/customer-payments/${id}`);