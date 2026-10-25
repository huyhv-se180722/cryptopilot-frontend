import { useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Alert as Banner } from '../../../components/feedback/States';
import { Button } from '../../../components/ui/Button';
import { NumericText } from '../../../components/ui/NumericText';
import { useCopy } from '../../../hooks/use-copy';
import { useToast } from '../../../hooks/use-toast';
import { formatCopy } from '../../../i18n/copy';
import type { Copy } from '../../../i18n/locales/en';
import { errorText } from '../../../i18n/messages';
import { problemOf } from '../../../services/api/errors';
import type { AdminPair, PairBrackets } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import { groupThousands, toFixedDecimal } from '../../../utils/decimal-format';
import { pairLabel } from '../../../utils/pair-label';
import { useReplaceBrackets } from '../hooks/use-admin-pairs';
import {
  BRACKETS_MAX,
  bracketInputs,
  errorKey,
  floorsOf,
  rowsOf,
  type BracketError,
  type BracketErrors,
  type BracketField,
  type BracketRow,
} from './bracket-form';

const cellInput =
  'h-8 w-full min-w-24 rounded-md border bg-surface px-2 text-right text-xs text-fg tabular-nums outline-none focus-visible:border-primary';

function errorWords(
  copy: Copy,
  field: BracketField,
  error: BracketError,
  index: number,
): string {
  const b = copy.adminBrackets;
  if (error === 'required') return b.errRequired;
  if (error === 'server') {
    if (field === 'notionalFloor') return b.errFloor;
    if (field === 'maxLeverage')
      return index === 0 ? b.errFirstLeverage : b.errLeverage;
  }
  if (field === 'notionalCap') return b.errCap;
  if (field === 'maxLeverage') return b.errLeverage;
  return b.errRate;
}

/**
 * SCR-38 (UC-46): a Futures pair's brackets as one editable table. Each
 * bracket starts at the cap before it; the cap, leverage and maintenance
 * margin rate are typed, the maintenance amount comes from the server
 * (BR-27). Saving replaces them all; a refused cell is named under it.
 */
export function BracketEditor({
  pair,
  saved,
}: {
  pair: AdminPair;
  saved: PairBrackets;
}) {
  const copy = useCopy();
  const b = copy.adminBrackets;
  const { show } = useToast();
  const replace = useReplaceBrackets();
  const [rows, setRows] = useState<BracketRow[]>(() => rowsOf(saved.brackets));
  const [dirty, setDirty] = useState(false);
  const [shown, setShown] = useState<BracketErrors>({});
  const label = pairLabel(pair.symbol);
  const floors = floorsOf(rows);

  const edit = (next: BracketRow[]) => {
    setRows(next);
    setDirty(true);
    setShown({});
    replace.reset();
  };
  const change = (index: number, patch: Partial<BracketRow>) =>
    edit(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const problem = problemOf(
    replace.state.status === 'error' ? replace.state.error : null,
  );
  const server: BracketErrors = {};
  for (const key of Object.keys(problem?.fieldErrors ?? {}))
    server[key] = 'server';
  const errors = { ...server, ...shown };
  const banner =
    problem && Object.keys(problem.fieldErrors).length === 0
      ? problem.code === 'PAIR_NOT_TRADING'
        ? b.notTrading
        : errorText(
            copy,
            replace.state.status === 'error' ? replace.state.error : null,
          )
      : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const checked = bracketInputs(rows);
    if (!checked.ok) {
      setShown(checked.errors);
      return;
    }
    const result = await replace.run(pair.pairId, checked.inputs);
    if (result.status !== 'success') return;
    setRows(rowsOf(result.data.brackets));
    setDirty(false);
    show({ tone: 'success', message: formatCopy(b.saved, { pair: label }) });
  }

  const cell = (
    index: number,
    field: BracketField,
    value: string,
    onChange: (value: string) => void,
    aria: string,
    inputMode: 'decimal' | 'numeric',
  ) => {
    const error = errors[errorKey(index, field)];
    const id = `bracket-${index}-${field}`;
    return (
      <>
        <input
          id={id}
          aria-label={aria}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? id + '-error' : undefined}
          inputMode={inputMode}
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={classNames(
            cellInput,
            error ? 'border-negative' : 'border-line',
          )}
        />
        {error && (
          <span
            id={id + '-error'}
            className="mt-1 block text-right text-[10px] text-negative"
          >
            {errorWords(copy, field, error, index)}
          </span>
        )}
      </>
    );
  };

  const head =
    'px-3 py-2 text-[10px] font-medium tracking-[0.07em] whitespace-nowrap text-muted-x uppercase';
  return (
    <form
      onSubmit={(event) => void submit(event)}
      noValidate
      className="grid gap-3"
    >
      <p className="text-xs text-muted-dim">
        {pair.maxLeverage === null
          ? b.noCeiling
          : formatCopy(b.ceiling, { value: pair.maxLeverage })}
      </p>
      {banner && <Banner tone="danger" title={banner} />}
      {rows.length === 0 && <Banner tone="warning" title={b.empty} />}
      {rows.length > 0 && (
        <div
          className="relative overflow-x-auto rounded-xl border border-line"
          role="region"
          aria-label={formatCopy(b.tableCaption, { pair: label })}
          tabIndex={0}
        >
          <table className="w-full border-collapse">
            <caption className="sr-only">
              {formatCopy(b.tableCaption, { pair: label })}
            </caption>
            <thead>
              <tr className="border-b border-line bg-page-alt">
                <th scope="col" className={classNames(head, 'text-left')}>
                  {b.colNo}
                </th>
                <th scope="col" className={classNames(head, 'text-right')}>
                  {b.colFrom}
                </th>
                <th scope="col" className={classNames(head, 'text-right')}>
                  {b.colTo}
                </th>
                <th scope="col" className={classNames(head, 'text-right')}>
                  {b.colLeverage}
                </th>
                <th scope="col" className={classNames(head, 'text-right')}>
                  {b.colRate}
                </th>
                <th scope="col" className={classNames(head, 'text-right')}>
                  {b.colAmount}
                </th>
                <th scope="col" className={classNames(head, 'text-right')}>
                  <span className="sr-only">{b.colRemove}</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-surface">
              {rows.map((row, index) => {
                const n = index + 1;
                const floor = floors[index] ?? null;
                const amount = dirty
                  ? null
                  : saved.brackets[index]?.maintenanceAmount;
                const floorError = errors[errorKey(index, 'notionalFloor')];
                return (
                  <tr
                    key={index}
                    className="border-b border-line align-top last:border-b-0"
                  >
                    <td className="px-3 py-2 text-xs text-muted-dim">{n}</td>
                    <td className="px-3 py-2 text-right text-xs text-fg-2">
                      {floor === null ? (
                        copy.market.noValue
                      ) : (
                        <NumericText value={groupThousands(floor)} />
                      )}
                      {floorError && (
                        <span className="mt-1 block text-[10px] text-negative">
                          {errorWords(copy, 'notionalFloor', floorError, index)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {cell(
                        index,
                        'notionalCap',
                        row.cap,
                        (cap) => change(index, { cap }),
                        formatCopy(b.toLabel, { n }),
                        'decimal',
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {cell(
                        index,
                        'maxLeverage',
                        row.leverage,
                        (leverage) => change(index, { leverage }),
                        formatCopy(b.leverageLabel, { n }),
                        'numeric',
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {cell(
                        index,
                        'maintenanceMarginRate',
                        row.ratePercent,
                        (ratePercent) => change(index, { ratePercent }),
                        formatCopy(b.rateLabel, { n }),
                        'decimal',
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-fg-2">
                      {amount ? (
                        <NumericText
                          value={groupThousands(toFixedDecimal(amount, 2))}
                        />
                      ) : (
                        <span className="text-[11px] text-muted-x">
                          {b.amountPending}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        aria-label={formatCopy(b.removeLabel, { n })}
                        title={formatCopy(b.removeLabel, { n })}
                        onClick={() => edit(rows.filter((_, i) => i !== index))}
                        className="inline-flex size-8 items-center justify-center rounded-lg text-muted-dim hover:bg-raised-hover hover:text-negative"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-muted-dim">{b.rules}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={rows.length >= BRACKETS_MAX}
          onClick={() =>
            edit([
              ...rows,
              {
                cap: '',
                leverage: rows.at(-1)?.leverage ?? '',
                ratePercent: '',
              },
            ])
          }
        >
          <Plus size={13} aria-hidden="true" />
          {b.addBracket}
        </Button>
        <span className="flex-1" />
        {dirty && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setRows(rowsOf(saved.brackets));
              setDirty(false);
              setShown({});
              replace.reset();
            }}
          >
            {b.discard}
          </Button>
        )}
        <Button
          type="submit"
          size="sm"
          disabled={replace.pending || !dirty || rows.length === 0}
        >
          {b.save}
        </Button>
      </div>
    </form>
  );
}
