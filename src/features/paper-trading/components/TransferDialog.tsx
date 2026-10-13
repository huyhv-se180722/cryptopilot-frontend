import { useRef, useState, type FormEvent } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { FormNotice } from '../../../components/feedback/FormNotice';
import { Dialog } from '../../../components/ui/Dialog';
import { IconButton } from '../../../components/ui/IconButton';
import { Input } from '../../../components/ui/Input';
import { buttonClassName } from '../../../components/ui/button-styles';
import { useCopy } from '../../../hooks/use-copy';
import { useToast } from '../../../hooks/use-toast';
import { formatCopy } from '../../../i18n/copy';
import { errorText } from '../../../i18n/messages';
import { problemOf } from '../../../services/api/errors';
import type { PaperWalletType } from '../../../types/domain';
import { groupThousands, trimDecimal } from '../../../utils/decimal-format';
import {
  compare,
  isPlainDecimal,
  isPositive,
  toStep,
} from '../../../utils/decimal-math';
import { usePaperActions, usePaperWallet } from '../hooks/use-paper-orders';

const other = (wallet: PaperWalletType): PaperWalletType =>
  wallet === 'SPOT' ? 'FUTURES' : 'SPOT';

/**
 * Transfer USDT between the demo Spot and Futures wallets (TR-04, the
 * exchange's transfer dialog): from / to with a swap, the amount with
 * Max, checked against the free balance. The idempotency key is kept
 * when the same transfer is sent again after a failure.
 */
export function TransferDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const copy = useCopy();
  const p = copy.paper;
  const toast = useToast();
  const { transfer } = usePaperActions();
  const [from, setFrom] = useState<PaperWalletType>('SPOT');
  const [amount, setAmount] = useState('');
  const [shown, setShown] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const sent = useRef<{ key: string; id: string } | null>(null);
  const source = usePaperWallet(from);
  const free =
    source.data?.balances.find((balance) => balance.asset === 'USDT')?.free ??
    '0';

  const trimmed = amount.trim();
  const problem =
    trimmed === ''
      ? p.errRequired
      : !isPlainDecimal(trimmed) || !isPositive(trimmed)
        ? p.errInvalid
        : compare(trimmed, free) > 0
          ? p.errInsufficient
          : null;

  const close = () => {
    setAmount('');
    setShown(false);
    setNotice(null);
    sent.current = null;
    onOpenChange(false);
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setShown(true);
    if (problem) return;
    const value = toStep(trimmed, '0.00000001', 'down');
    const key = `${from}:${value}`;
    if (sent.current?.key !== key)
      sent.current = { key, id: 'web-' + crypto.randomUUID() };
    const result = await transfer.run(from, value, sent.current.id);
    if (result.status === 'success') {
      toast.show({
        tone: 'success',
        message: formatCopy(p.transferDone, {
          amount: groupThousands(trimDecimal(value, 0)),
          wallet: (from === 'SPOT'
            ? p.walletFUTURES
            : p.walletSPOT
          ).toLowerCase(),
        }),
      });
      close();
    } else if (result.status === 'error')
      setNotice(
        problemOf(result.error)?.code === 'PAPER_INSUFFICIENT_BALANCE'
          ? p.insufficientServer
          : errorText(copy, result.error),
      );
  }

  const label = (wallet: PaperWalletType) =>
    wallet === 'SPOT' ? p.walletSPOT : p.walletFUTURES;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      title={p.transferTitle}
      size="sm"
    >
      <form noValidate onSubmit={(event) => void submit(event)}>
        <div className="mb-4 flex items-end gap-2">
          <div className="flex-1">
            <span className="mb-1 block text-[11px] text-muted-dim">
              {p.transferFrom}
            </span>
            <span className="block rounded-lg border border-line bg-raised px-3 py-2 text-sm text-fg">
              {label(from)}
            </span>
          </div>
          <IconButton
            label={p.transferSwap}
            icon={<ArrowLeftRight size={15} aria-hidden="true" />}
            onClick={() => {
              setFrom(other(from));
              setNotice(null);
            }}
          />
          <div className="flex-1">
            <span className="mb-1 block text-[11px] text-muted-dim">
              {p.transferTo}
            </span>
            <span className="block rounded-lg border border-line bg-raised px-3 py-2 text-sm text-fg">
              {label(other(from))}
            </span>
          </div>
        </div>
        <div className="flex items-end gap-2">
          <Input
            className="flex-1"
            label={p.transferAmount}
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            hint={`${p.available}: ${groupThousands(free)} USDT`}
            error={shown && problem ? problem : undefined}
            onChange={(event) => {
              setAmount(event.target.value);
              setNotice(null);
            }}
          />
          <button
            type="button"
            className={buttonClassName('secondary', 'md', 'mb-5')}
            onClick={() => setAmount(free)}
          >
            {p.transferMax}
          </button>
        </div>
        {notice && <FormNotice tone="error">{notice}</FormNotice>}
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            className={buttonClassName('secondary', 'md')}
            onClick={close}
          >
            {copy.common.cancel}
          </button>
          <button
            type="submit"
            disabled={transfer.pending}
            className={buttonClassName('primary', 'md')}
          >
            {p.transferSubmit}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
