import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Trash2, Upload, Loader2 } from 'lucide-react';
import * as uploadsApi from '@/services/api/uploads';
import { ProductImage } from './ProductImage';
import { btnOutline } from './styles';

const MAX_SIZE_MB = 3;

/**
 * Uploads a product image directly from the browser to Cloudinary — the
 * only place in this component (and the whole frontend) that does. The
 * backend only ever hands out a short-lived signed token
 * (GET /api/uploads/signature); the actual image bytes never pass through
 * our own server, matching the confirmed original design (see the
 * backend's Product.js `image` field comment).
 */
async function uploadToCloudinary(file) {
  const { data: sig } = await uploadsApi.getUploadSignature();

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', sig.apiKey);
  formData.append('timestamp', sig.timestamp);
  formData.append('signature', sig.signature);
  formData.append('folder', sig.folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  });
  const json = await res.json().catch(() => null);

  if (!res.ok || !json?.secure_url) {
    throw new Error(json?.error?.message || 'تعذر رفع الصورة إلى الخادم');
  }

  return json.secure_url;
}

export function ProductImagePicker({ value, onChange, label = 'صورة المنتج' }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const processFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('من فضلك اختر ملف صورة صالح'); return; }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) { toast.error(`حجم الصورة كبير جداً، الحد الأقصى ${MAX_SIZE_MB}MB`); return; }

    setUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      onChange(url);
    } catch (err) {
      toast.error(err.message || 'تعذر رفع الصورة، حاول مرة أخرى');
    } finally {
      setUploading(false);
    }
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    processFile(file);
  };

  return (
    <div className="grid gap-2">
      <label className="text-sm font-semibold text-foreground">{label}</label>
      <div className="flex items-center gap-4 rounded-xl border border-dashed border-border bg-slate-50/50 p-3 transition-colors hover:bg-slate-50">
        <ProductImage src={value} alt={label} size="lg" className="rounded-lg shadow-xs" />
        <div className="flex flex-col gap-2">
          <div className="text-xs text-muted-foreground">
            الحد الأقصى بحجم {MAX_SIZE_MB} ميجابايت (PNG, JPG, WEBP)
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={uploading}
              className={`${btnOutline} !h-8.5 !px-3 !text-xs`}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading ? 'جارِ الرفع...' : value ? 'تغيير الصورة' : 'رفع صورة'}
            </button>
            {value && !uploading && (
              <button
                type="button"
                className={`${btnOutline} !h-8.5 !px-3 !text-xs border-red-200 text-red-600 hover:bg-red-50`}
                onClick={() => onChange('')}
              >
                <Trash2 size={14} /> حذف
              </button>
            )}
          </div>
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
      </div>
    </div>
  );
}

export default ProductImagePicker;
