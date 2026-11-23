/** Game icons are tiny pixel art: scale them crisply. */
export function ItemIcon({ src, size = 36, className = "" }: { src: string | null; size?: number; className?: string }) {
  if (!src) return <span style={{ width: size, height: size }} className={`inline-block shrink-0 ${className}`} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className={`shrink-0 object-contain ${className}`}
      style={{ width: size, height: size, imageRendering: size > 40 ? "pixelated" : undefined }}
    />
  );
}
