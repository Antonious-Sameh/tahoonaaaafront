import { apiGet, apiPost, withQuery } from '@/lib/apiClient';

export const listCustomerPayments = (params) => apiGet(withQuery('/customer-payments', params));
export const createCustomerPayment = (data) => apiPost('/customer-payments', data);
