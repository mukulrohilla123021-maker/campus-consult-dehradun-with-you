import { useEffect, useState } from 'react';
import { Briefcase } from 'lucide-react';

interface SmartImageProps {
  src?: string;
  fallbackSrc?: string;
  alt: string;
  fallbackLabel?: string;
  className?: string;
  imgClassName?: string;
  aspectClass?: string;
}

export function SmartImage({
  src,
  fallbackSrc,
  alt,
  fallbackLabel,
  className = '',
  imgClassName = 'w-full h-full object-cover',
  aspectClass = 'aspect-[4/3]',
}: SmartImageProps) {
  const [activeSrc, setActiveSrc] = useState(src || fallbackSrc || '');
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const next = src || fallbackSrc || '';
    setActiveSrc(next);
    setLoaded(false);
    setFailed(!next);
  }, [src, fallbackSrc]);

  const handleError = () => {
    if (fallbackSrc && activeSrc !== fallbackSrc) {
      setActiveSrc(fallbackSrc);
      setLoaded(false);
      return;
    }
    setFailed(true);
  };

  return (
    <div className={`relative overflow-hidden bg-zinc-100 ${aspectClass} ${className}`}>
      {!failed && !loaded && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-zinc-100 via-zinc-200/70 to-zinc-100 animate-pulse"
        />
      )}

      {!failed && activeSrc ? (
        <img
          src={activeSrc}
          alt={alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={handleError}
          className={`${imgClassName} transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-900 via-purple-800 to-zinc-900 text-white p-4 text-center">
          <Briefcase className="w-6 h-6 text-purple-200 mb-2" aria-hidden="true" />
          <span className="text-xs font-medium text-purple-100 line-clamp-2">
            {fallbackLabel || alt}
          </span>
        </div>
      )}
    </div>
  );
}
