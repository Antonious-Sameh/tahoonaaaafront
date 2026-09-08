import { apiGet, withQuery } from '@/lib/apiClient';

export const getSalesReport = (params) => apiGet(withQuery('/reports/sales', params));
export const getPurchasesReport = (params) => apiGet(withQuery('/reports/purchases', params));
export const getProfitReport = (params) => apiGet(withQuery('/reports/profit', params));
export const getInventoryReport = () => apiGet('/reports/inventory');
export const getCustomersReport = (params) => apiGet(withQuery('/reports/customers', params));
export const getSuppliersReport = (params) => apiGet(withQuery('/reports/suppliers', params));
