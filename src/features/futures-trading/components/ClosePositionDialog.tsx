import { useState } from 'react';
import { FormNotice } from '../../../components/feedback/FormNotice';
import { Button } from '../../../components/ui/Button';
import { DecimalInput } from '../../../components/ui/DecimalInput';
import { Dialog } from '../../../components/ui/Dialog';
import { useCopy } from '../../../hooks/use-copy';
import { useToast } from '../../../hooks/use-toast';
import { formatCopy } from '../../../i18n/copy';
import type { FuturesPosition } from '../../../types/futures';
import {
  decimalPlaces,
  groupThousands,
  toFixedDecimal,
} from '../../../utils/decimal-format';
import { isPlainDecimal, isPositive } from '../../../utils/decimal-math';
import { ShareSlider } from '../../paper-trading/components/ShareSlider';
import { useFuturesActions } from '../hooks/use-futures';
import { futuresErrorText } from '../model/futures-errors';

/**
 * Close a position, all of it or a share, at the market or at a limit
 * price (TR-17, `/futures/closePosition`): the server places the closing
 * reduce-only order (or the closing side in hedge mode).
 */
export function ClosePositionDialog({
  position,
  type,
  tickSize,
  onClose,
}: {
  position: FuturesPosition;
  type: 'MARKET' | 'LIMIT';
  tickSize: string | null;
  onClose: () => void;
}) {
  const copy = useCopy();
  const f = copy.futures;
  const toast = useToast();
  const { close } = useFuturesActions();
  const [percent, setPercent] = useState(100);
  const [price, setPrice] = useState(
    type === 'LIMIT'
      ? toFixedDecimal(position.markPrice, decimalPlaces(tickSize))
      : '',
  );
  const [notice, setNotice] = useState<string | null>(null);
  const size = position.positionAmt.replace('-', '');
  const confirm = async () => {
    if (type === 'LIMIT' && !(isPlainDecimal(price) && isPositive(price)))
      return setNotice(f.errInvalid);
    if (percent < 1) return setNotice(f.errInvalid);
    const result = await close.run({
      symbol: position.symbol,
      positionSide: position.positionSide,
      type,
      ...(type === 'LIMIT' ? { price } : {}),
      ...(percent < 100 ? { percent: String(percent) } : {}),
    });
    if (result.status === 'error')
      return setNotice(futuresErrorText(copy, result.error));
    toast.show({
      tone: 'success',
      message: formatCopy(f.closeSent, { symbol: position.symbol }),
    });
    onClose();
  };
  return (
    <Dialog
      open
      onOpenChange={(next) => !next && onClose()}
      title={formatCopy(
        type === 'MARKET' ? f.closeMarketTitle : f.closeLimitTitle,
        {
          symbol: position.symbol,
        },
      )}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {copy.common.cancel}
          </Button>
          <Button onClick={() => void confirm()} disabled={close.pending}>
            {f.confirm}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-xs text-muted">
        {formatCopy(f.closeSize, { size: groupThousands(size) })}
      </p>
      {type === 'LIMIT' && (
        <DecimalInput
          inline
          label={formatCopy(f.price, { asset: 'USDT' })}
          autoComplete="off"
          value={price}
          onValueChange={setPrice}
        />
      )}
      <div className="mt-3">
        <ShareSlider
          value={percent}
          disabled={false}
          onChange={(value) => setPercent(value)}
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
