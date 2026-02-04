interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  quality?: number;
  loading?: 'lazy' | 'eager';
  onError?: () => void;
}

function extractImageId(src: string): string | null {
  if (src.startsWith('/objects/uploads/')) {
    return src.replace('/objects/uploads/', '');
  }
  return null;
}

export function OptimizedImage({
  src,
  alt,
  width = 160,
  height,
  className = '',
  quality = 75,
  loading = 'lazy',
  onError
}: OptimizedImageProps) {
  const imageId = extractImageId(src);
  
  if (!imageId) {
    return (
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={className}
        loading={loading}
        decoding="async"
        onError={onError}
      />
    );
  }
  
  const params = new URLSearchParams();
  params.set('w', width.toString());
  if (height) params.set('h', height.toString());
  params.set('fmt', 'webp');
  params.set('q', quality.toString());
  
  const optimizedSrc = `/api/img/${imageId}?${params.toString()}`;
  
  const srcSet = [
    `${optimizedSrc} 1x`,
    `/api/img/${imageId}?w=${width * 2}${height ? `&h=${height * 2}` : ''}&fmt=webp&q=${quality} 2x`
  ].join(', ');
  
  return (
    <img
      src={optimizedSrc}
      srcSet={srcSet}
      alt={alt}
      width={width}
      height={height}
      className={className}
      loading={loading}
      decoding="async"
      onError={onError}
    />
  );
}
