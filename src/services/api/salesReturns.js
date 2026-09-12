import { apiGet, apiPost, withQuery } from "@/lib/apiClient";

export const listSalesReturns = (params) =>
  apiGet(withQuery("/sales-returns", params));
export const getReturnableForSale = (saleId) =>
  apiGet(`/sales-returns/returnable/${saleId}`);
export const createSalesReturn = (data) => apiPost("/sales-returns", data);
