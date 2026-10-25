import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { fieldControlClass } from '../../../components/ui/field-styles';
import { useCopy } from '../../../hooks/use-copy';
import type { NewsRange, NewsSentiment } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import { SENTIMENTS, sentimentLabel } from './news-format';

export interface NewsFilterValue {
  coin: string;
  sentiment: NewsSentiment | '';
  range: NewsRange;
}

export const DEFAULT_RANGE: NewsRange = '7d';
const compact = classNames(fieldControlClass, 'h-9 py-0 text-xs');

/**
 * SRS 3.8.1 filters: coin, sentiment and period (24 hours, 7 days, 30
 * days, 7 days by default). The coin applies on Enter or when the field is
 * left, so each keystroke is not a request.
 */
export function NewsFilters({
  value,
  onChange,
}: {
  value: NewsFilterValue;
  onChange: (value: NewsFilterValue) => void;
}) {
  const copy = useCopy();
  const n = copy.news;
  const [coin, setCoin] = useState(value.coin);

  // The URL (a coin tag, back and forward) wins over what was typed.
  const [seen, setSeen] = useState(value.coin);
  if (seen !== value.coin) {
    setSeen(value.coin);
    setCoin(value.coin);
  }

  const applyCoin = () => {
    const symbol = coin.trim().replace(/^\$/, '').toUpperCase();
    if (symbol !== value.coin) onChange({ ...value, coin: symbol });
  };
  const active =
    value.coin !== '' ||
    value.sentiment !== '' ||
    value.range !== DEFAULT_RANGE;

  return (
    <div
      role="search"
      aria-label={n.filtersLabel}
      className="mb-4 flex flex-wrap items-center gap-2"
    >
      <input
        aria-label={n.coinFilter}
        placeholder={n.coinPlaceholder}
        value={coin}
        onChange={(e) => setCoin(e.target.value)}
        onBlur={applyCoin}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            applyCoin();
          }
        }}
        className={classNames(
          compact,
          'w-36 uppercase placeholder:normal-case',
        )}
      />
      <select
        aria-label={n.sentimentFilter}
        value={value.sentiment}
        onChange={(e) =>
          onChange({
            ...value,
            sentiment: e.target.value as NewsSentiment | '',
          })
        }
        className={classNames(compact, 'w-40')}
      >
        <option value="">{n.sentimentAny}</option>
        {SENTIMENTS.map((s) => (
          <option key={s} value={s}>
            {sentimentLabel(copy, s)}
          </option>
        ))}
      </select>
      <SegmentedControl<NewsRange>
        label={n.rangeLabel}
        value={value.range}
        onChange={(range) => onChange({ ...value, range })}
        options={[
          { value: '24h', label: n.range24h },
          { value: '7d', label: n.range7d },
          { value: '30d', label: n.range30d },
        ]}
      />
      {active && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            onChange({ coin: '', sentiment: '', range: DEFAULT_RANGE })
          }
        >
          <X size={13} aria-hidden="true" />
          {n.clearFilters}
        </Button>
      )}
    </div>
  );
}
