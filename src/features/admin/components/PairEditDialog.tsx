import { useId, useState, type FormEvent } from 'react';
import { Alert as Banner } from '../../../components/feedback/States';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Switch } from '../../../components/ui/Switch';
import { useCopy } from '../../../hooks/use-copy';
import { useToast } from '../../../hooks/use-toast';
import { formatCopy } from '../../../i18n/copy';
import type { Copy } from '../../../i18n/locales/en';
import { errorText, fieldErrorText, messageText } from '../../../i18n/messages';
import { problemOf } from '../../../services/api/errors';
import type {
  AdminPair,
  PairSettings,
  PairStatus,
} from '../../../types/domain';
import { pairLabel } from '../../../utils/pair-label';
import { useUpdatePair } from '../hooks/use-admin-pairs';

type Field = 'maxLeverage' | 'displayOrder';
const WHOLE = /^\d+$/;

/** The settings typed, or why a field is refused before sending. */
function settingsOf(
  draft: Draft,
): { ok: true; settings: PairSettings } | { ok: false; errors: Errors } {
  const errors: Errors = {};
  const leverage = draft.maxLeverage.trim();
  let maxLeverage: number | null = null;
  if (draft.futuresEnabled) {
    if (leverage === '') errors.maxLeverage = 'required';
    else if (!WHOLE.test(leverage) || +leverage < 1 || +leverage > 125)
      errors.maxLeverage = 'range';
    else maxLeverage = +leverage;
  } else if (WHOLE.test(leverage) && +leverage >= 1 && +leverage <= 125)
    maxLeverage = +leverage;
  const order = draft.displayOrder.trim();
  if (order === '') errors.displayOrder = 'required';
  else if (!WHOLE.test(order) || +order < 1) errors.displayOrder = 'range';
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    settings: {
      status: draft.status,
      spotEnabled: draft.spotEnabled,
      futuresEnabled: draft.futuresEnabled,
      maxLeverage,
      displayOrder: +order,
    },
  };
}

interface Draft {
  status: PairStatus;
  spotEnabled: boolean;
  futuresEnabled: boolean;
  maxLeverage: string;
  displayOrder: string;
}
type Errors = Partial<Record<Field, 'required' | 'range' | 'bracket'>>;

function fieldText(
  copy: Copy,
  field: Field,
  error: 'required' | 'range' | 'bracket',
  label: string,
) {
  const t = copy.adminPairs;
  if (error === 'required') return fieldErrorText(copy, 'MSG01', label);
  if (field === 'displayOrder') return formatCopy(t.errOrder, { field: label });
  return formatCopy(
    error === 'bracket' ? t.errLeverageBracket : t.errLeverage,
    {
      field: label,
    },
  );
}

/**
 * SCR-37 Edit (UC-45): the pair's status, each market's switch, the
 * Futures leverage ceiling (BR-26) and the display order, sent whole. A
 * market the exchange never listed cannot be turned on; turning one off
 * with open positions answers MSG40 (BR-59).
 */
export function PairEditDialog({
  pair,
  onClose,
}: {
  /** null = closed. */
  pair: AdminPair | null;
  onClose: () => void;
}) {
  const copy = useCopy();
  const t = copy.adminPairs;
  const formId = useId();
  const update = useUpdatePair();
  return (
    <Dialog
      open={pair !== null}
      onOpenChange={(open) => !open && onClose()}
      title={
        pair ? formatCopy(t.editTitle, { pair: pairLabel(pair.symbol) }) : ''
      }
      description={t.editDescription}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {copy.common.cancel}
          </Button>
          <Button type="submit" form={formId} disabled={update.pending}>
            {t.save}
          </Button>
        </>
      }
    >
      {pair && (
        <PairForm
          key={pair.pairId + pair.updatedAt}
          id={formId}
          pair={pair}
          update={update}
          onSaved={onClose}
        />
      )}
    </Dialog>
  );
}

function PairForm({
  id,
  pair,
  update,
  onSaved,
}: {
  id: string;
  pair: AdminPair;
  update: ReturnType<typeof useUpdatePair>;
  onSaved: () => void;
}) {
  const copy = useCopy();
  const t = copy.adminPairs;
  const { show } = useToast();
  const [draft, setDraft] = useState<Draft>(() => ({
    status: pair.status,
    spotEnabled: pair.spotEnabled,
    futuresEnabled: pair.futuresEnabled,
    maxLeverage: pair.maxLeverage === null ? '' : String(pair.maxLeverage),
    displayOrder: String(pair.displayOrder),
  }));
  const [shown, setShown] = useState<Errors>({});
  const change = (patch: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setShown({});
    update.reset();
  };
  const problem = problemOf(
    update.state.status === 'error' ? update.state.error : null,
  );
  const server: Errors = {};
  if (problem?.fieldErrors.maxLeverage)
    server.maxLeverage =
      problem.fieldErrors.maxLeverage === 'MSG01' ? 'required' : 'bracket';
  if (problem?.fieldErrors.displayOrder) server.displayOrder = 'range';
  const errors = { ...server, ...shown };
  const label = pairLabel(pair.symbol);
  const banner =
    problem && Object.keys(problem.fieldErrors).length === 0
      ? problem.code === 'PAIR_HAS_OPEN_POSITIONS'
        ? messageText(copy, 'MSG40', [], { pair: label })
        : problem.code === 'PAIR_NOT_TRADING'
          ? t.notTrading
          : errorText(
              copy,
              update.state.status === 'error' ? update.state.error : null,
            )
      : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const checked = settingsOf(draft);
    if (!checked.ok) {
      setShown(checked.errors);
      return;
    }
    const result = await update.run(pair.pairId, checked.settings);
    if (result.status !== 'success') return;
    show({ tone: 'success', message: formatCopy(t.saved, { pair: label }) });
    onSaved();
  }

  const error = (field: Field, fieldLabel: string) => {
    const kind = errors[field];
    return kind ? fieldText(copy, field, kind, fieldLabel) : undefined;
  };
  return (
    <form
      id={id}
      onSubmit={(event) => void submit(event)}
      noValidate
      className="grid gap-4"
    >
      {banner && <Banner tone="danger" title={banner} />}
      <Select
        label={t.statusField}
        value={draft.status}
        onChange={(event) =>
          change({ status: event.target.value as PairStatus })
        }
      >
        <option value="ACTIVE">{t.statusACTIVE}</option>
        <option value="INACTIVE">{t.statusINACTIVE}</option>
      </Select>
      <div>
        <Switch
          label={t.spotField}
          checked={draft.spotEnabled}
          disabled={!pair.spot.exchangeStatus && !draft.spotEnabled}
          {...(pair.spot.exchangeStatus ? {} : { description: t.notListedOn })}
          onChange={(event) => change({ spotEnabled: event.target.checked })}
        />
        <Switch
          label={t.futuresField}
          checked={draft.futuresEnabled}
          disabled={!pair.futures.exchangeStatus && !draft.futuresEnabled}
          {...(pair.futures.exchangeStatus
            ? {}
            : { description: t.notListedOn })}
          onChange={(event) => change({ futuresEnabled: event.target.checked })}
        />
      </div>
      {draft.futuresEnabled && (
        <Input
          label={t.maxLeverageField}
          inputMode="numeric"
          autoComplete="off"
          value={draft.maxLeverage}
          onChange={(event) => change({ maxLeverage: event.target.value })}
          error={error('maxLeverage', t.maxLeverageField)}
          hint={t.maxLeverageHint}
        />
      )}
      <Input
        label={t.orderField}
        inputMode="numeric"
        autoComplete="off"
        value={draft.displayOrder}
        onChange={(event) => change({ displayOrder: event.target.value })}
        error={error('displayOrder', t.orderField)}
        hint={t.orderHint}
      />
    </form>
  );
}
