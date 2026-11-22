import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert } from '../../../components/feedback/States';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { DecimalInput } from '../../../components/ui/DecimalInput';
import { Input } from '../../../components/ui/Input';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Select } from '../../../components/ui/Select';
import { useCopy } from '../../../hooks/use-copy';
import { useToast } from '../../../hooks/use-toast';
import { formatCopy } from '../../../i18n/copy';
import { errorText, fieldErrorText, messageText } from '../../../i18n/messages';
import { problemOf } from '../../../services/api/errors';
import type {
  JournalEntry,
  MarketType,
  PlanDirection,
} from '../../../types/domain';
import { useSaveManualTrade, useStrategies } from '../hooks/use-journal-entry';
import { usePairOptions } from '../hooks/use-pair-options';
import {
  checkDraft,
  draftOf,
  serverError,
  type ManualDraft,
  type ManualError,
  type ManualField,
} from '../model/manual-trade';
import { ReviewTextField } from './ReviewCard';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="m-0 grid min-w-0 grid-cols-1 gap-4 border-0 p-0 sm:grid-cols-2">
      <legend className="mb-3 p-0 text-xs font-semibold text-muted-x">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

/**
 * SCR-22 (UC-24): records a trade made outside CryptoPilot, or replaces a
 * manual one. Design without Figma (`docs/plan/ui-spec-missing-screens`
 * entry kept locally). The P/L is the server's (BR-35); the form checks
 * what the backend checks and shows the server's field errors in place.
 */
export function ManualTradeForm({ entry }: { entry?: JournalEntry }) {
  const copy = useCopy();
  const j = copy.journal;
  const p = copy.plan;
  const navigate = useNavigate();
  const { show } = useToast();
  const [draft, setDraft] = useState<ManualDraft>(() => draftOf(entry));
  const [errors, setErrors] = useState<
    Partial<Record<ManualField, ManualError>>
  >({});
  const pairs = usePairOptions(draft.market);
  const strategies = useStrategies();
  const save = useSaveManualTrade(entry?.trade.id ?? null);
  const futures = draft.market === 'futures';

  const change = (next: Partial<ManualDraft>) => {
    setDraft((current) => ({ ...current, ...next }));
    setErrors((current) => {
      const left = { ...current };
      for (const key of Object.keys(next)) delete left[key as ManualField];
      return left;
    });
  };

  const label: Record<ManualField, string> = {
    market: j.columnMarket,
    pairId: j.columnPair,
    direction: j.columnDirection,
    leverage: j.leverage,
    entryPrice: j.manualEntryPrice,
    quantity: j.quantity,
    entryTime: j.columnEntryTime,
    stopLoss: j.stopLoss,
    takeProfit: j.takeProfit,
    exitPrice: j.manualExitPrice,
    exitTime: j.exitTime,
    feeAmount: j.fees,
    fundingFeeAmount: j.funding,
    strategyId: j.strategy,
    setupDescription: j.setupDescription,
    lessonsLearned: j.lessonsLearned,
    mistakes: j.mistakes,
  };
  const errorOf = (field: ManualField) => {
    const reason = errors[field];
    if (!reason) return undefined;
    const name = label[field];
    switch (reason) {
      case 'required':
        return fieldErrorText(copy, 'MSG01', name);
      case 'positive':
        return formatCopy(p.errPositive, { field: name });
      case 'signed':
        return formatCopy(p.errNumber, { field: name });
      case 'leverage':
        return formatCopy(p.errLeverage, { field: name });
      case 'future':
        return j.errEntryFuture;
      case 'exitOrder':
        return j.errExitOrder;
      case 'side':
        return messageText(copy, 'MSG16', [], {
          direction: p[`directionName${draft.direction}`],
          rule: p[`rule${draft.direction}`],
        });
      case 'spotShort':
        return messageText(copy, 'MSG16', [], {
          direction: p.directionNameSHORT,
          rule: j.ruleSpotLong,
        });
      case 'unknown':
        return j.errUnknown;
      case 'range':
        return formatCopy(j.errRange, { field: name });
    }
  };

  const submit = () => {
    const checked = checkDraft(draft);
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    save.mutate(checked.input, {
      onSuccess: (saved) => {
        show({ tone: 'success', message: messageText(copy, 'MSG14') });
        navigate(`/journal/${saved.trade.id}`);
      },
      onError: (error) => {
        const fields = problemOf(error)?.fieldErrors ?? {};
        const mapped: Partial<Record<ManualField, ManualError>> = {};
        for (const [field, id] of Object.entries(fields))
          if (field in label)
            mapped[field as ManualField] = serverError(field, id);
        setErrors(mapped);
      },
    });
  };
  const fieldNamed = Object.keys(
    problemOf(save.error)?.fieldErrors ?? {},
  ).length;

  const decimalField = (
    field:
      | 'entryPrice'
      | 'quantity'
      | 'stopLoss'
      | 'takeProfit'
      | 'exitPrice'
      | 'feeAmount',
    hint?: string,
  ) => (
    <DecimalInput
      label={label[field]}
      value={draft[field]}
      onValueChange={(value) => change({ [field]: value })}
      error={errorOf(field)}
      {...(hint ? { hint } : {})}
    />
  );

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {save.isError && !fieldNamed && (
        <Alert tone="danger" title={errorText(copy, save.error)} />
      )}
      <Card className="flex flex-col gap-6">
        <Section title={j.sectionInstrument}>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-fg-2">
              {j.columnMarket}
            </span>
            <SegmentedControl<MarketType>
              label={j.columnMarket}
              options={[
                { value: 'spot', label: copy.market.spot },
                { value: 'futures', label: copy.market.futures },
              ]}
              value={draft.market}
              onChange={(market) =>
                change({
                  market,
                  pairId: '',
                  ...(market === 'spot'
                    ? { direction: 'LONG', leverage: '', fundingFeeAmount: '' }
                    : {}),
                })
              }
            />
          </div>
          <Select
            label={j.columnPair}
            value={draft.pairId}
            onChange={(event) => change({ pairId: event.target.value })}
            error={errorOf('pairId')}
          >
            <option value="">{j.pairChoose}</option>
            {pairs.map((pair) => (
              <option key={pair.pairId} value={pair.pairId}>
                {pair.label}
              </option>
            ))}
          </Select>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-fg-2">
              {j.columnDirection}
            </span>
            <SegmentedControl<PlanDirection>
              label={j.columnDirection}
              options={[
                { value: 'LONG', label: p.directionLONG, tone: 'positive' },
                ...(futures
                  ? [
                      {
                        value: 'SHORT' as const,
                        label: p.directionSHORT,
                        tone: 'negative' as const,
                      },
                    ]
                  : []),
              ]}
              value={draft.direction}
              onChange={(direction) => change({ direction })}
            />
            {errorOf('direction') && (
              <span role="alert" className="text-xs text-negative">
                {errorOf('direction')}
              </span>
            )}
          </div>
          {futures && (
            <Input
              label={j.leverage}
              inputMode="numeric"
              value={draft.leverage}
              onChange={(event) => change({ leverage: event.target.value })}
              error={errorOf('leverage')}
              hint={j.leverageHint}
            />
          )}
        </Section>
        <Section title={j.sectionEntry}>
          {decimalField('entryPrice')}
          {decimalField('quantity')}
          <Input
            label={j.columnEntryTime}
            type="datetime-local"
            value={draft.entryTime}
            onChange={(event) => change({ entryTime: event.target.value })}
            error={errorOf('entryTime')}
          />
        </Section>
        <Section title={j.sectionExit}>
          {decimalField('stopLoss')}
          {decimalField('takeProfit')}
          {decimalField('exitPrice', j.exitHint)}
          <Input
            label={j.exitTime}
            type="datetime-local"
            value={draft.exitTime}
            onChange={(event) => change({ exitTime: event.target.value })}
            error={errorOf('exitTime')}
          />
        </Section>
        <Section title={j.sectionCosts}>
          {decimalField('feeAmount', j.feeHint)}
          {futures && (
            <Input
              label={j.funding}
              inputMode="decimal"
              value={draft.fundingFeeAmount}
              onChange={(event) =>
                change({ fundingFeeAmount: event.target.value })
              }
              error={errorOf('fundingFeeAmount')}
              hint={j.fundingHint}
            />
          )}
        </Section>
        <fieldset className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
          <legend className="mb-3 p-0 text-xs font-semibold text-muted-x">
            {j.reviewTitle}
          </legend>
          <Select
            label={j.strategy}
            value={draft.strategyId}
            onChange={(event) => change({ strategyId: event.target.value })}
            error={errorOf('strategyId')}
          >
            <option value="">{j.strategyNone}</option>
            {(strategies.data ?? []).map((strategy) => (
              <option key={strategy.id} value={strategy.id}>
                {strategy.name}
              </option>
            ))}
          </Select>
          <ReviewTextField
            label={j.setupDescription}
            value={draft.setupDescription}
            onChange={(value) => change({ setupDescription: value })}
            error={errorOf('setupDescription')}
          />
          <ReviewTextField
            label={j.lessonsLearned}
            value={draft.lessonsLearned}
            onChange={(value) => change({ lessonsLearned: value })}
            error={errorOf('lessonsLearned')}
          />
          <ReviewTextField
            label={j.mistakes}
            value={draft.mistakes}
            onChange={(value) => change({ mistakes: value })}
            error={errorOf('mistakes')}
          />
        </fieldset>
      </Card>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() =>
            navigate(entry ? `/journal/${entry.trade.id}` : '/journal')
          }
          disabled={save.isPending}
        >
          {j.reviewCancel}
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending
            ? j.reviewSaving
            : entry
              ? j.manualSave
              : j.manualRecord}
        </Button>
      </div>
    </form>
  );
}
