import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { fieldControlClass } from '../../../components/ui/field-styles';
import { useCopy } from '../../../hooks/use-copy';
import type { MarketType } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';

export interface FeedFilterValue {
  coin: string;
  market: MarketType | '';
  q: string;
}

const SEARCH_MIN = 2;
const SEARCH_MAX = 100;
const DEBOUNCE_MS = 400;
const compact = classNames(fieldControlClass, 'h-9 py-0 text-xs');

/**
 * SRS 3.7.1 filters (coin tag, market type) and the D-99 search of titles
 * and texts, 2–100 characters; the search waits for the typing to stop.
 */
export function FeedFilters({
  value,
  onChange,
}: {
  value: FeedFilterValue;
  onChange: (value: FeedFilterValue) => void;
}) {
  const c = useCopy().community;
  const [coin, setCoin] = useState(value.coin);
  const [q, setQ] = useState(value.q);
  const short = q.trim().length > 0 && q.trim().length < SEARCH_MIN;

  // The URL (a coin chip, back and forward) wins over what was typed.
  const [seen, setSeen] = useState(value);
  if (seen.coin !== value.coin || seen.q !== value.q) {
    setSeen(value);
    if (coin.trim().toUpperCase() !== value.coin) setCoin(value.coin);
    if (q.trim() !== value.q) setQ(value.q);
  }

  useEffect(() => {
    const text = q.trim();
    if (text === value.q || (text.length > 0 && text.length < SEARCH_MIN))
      return;
    const timer = setTimeout(
      () => onChange({ ...value, q: text }),
      DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [q, value, onChange]);

  const applyCoin = () => {
    const symbol = coin.trim().replace(/^\$/, '').toUpperCase();
    if (symbol !== value.coin) onChange({ ...value, coin: symbol });
  };
  const active = value.coin !== '' || value.market !== '' || value.q !== '';

  return (
    <div
      role="search"
      aria-label={c.filtersLabel}
      className="mb-4 grid gap-2 sm:grid-cols-[1fr_120px_140px_auto]"
    >
      <div className="relative">
        <Search
          size={13}
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-x"
        />
        <input
          type="search"
          aria-label={c.searchLabel}
          placeholder={c.searchPlaceholder}
          value={q}
          maxLength={SEARCH_MAX}
          onChange={(e) => setQ(e.target.value)}
          aria-describedby={short ? 'feed-search-hint' : undefined}
          className={classNames(compact, 'pl-8')}
        />
        {short && (
          <span
            id="feed-search-hint"
            className="mt-1 block text-[11px] text-muted-dim"
          >
            {c.searchTooShort}
          </span>
        )}
      </div>
      <input
        aria-label={c.coinFilter}
        placeholder={c.coinPlaceholder}
        value={coin}
        onChange={(e) => setCoin(e.target.value)}
        onBlur={applyCoin}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            applyCoin();
          }
        }}
        className={classNames(compact, 'uppercase placeholder:normal-case')}
      />
      <select
        aria-label={c.marketFilter}
        value={value.market}
        onChange={(e) =>
          onChange({ ...value, market: e.target.value as MarketType | '' })
        }
        className={compact}
      >
        <option value="">{c.marketAny}</option>
        <option value="spot">{c.marketSpot}</option>
        <option value="futures">{c.marketFutures}</option>
      </select>
      {active && (
        <Button
          variant="ghost"
          size="md"
          onClick={() => onChange({ coin: '', market: '', q: '' })}
        >
          <X size={13} aria-hidden="true" />
          {c.clearFilters}
        </Button>
      )}
    </div>
  );
}
