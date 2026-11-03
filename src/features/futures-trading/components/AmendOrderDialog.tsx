import { useState } from 'react';
import { FormNotice } from '../../../components/feedback/FormNotice';
import { Button } from '../../../components/ui/Button';
import { DecimalInput } from '../../../components/ui/DecimalInput';
import { Dialog } from '../../../components/ui/Dialog';
import { useCopy } from '../../../hooks/use-copy';
import { useToast } from '../../../hooks/use-toast';
import { formatCopy } from '../../../i18n/copy';
import type { FuturesOrder } from '../../../types/futures';
import { groupThousands } from '../../../utils/decimal-format';
import {
  compare,
  isPlainDecimal,
  isPositive,
} from '../../../utils/decimal-math';
import { useFuturesActions } from '../hooks/use-futures';
import { futuresErrorText } from '../model/futures-errors';

/**
 * Edit a waiting LIMIT order in place, as the exchange's (PUT order): the
 * new price and quantity; the side, the time in force and the key stay.
 * The quantity cannot go below what has already filled; the server refuses
 * an edit that changes nothing (-5027) or that the margin cannot carry.
 */
export function AmendOrderDialog({
  order,
  onClose,
}: {
  order: FuturesOrder;
  onClose: () => void;
}) {
  const copy = useCopy();
  const f = copy.futures;
  const toast = useToast();
  const { amend } = useFuturesActions();
  const [price, setPrice] = useState(order.price);
  const [quantity, setQuantity] = useState(order.origQty);
  const [errors, setErrors] = useState<{ price?: string; quantity?: string }>(
    {},
  );
  const [notice, setNotice] = useState<string | null>(null);
  const filled = isPositive(order.executedQty);

  const confirm = async () => {
    const found: { price?: string; quantity?: string } = {};
    const check = (value: string) =>
      value.trim() === ''
        ? f.errRequired
        : isPlainDecimal(value) && isPositive(value)
          ? undefined
          : f.errInvalid;
    const priceError = check(price);
    const quantityError = check(quantity);
    if (priceError) found.price = priceError;
    if (quantityError) found.quantity = quantityError;
    else if (filled && compare(quantity, order.executedQty) <= 0)
      found.quantity = formatCopy(f.amendBelowFilled, {
        filled: groupThousands(order.executedQty),
      });
    setErrors(found);
    if (found.price || found.quantity) return;
    if (
      compare(price, order.price) === 0 &&
      compare(quantity, order.origQty) === 0
    )
      return setNotice(f.errUnchanged);
    const result = await amend.run({
      symbol: order.symbol,
      orderId: order.orderId,
      side: order.side,
      price,
      quantity,
    });
    if (result.status === 'error')
      return setNotice(futuresErrorText(copy, result.error));
    if (result.status !== 'success') return;
    toast.show({
      tone: 'success',
      message: formatCopy(f.amendSaved, { symbol: order.symbol }),
    });
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(next) => !next && onClose()}
      title={formatCopy(f.amendTitle, { symbol: order.symbol })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {copy.common.cancel}
          </Button>
          <Button onClick={() => void confirm()} disabled={amend.pending}>
            {f.confirm}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-xs text-muted">
        {formatCopy(f.amendSummary, {
          side: order.side === 'BUY' ? f.buy : f.sell,
          filled: groupThousands(order.executedQty),
          amount: groupThousands(order.origQty),
        })}
      </p>
      <DecimalInput
        inline
        label={formatCopy(f.price, { asset: 'USDT' })}
        autoComplete="off"
        value={price}
        error={errors.price}
        onValueChange={(value) => {
          setPrice(value);
          setNotice(null);
        }}
      />
      <div className="mt-3">
        <DecimalInput
          inline
          label={f.amendQuantity}
          autoComplete="off"
          value={quantity}
          error={errors.quantity}
          onValueChange={(value) => {
            setQuantity(value);
            setNotice(null);
          }}
        />
      </div>
      <p className="mt-3 text-[11px] text-muted-dim">{f.amendNote}</p>
      {notice && (
        <div className="mt-3">
          <FormNotice tone="error">{notice}</FormNotice>
        </div>
      )}
    </Dialog>
  );
}
