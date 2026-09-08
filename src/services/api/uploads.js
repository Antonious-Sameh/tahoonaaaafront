import { apiGet } from '@/lib/apiClient';

// Returns a short-lived signature for a direct browser-to-Cloudinary
// upload — see src/components/shop/ProductImagePicker.jsx, which is the
// only place that actually performs the upload. The image bytes never
// pass through our own backend.
export const getUploadSignature = () => apiGet('/uploads/signature');
