import { useState } from 'react';
import { Package } from 'lucide-react';

// Displays a product's image if available, and falls back to a neutral
// placeholder icon when there is no image or the image fails to load.
// This keeps the product-listing UI stable regardless of whether the
// (future) backend/Cloudinary image has been set yet.
export function ProductImage({ src, alt, size = 'md', className = '' }) {
  const [failed, setFailed] = useState(false);

  const sizes = {
    sm: 'h-10 w-10',
    md: 'h-16 w-16',
    lg: 'h-28 w-28',
  };
  const dim = sizes[size] || sizes.md;

  if (!src || failed) {
    return (
      <div className={`flex ${dim} shrink-0 items-center justify-center rounded-lg border bg-muted/60 text-muted-foreground ${className}`}>
        <Package size={size === 'lg' ? 32 : size === 'sm' ? 16 : 22} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || ''}
      onError={() => setFailed(true)}
      className={`${dim} shrink-0 rounded-lg border object-cover ${className}`}
    />
  );
}

export default ProductImage;
