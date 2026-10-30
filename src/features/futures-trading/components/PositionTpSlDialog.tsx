import { useState } from 'react';
import { FormNotice } from '../../../components/feedback/FormNotice';
import { Button } from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import { DecimalInput } from '../../../components/ui/DecimalInput';
import { Dialog } from '../../../components/ui/Dialog';
import { NumericText } from '../../../components/ui/NumericText';
import { useCopy } from '../../../hooks/use-copy';
import { useToast } from '../../../hooks/use-toast';
import { formatCopy } from '../../../i18n/copy';
import type { FuturesPosition } from '../../../types/futures';
import { formatPrice, toFixedDecimal } from '../../../utils/decimal-format';
import { isPlainDecimal, isPositive } from '../../../utils/decimal-math';
import { useFuturesActions } from '../hooks/use-futures';
import { futuresErrorText } from '../model/futures-errors';
import { unrealizedPnl } from '../model/futures-math';

/**
 * TP/SL of the whole position (plan 5.6): a TAKE_PROFIT_MARKET and a
 * STOP_MARKET with closePosition, on the last or the mark price, each
 * showing the profit or loss it would realise at its trigger.
 */
export function PositionTpSlDialog({
  position,
  tickSize,
  onClose,
}: {
  position: FuturesPosition;
  tickSize: string | null;
  onClose: () => void;
}) {
  const copy = useCopy();
  const f = copy.futures;
  const toast = useToast();
  const { placeAlgo } = useFuturesActions();
  const [takeProfit, setTakeProfit] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [mark, setMark] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const long = !position.positionAmt.startsWith('-');
  const size = position.positionAmt.replace('-', '');
  const pnlAt = (price: string) =>
    isPlainDecimal(price) && isPositive(price)
      ? unrealizedPnl(long ? 'LONG' : 'SHORT', size, position.entryPrice, price)
      : null;
  const confirm = async () => {
    const legs = [
      { price: takeProfit, type: 'TAKE_PROFIT_MARKET' as const },
      { price: stopLoss, type: 'STOP_MARKET' as const },
    ].filter((leg) => leg.price.trim() !== '');
    if (legs.length === 0) return setNotice(f.errRequired);
    if (
      legs.some((leg) => !(isPlainDecimal(leg.price) && isPositive(leg.price)))
    )
      return setNotice(f.errInvalid);
    for (const leg of legs) {
      const result = await placeAlgo.run({
        symbol: position.symbol,
        side: long ? 'SELL' : 'BUY',
        positionSide: position.positionSide,
        type: leg.type,
        triggerPrice: leg.price,
        closePosition: true,
        workingType: mark ? 'MARK_PRICE' : 'CONTRACT_PRICE',
      });
      if (result.status === 'error')
        return setNotice(futuresErrorText(copy, result.error));
    }
    toast.show({ tone: 'success', message: f.tpslSaved });
    onClose();
  };
  const estimate = (price: string) => {
    const pnl = pnlAt(price);
    return pnl ? (
      <p className="mt-1 text-[11px] text-muted">
        {f.expectedPnl}{' '}
        <NumericText signed value={toFixedDecimal(pnl, 2)} suffix=" USDT" />
      </p>
    ) : null;
  };
  return (
    <Dialog
      open
      onOpenChange={(next) => !next && onClose()}
      title={formatCopy(f.tpslTitle, { symbol: position.symbol })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {copy.common.cancel}
          </Button>
          <Button onClick={() => void confirm()} disabled={placeAlgo.pending}>
            {f.confirm}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-xs text-muted">
        {formatCopy(f.tpslPosition, {
          entry: formatPrice(position.entryPrice, tickSize),
          mark: formatPrice(position.markPrice, tickSize),
        })}
      </p>
      <DecimalInput
        inline
        label={formatCopy(f.takeProfit, { asset: 'USDT' })}
        autoComplete="off"
        value={takeProfit}
        onValueChange={setTakeProfit}
      />
      {estimate(takeProfit)}
      <div className="mt-3">
        <DecimalInput
          inline
          label={formatCopy(f.stopLoss, { asset: 'USDT' })}
          autoComplete="off"
          value={stopLoss}
          onValueChange={setStopLoss}
        />
      </div>
      {estimate(stopLoss)}
      <div className="mt-3">
        <Checkbox
          label={f.tpslOnMark}
          checked={mark}
          onChange={(event) => setMark(event.target.checked)}
        />
      </div>
      {notice && (
        <div className="mt-3">
          <FormNotice tone="error">{notice}</FormNotice>
        </div>
      )}
    </Dialog>
  );
}
