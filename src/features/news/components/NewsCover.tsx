import { useState } from 'react';
import { Newspaper } from 'lucide-react';
import type { NewsArticle } from '../../../types/domain';

/**
 * The cover image of an article (D-125), shown from the outlet by its
 * address: nothing is copied. No referrer is sent, as some outlets refuse
 * an image linked from another site; an article without an image, or one
 * whose image fails to load, shows a placeholder with its primary coin.
 */
export function NewsCover({
  article,
  className,
  eager = false,
}: {
  article: Pick<NewsArticle, 'imageUrl' | 'coins'>;
  className: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const coin = article.coins[0]?.symbol;

  if (!article.imageUrl || failed)
    return (
      <div
        aria-hidden="true"
        className={
          'flex items-center justify-center gap-2 bg-raised text-muted-x ' +
          className
        }
      >
        <Newspaper size={22} />
        {coin && (
          <span className="font-mono text-sm font-semibold">{coin}</span>
        )}
      </div>
    );

  return (
    <img
      src={article.imageUrl}
      alt=""
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={'object-cover ' + className}
    />
  );
}
