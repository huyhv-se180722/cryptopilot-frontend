import { useEffect, useId, useRef, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { buttonClassName } from '../../../components/ui/button-styles';
import { Checkbox } from '../../../components/ui/Checkbox';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { useCopy } from '../../../hooks/use-copy';
import {
  ORDER_GATEWAYS,
  ORDER_STATUSES,
  ORDER_TYPES,
} from '../../../services/api/admin-orders';
import type {
  OrderStatus,
  OrderType,
  PaymentGatewayCode,
} from '../../../types/domain';
import {
  NO_FILTER,
  filterCount,
  rangeInvalid,
  type OrderFilter,
} from './order-format';

/**
 * One "Filters" button for SCR-40: the choices are made in a panel and
 * applied together, and the filters in use stay visible as chips, each
 * removable on its own.
 */
export function OrderFilters({
  value,
  onChange,
}: {
  value: OrderFilter;
  onChange: (next: OrderFilter) => void;
}) {
  const copy = useCopy();
  const t = copy.adminPayments;
  const b = copy.billing;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const count = filterCount(value);
  const badRange = rangeInvalid(draft.from, draft.to);

  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const set = <K extends keyof OrderFilter>(key: K, next: OrderFilter[K]) =>
    setDraft((d) => ({ ...d, [key]: next }));
  const toggle = () => {
    // The panel opens on the filters in use; what was not applied is dropped.
    if (!open) setDraft(value);
    setOpen(!open);
  };
  const apply = () => {
    if (badRange) return;
    onChange(draft);
    setOpen(false);
  };

  const chips: { id: string; label: string; clear: Partial<OrderFilter> }[] =
    [];
  if (value.status)
    chips.push({
      id: 'status',
      label: t.statusFilter + ': ' + b[`status${value.status}`],
      clear: { status: '' },
    });
  if (value.orderType)
    chips.push({
      id: 'type',
      label: t.typeFilter + ': ' + b[`type${value.orderType}`],
      clear: { orderType: '' },
    });
  if (value.gateway)
    chips.push({
      id: 'gateway',
      label: t.gatewayFilter + ': ' + value.gateway,
      clear: { gateway: '' },
    });
  if (value.from || value.to)
    chips.push({
      id: 'days',
      label:
        t.daysFilter + ': ' + (value.from || '…') + ' → ' + (value.to || '…'),
      clear: { from: '', to: '' },
    });
  if (value.manual)
    chips.push({ id: 'manual', label: t.manualOnly, clear: { manual: false } });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div ref={box} className="relative">
        <button
          ref={button}
          type="button"
          className={buttonClassName('secondary', 'md')}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={toggle}
        >
          <SlidersHorizontal size={14} aria-hidden="true" />
          {t.filters}
          {count > 0 && (
            <span className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-white">
              {count}
            </span>
          )}
        </button>
        {open && (
          <div
            id={panelId}
            role="group"
            aria-label={t.filters}
            className="absolute top-full left-0 z-30 mt-2 w-[min(22rem,calc(100vw-32px))] rounded-xl border border-line-strong bg-surface p-4 shadow-overlay"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label={t.statusFilter}
                value={draft.status}
                onChange={(event) =>
                  set('status', event.target.value as OrderStatus | '')
                }
              >
                <option value="">{t.any}</option>
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {b[`status${s}`]}
                  </option>
                ))}
              </Select>
              <Select
                label={t.typeFilter}
                value={draft.orderType}
                onChange={(event) =>
                  set('orderType', event.target.value as OrderType | '')
                }
              >
                <option value="">{t.any}</option>
                {ORDER_TYPES.map((s) => (
                  <option key={s} value={s}>
                    {b[`type${s}`]}
                  </option>
                ))}
              </Select>
              <div className="sm:col-span-2">
                <Select
                  label={t.gatewayFilter}
                  value={draft.gateway}
                  onChange={(event) =>
                    set(
                      'gateway',
                      event.target.value as PaymentGatewayCode | '',
                    )
                  }
                >
                  <option value="">{t.any}</option>
                  {ORDER_GATEWAYS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </div>
              <Input
                label={t.fromLabel}
                type="date"
                value={draft.from}
                max={draft.to || undefined}
                onChange={(event) => set('from', event.target.value)}
              />
              <Input
                label={t.toLabel}
                type="date"
                value={draft.to}
                min={draft.from || undefined}
                onChange={(event) => set('to', event.target.value)}
              />
              {badRange && (
                <p role="alert" className="text-xs text-negative sm:col-span-2">
                  {t.rangeInvalid}
                </p>
              )}
              <Checkbox
                className="sm:col-span-2"
                label={t.manualOnly}
                checked={draft.manual}
                onChange={(event) => set('manual', event.target.checked)}
              />
            </div>
            <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDraft(NO_FILTER)}
              >
                {t.clear}
              </Button>
              <Button size="sm" disabled={badRange} onClick={apply}>
                {t.apply}
              </Button>
            </div>
          </div>
        )}
      </div>
      {chips.map((chip) => (
        <span
          key={chip.id}
          className="inline-flex items-center gap-1 rounded-full border border-line bg-raised py-1 pr-1 pl-2.5 text-xs text-fg-2"
        >
          {chip.label}
          <button
            type="button"
            aria-label={t.removeFilter + ' ' + chip.label}
            onClick={() => onChange({ ...value, ...chip.clear })}
            className="inline-flex size-4 items-center justify-center rounded-full text-muted-dim hover:bg-line hover:text-fg"
          >
            <X size={10} aria-hidden="true" />
          </button>
        </span>
      ))}
      {chips.length > 1 && (
        <Button variant="ghost" size="sm" onClick={() => onChange(NO_FILTER)}>
          {t.clear}
        </Button>
      )}
    </div>
  );
}
