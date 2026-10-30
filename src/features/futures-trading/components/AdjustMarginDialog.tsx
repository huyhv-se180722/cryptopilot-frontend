import { useState } from 'react';
import { FormNotice } from '../../../components/feedback/FormNotice';
import { Button } from '../../../components/ui/Button';
import { DecimalInput } from '../../../components/ui/DecimalInput';
import { Dialog } from '../../../components/ui/Dialog';
import { NumericText } from '../../../components/ui/NumericText';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { useCopy } from '../../../hooks/use-copy';
import { useToast } from '../../../hooks/use-toast';
import { formatCopy } from '../../../i18n/copy';
import type { FuturesPosition } from '../../../types/futures';
import { groupThousands, toFixedDecimal } from '../../../utils/decimal-format';
import { isPlainDecimal, isPositive } from '../../../utils/decimal-math';
import { useFuturesAccount, useFuturesActions } from '../hooks/use-futures';
import { futuresErrorText } from '../model/futures-errors';
import { maxRemovableMargin } from '../model/futures-math';

/**
 * Add margin to an isolated position from the cross wallet's free cash, or
 * take some out while what is left still covers its initial margin at the
 * mark (4.9, TR-17).
 */
export function AdjustMarginDialog({
  position,
  onClose,
}: {
  position: FuturesPosition;
  onClose: () => void;
}) {
  const copy = useCopy();
  const f = copy.futures;
  const toast = useToast();
  const account = useFuturesAccount();
  const { adjustMargin } = useFuturesActions();
  const [mode, setMode] = useState<'add' | 'remove'>('add');
  const [amount, setAmount] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const max =
    mode === 'add'
      ? (account.data?.maxWithdrawAmount ?? null)
      : maxRemovableMargin(
          position.isolatedWallet,
          position.unRealizedProfit,
          position.notional,
          position.leverage,
        );
  const confirm = async () => {
    if (!(isPlainDecimal(amount) && isPositive(amount)))
      return setNotice(f.errInvalid);
    const result = await adjustMargin.run({
      symbol: position.symbol,
      positionSide: position.positionSide,
      amount,
      type: mode === 'add' ? 1 : 2,
    });
    if (result.status === 'error')
      return setNotice(futuresErrorText(copy, result.error));
    toast.show({ tone: 'success', message: f.saved });
    onClose();
  };
  return (
    <Dialog
      open
      onOpenChange={(next) => !next && onClose()}
      title={formatCopy(f.adjustMarginTitle, { symbol: position.symbol })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {copy.common.cancel}
          </Button>
          <Button
            onClick={() => void confirm()}
            disabled={adjustMargin.pending}
          >
            {f.confirm}
          </Button>
        </>
      }
    >
      <SegmentedControl
        label={f.adjustMargin}
        value={mode}
        onChange={(value) => {
          setMode(value);
          setNotice(null);
        }}
        options={[
          { value: 'add', label: f.addMargin },
          { value: 'remove', label: f.removeMargin },
        ]}
      />
      <div className="mt-3">
        <DecimalInput
          inline
          label={formatCopy(f.amount, { asset: 'USDT' })}
          autoComplete="off"
          value={amount}
          onValueChange={setAmount}
        />
      </div>
      <p className="mt-2 flex justify-between text-[11px] text-muted">
        <span>{mode === 'add' ? f.maxAdd : f.maxRemove}</span>
        {max ? (
          <button
            type="button"
            className="text-primary hover:underline"
            onClick={() => setAmount(toFixedDecimal(max, 2))}
          >
            <NumericText value={groupThousands(max)} suffix=" USDT" />
          </button>
        ) : (
          copy.market.noValue
        )}
      </p>
      <p className="mt-1 flex justify-between text-[11px] text-muted">
        <span>{f.currentMargin}</span>
        <NumericText
          value={groupThousands(toFixedDecimal(position.isolatedWallet, 2))}
          suffix=" USDT"
        />
      </p>
      {notice && (
        <div className="mt-3">
          <FormNotice tone="error">{notice}</FormNotice>
        </div>
      )}
    </Dialog>
  );
}
