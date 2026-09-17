import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Trash2, Upload, Loader2 } from 'lucide-react';
import * as uploadsApi from '@/services/api/uploads';
import { ProductImage } from './ProductImage';
import { btnOutline } from './styles';

const MAX_SIZE_MB = 3;
// Cap the longer side at this many pixels before upload — plenty for how
// product photos are actually shown in this app (small thumbnails in
// tables/cards, one modest preview in the picker itself), while cutting a
// typical phone-camera photo (often 3000px+ on the long side) down
// dramatically before it ever leaves the device.
const MAX_DIMENSION = 1400;
const JPEG_QUALITY = 0.82;

/**
 * Resizes + re-encodes an image file as JPEG via a canvas, entirely in the
 * browser, before it's uploaded — a typical phone-camera photo (several MB,
 * far larger than this app ever displays it) otherwise had to travel over
 * the network at its full original size, which is what made uploading on a
 * slow connection feel so much slower than it needed to be. Falls back to
 * the ORIGINAL file (never blocks the upload) if anything about this fails
 * — an unusual format the browser can't decode, for instance — so a
 * compression hiccup never becomes "I can't upload a photo at all".
 */
async function compressImage(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob) return file; // canvas encoding unsupported/failed — fall back to the original

    // Only worth using if it's actually smaller — a tiny source image or an
    // already-compressed JPEG can occasionally come out larger after
    // re-encoding, in which case the original is the better upload.
    if (blob.size >= file.size) return file;

    return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
  } catch {
    return file; // any decoding error — fall back to the original file
  }
}

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
  const [compressing, setCompressing] = useState(false);

  const processFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('من فضلك اختر ملف صورة صالح'); return; }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) { toast.error(`حجم الصورة كبير جداً، الحد الأقصى ${MAX_SIZE_MB}MB`); return; }

    setCompressing(true);
    const toUpload = await compressImage(file);
    setCompressing(false);

    setUploading(true);
    try {
      const url = await uploadToCloudinary(toUpload);
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
              disabled={uploading || compressing}
              className={`${btnOutline} !h-8.5 !px-3 !text-xs`}
              onClick={() => inputRef.current?.click()}
            >
              {(uploading || compressing) ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {compressing ? 'جارِ التجهيز...' : uploading ? 'جارِ الرفع...' : value ? 'تغيير الصورة' : 'رفع صورة'}
            </button>
            {value && !uploading && !compressing && (
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
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading || compressing} />
      </div>
    </div>
  );
}

export default ProductImagePicker;