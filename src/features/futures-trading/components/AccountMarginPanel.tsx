import { useState, type ReactNode } from 'react';
import { NumericText } from '../../../components/ui/NumericText';
import { useCopy } from '../../../hooks/use-copy';
import type { FuturesAccount } from '../../../types/futures';
import { classNames } from '../../../utils/class-names';
import { groupThousands, toFixedDecimal } from '../../../utils/decimal-format';
import { TransferDialog } from '../../paper-trading/components/TransferDialog';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="flex justify-between text-[11px] text-muted">
      <span>{label}</span>
      <span className="text-fg-2">{children}</span>
    </p>
  );
}

/**
 * The account under the order form (plan 12.3): the cross margin ratio as
 * a bar that turns amber then red as it nears liquidation (100 %), the
 * maintenance margin, the margin balance, the wallet and the unrealized
 * profit, and a Transfer between the Spot and Futures wallets.
 */
export function AccountMarginPanel({
  account,
}: {
  account: FuturesAccount | undefined;
}) {
  const copy = useCopy();
  const f = copy.futures;
  const none = copy.market.noValue;
  const [transfer, setTransfer] = useState(false);
  const usdt = (value: string | undefined) =>
    value ? (
      <NumericText
        value={groupThousands(toFixedDecimal(value, 2))}
        suffix=" USDT"
      />
    ) : (
      none
    );
  const ratio = account?.marginRatio ? Number(account.marginRatio) * 100 : null;
  return (
    <section aria-label={f.accountTitle} className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-fg">{f.accountTitle}</h3>
        <button
          type="button"
          onClick={() => setTransfer(true)}
          className="text-xs font-medium text-primary hover:underline"
        >
          {f.transfer}
        </button>
      </div>
      <Row label={f.marginRatio}>
        {ratio === null ? (
          none
        ) : (
          <NumericText value={ratio.toFixed(2)} suffix="%" />
        )}
      </Row>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-raised"
        role="meter"
        aria-label={f.marginRatio}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={ratio ?? 0}
      >
        <div
          className={classNames(
            'h-full rounded-full',
            ratio === null || ratio < 50
              ? 'bg-positive'
              : ratio < 80
                ? 'bg-warning'
                : 'bg-negative',
          )}
          style={{ width: `${Math.min(ratio ?? 0, 100)}%` }}
        />
      </div>
      <Row label={f.maintMargin}>{usdt(account?.totalMaintMargin)}</Row>
      <Row label={f.marginBalance}>{usdt(account?.totalMarginBalance)}</Row>
      <Row label={f.walletBalance}>{usdt(account?.totalWalletBalance)}</Row>
      <Row label={f.unrealized}>
        {account ? (
          <NumericText
            signed
            value={toFixedDecimal(account.totalUnrealizedProfit, 2)}
            suffix=" USDT"
          />
        ) : (
          none
        )}
      </Row>
      <Row label={f.maxTransfer}>{usdt(account?.maxWithdrawAmount)}</Row>
      <TransferDialog open={transfer} onOpenChange={setTransfer} />
    </section>
  );
}
