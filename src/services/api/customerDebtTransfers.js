import { apiGet, apiPost, withQuery } from '@/lib/apiClient';

// No delete: a debt transfer is a permanent record — a wrong one is
// corrected by recording a transfer the other way.
export const listCustomerDebtTransfers = (params) => apiGet(withQuery('/customer-debt-transfers', params));
export const createCustomerDebtTransfer = (data) => apiPost('/customer-debt-transfers', data);
