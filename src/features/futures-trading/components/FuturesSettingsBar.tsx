import { useState } from 'react';
import { FormNotice } from '../../../components/feedback/FormNotice';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { NumericText } from '../../../components/ui/NumericText';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { useCopy } from '../../../hooks/use-copy';
import { useToast } from '../../../hooks/use-toast';
import { formatCopy } from '../../../i18n/copy';
import type {
  FuturesLeverageBracket,
  FuturesSymbolConfig,
  MarginType,
} from '../../../types/futures';
import { groupThousands } from '../../../utils/decimal-format';
import { useFuturesActions } from '../hooks/use-futures';
import { futuresErrorText } from '../model/futures-errors';
import { maxNotionalAtLeverage, toBrackets } from '../model/futures-form';

/** The leverage above which the dialog warns (plan 12.3, the risk profiles' ceiling). */
const HIGH_LEVERAGE = 10;
const QUICK = [1, 5, 10, 20, 50, 75, 100, 125];

const chip =
  'inline-flex h-7 items-center rounded-md border border-line bg-raised px-2.5 text-xs font-medium text-fg-2 hover:bg-raised-hover disabled:opacity-50';

/**
 * The pair's margin mode, leverage and the account's position mode, as
 * three chips above the order form (plan 12.2), each opening its dialog.
 * The server refuses a change it cannot make (an open order or position,
 * -4046 … -4068); the dialog then says why.
 */
export function FuturesSettingsBar({
  symbol,
  config,
  brackets,
  dualSide,
}: {
  symbol: string;
  config: FuturesSymbolConfig | undefined;
  brackets: readonly FuturesLeverageBracket[] | undefined;
  dualSide: boolean | undefined;
}) {
  const f = useCopy().futures;
  const [open, setOpen] = useState<'margin' | 'leverage' | 'mode' | null>(null);
  const close = () => setOpen(null);
  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      <button
        type="button"
        className={chip}
        disabled={!config}
        onClick={() => setOpen('margin')}
      >
        {config
          ? config.marginType === 'CROSSED'
            ? f.cross
            : f.isolated
          : '…'}
      </button>
      <button
        type="button"
        className={chip}
        disabled={!config || !brackets}
        onClick={() => setOpen('leverage')}
      >
        {config ? formatCopy(f.leverageShort, { n: config.leverage }) : '…'}
      </button>
      <button
        type="button"
        className={chip}
        disabled={dualSide === undefined}
        onClick={() => setOpen('mode')}
      >
        {dualSide === undefined ? '…' : dualSide ? f.hedge : f.oneWay}
      </button>
      {config && open === 'margin' && (
        <MarginModeDialog symbol={symbol} config={config} onClose={close} />
      )}
      {config && brackets && open === 'leverage' && (
        <LeverageDialog
          symbol={symbol}
          config={config}
          brackets={brackets}
          onClose={close}
        />
      )}
      {dualSide !== undefined && open === 'mode' && (
        <PositionModeDialog dualSide={dualSide} onClose={close} />
      )}
    </div>
  );
}

function MarginModeDialog({
  symbol,
  config,
  onClose,
}: {
  symbol: string;
  config: FuturesSymbolConfig;
  onClose: () => void;
}) {
  const copy = useCopy();
  const f = copy.futures;
  const toast = useToast();
  const { marginType } = useFuturesActions();
  const [chosen, setChosen] = useState<MarginType>(config.marginType);
  const [notice, setNotice] = useState<string | null>(null);
  const confirm = async () => {
    if (chosen === config.marginType) return onClose();
    const result = await marginType.run(symbol, chosen);
    if (result.status === 'error')
      return setNotice(futuresErrorText(copy, result.error));
    toast.show({ tone: 'success', message: f.saved });
    onClose();
  };
  return (
    <Dialog
      open
      onOpenChange={(next) => !next && onClose()}
      title={formatCopy(f.marginModeTitle, { symbol })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {copy.common.cancel}
          </Button>
          <Button onClick={() => void confirm()} disabled={marginType.pending}>
            {f.confirm}
          </Button>
        </>
      }
    >
      <SegmentedControl
        label={f.marginModeTitle}
        value={chosen}
        onChange={setChosen}
        options={[
          { value: 'CROSSED', label: f.cross },
          { value: 'ISOLATED', label: f.isolated },
        ]}
      />
      <p className="mt-3 text-xs text-muted">
        {chosen === 'CROSSED' ? f.crossHint : f.isolatedHint}
      </p>
      <p className="mt-2 text-[11px] text-muted-dim">{f.marginModeNote}</p>
      {notice && (
        <div className="mt-3">
          <FormNotice tone="error">{notice}</FormNotice>
        </div>
      )}
    </Dialog>
  );
}

function LeverageDialog({
  symbol,
  config,
  brackets,
  onClose,
}: {
  symbol: string;
  config: FuturesSymbolConfig;
  brackets: readonly FuturesLeverageBracket[];
  onClose: () => void;
}) {
  const copy = useCopy();
  const f = copy.futures;
  const toast = useToast();
  const { leverage } = useFuturesActions();
  const highest = brackets[0]?.initialLeverage ?? config.leverage;
  const [value, setValue] = useState(config.leverage);
  const [notice, setNotice] = useState<string | null>(null);
  const maxPosition = maxNotionalAtLeverage(toBrackets(brackets), value);
  const confirm = async () => {
    if (value === config.leverage) return onClose();
    const result = await leverage.run(symbol, value, config.marginType);
    if (result.status === 'error')
      return setNotice(futuresErrorText(copy, result.error));
    toast.show({
      tone: 'success',
      message: formatCopy(f.leverageSaved, { n: value }),
    });
    onClose();
  };
  return (
    <Dialog
      open
      onOpenChange={(next) => !next && onClose()}
      title={f.leverageTitle}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {copy.common.cancel}
          </Button>
          <Button onClick={() => void confirm()} disabled={leverage.pending}>
            {f.confirm}
          </Button>
        </>
      }
    >
      <div className="mb-3 flex items-center justify-center gap-3">
        <Button
          variant="secondary"
          aria-label={f.leverageDown}
          disabled={value <= 1}
          onClick={() => setValue(value - 1)}
        >
          −
        </Button>
        <span className="min-w-16 text-center text-xl font-semibold text-fg">
          {formatCopy(f.leverageShort, { n: value })}
        </span>
        <Button
          variant="secondary"
          aria-label={f.leverageUp}
          disabled={value >= highest}
          onClick={() => setValue(value + 1)}
        >
          +
        </Button>
      </div>
      <input
        type="range"
        min={1}
        max={highest}
        value={value}
        aria-label={f.leverageTitle}
        onChange={(event) => setValue(Number(event.target.value))}
        className="w-full accent-primary"
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {QUICK.filter((n) => n <= highest).map((n) => (
          <button
            key={n}
            type="button"
            className={chip}
            onClick={() => setValue(n)}
          >
            {formatCopy(f.leverageShort, { n })}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        {f.maxPosition}:{' '}
        <NumericText
          value={groupThousands(maxPosition)}
          suffix=" USDT"
          className="text-fg-2"
        />
      </p>
      {value > HIGH_LEVERAGE && (
        <p className="mt-2 text-xs text-warning">{f.highLeverageWarning}</p>
      )}
      {notice && (
        <div className="mt-3">
          <FormNotice tone="error">{notice}</FormNotice>
        </div>
      )}
    </Dialog>
  );
}

function PositionModeDialog({
  dualSide,
  onClose,
}: {
  dualSide: boolean;
  onClose: () => void;
}) {
  const copy = useCopy();
  const f = copy.futures;
  const toast = useToast();
  const { positionMode } = useFuturesActions();
  const [hedge, setHedge] = useState(dualSide);
  const [notice, setNotice] = useState<string | null>(null);
  const confirm = async () => {
    if (hedge === dualSide) return onClose();
    const result = await positionMode.run(hedge);
    if (result.status === 'error')
      return setNotice(futuresErrorText(copy, result.error));
    toast.show({ tone: 'success', message: f.saved });
    onClose();
  };
  return (
    <Dialog
      open
      onOpenChange={(next) => !next && onClose()}
      title={f.positionModeTitle}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {copy.common.cancel}
          </Button>
          <Button
            onClick={() => void confirm()}
            disabled={positionMode.pending}
          >
            {f.confirm}
          </Button>
        </>
      }
    >
      <SegmentedControl
        label={f.positionModeTitle}
        value={hedge ? 'hedge' : 'oneWay'}
        onChange={(value) => setHedge(value === 'hedge')}
        options={[
          { value: 'oneWay', label: f.oneWay },
          { value: 'hedge', label: f.hedge },
        ]}
      />
      <p className="mt-3 text-xs text-muted">
        {hedge ? f.hedgeHint : f.oneWayHint}
      </p>
      <p className="mt-2 text-[11px] text-muted-dim">{f.positionModeNote}</p>
      {notice && (
        <div className="mt-3">
          <FormNotice tone="error">{notice}</FormNotice>
        </div>
      )}
    </Dialog>
  );
}
