import { useState } from 'react';
import { classNames } from '../../utils/class-names';

const sizes = {
  xs: 'size-3.5 text-[7px]',
  sm: 'size-5 text-[8px]',
  md: 'size-7 text-[10px]',
  lg: 'size-9 text-xs',
} as const;

/**
 * A coin's logo (from CoinPaprika, `logoUrl` of the pair), or its first two
 * letters when there is none or the image fails to load. Decorative: the
 * symbol is always written next to it, so the letters are drawn by CSS and
 * stay out of the row's text.
 */
export function CoinLogo({
  src,
  symbol,
  size = 'md',
  className,
}: {
  src: string | null | undefined;
  symbol: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = Boolean(src) && failed !== src;
  return (
    <span
      aria-hidden="true"
      data-testid="coin-logo"
      data-letters={showImage ? undefined : symbol.slice(0, 2)}
      className={classNames(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line-strong bg-raised font-bold text-fg-2 before:content-[attr(data-letters)]',
        sizes[size],
        className,
      )}
    >
      {showImage ? (
        <img
          src={src ?? undefined}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(src ?? null)}
          className="size-full object-cover"
        />
      ) : null}
    </span>
  );
}
