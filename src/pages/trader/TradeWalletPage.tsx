import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatCard } from '../../components/layout/StatCard';
import { NumericText } from '../../components/ui/NumericText';
import { Tabs } from '../../components/ui/Tabs';
import { buttonClassName } from '../../components/ui/button-styles';
import { useCopy } from '../../hooks/use-copy';
import { formatCopy } from '../../i18n/copy';
import { DemoTradingBanner } from '../../features/paper-trading/components/DemoTradingBanner';
import { PaperNav } from '../../features/paper-trading/components/PaperNav';
import { TransferDialog } from '../../features/paper-trading/components/TransferDialog';
import {
  BalancesTable,
  LedgerHistory,
  TransferHistory,
} from '../../features/paper-trading/components/WalletHistory';
import { PaperQueryState } from '../../features/paper-trading/components/paper-tables';
import { usePaperWallet } from '../../features/paper-trading/hooks/use-paper-orders';
import { groupThousands, toFixedDecimal } from '../../utils/decimal-format';
import { add } from '../../utils/decimal-math';

/**
 * Demo wallet (D-86, plan section 16, TR-04; designed after the exchange's
 * Wallet Overview without a Figma frame): the estimated balance of both
 * wallets in USDT and BTC, each wallet's value, the coins of the Spot and
 * Futures wallets, the transaction history and the transfers, with a
 * USDT transfer between the wallets. Virtual funds only.
 */
export function TradeWalletPage() {
  const copy = useCopy();
  const p = copy.paper;
  const [tab, setTab] = useState('spot');
  const [transferOpen, setTransferOpen] = useState(false);
  const spot = usePaperWallet('SPOT');
  const futures = usePaperWallet('FUTURES');
  const usdt = (value: string | undefined) =>
    value
      ? groupThousands(toFixedDecimal(value, 2)) + ' USDT'
      : copy.market.noValue;
  const total =
    spot.data && futures.data
      ? add(spot.data.estimatedUsdt, futures.data.estimatedUsdt)
      : undefined;
  const btc =
    spot.data?.estimatedBtc && futures.data?.estimatedBtc
      ? add(spot.data.estimatedBtc, futures.data.estimatedBtc)
      : null;

  return (
    <div className="mx-auto w-full max-w-7xl">
      <DemoTradingBanner />
      <PaperNav />
      <PageHeader
        title={p.walletTitle}
        description={p.walletSubtitle}
        actions={
          <>
            <button
              type="button"
              onClick={() => setTransferOpen(true)}
              disabled={!spot.data}
              className={buttonClassName('secondary', 'md')}
            >
              <ArrowLeftRight size={14} aria-hidden="true" />
              {p.transfer}
            </button>
            <Link
              to="/trade/spot"
              className={buttonClassName('primary', 'md', 'no-underline')}
            >
              {copy.nav.trade}
            </Link>
          </>
        }
      />
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label={p.estimatedTotal}
          value={<NumericText value={usdt(total)} />}
          status={
            btc
              ? formatCopy(p.approxBtc, { btc: toFixedDecimal(btc, 8) })
              : undefined
          }
          accent="primary"
        />
        <StatCard
          label={p.spotWallet}
          value={<NumericText value={usdt(spot.data?.estimatedUsdt)} />}
          accent="positive"
        />
        <StatCard
          label={p.futuresWallet}
          value={<NumericText value={usdt(futures.data?.estimatedUsdt)} />}
          accent="warning"
        />
      </div>
      <Tabs
        label={p.walletTitle}
        value={tab}
        onChange={setTab}
        items={[
          {
            id: 'spot',
            label: p.tabSpot,
            panel: (
              <PaperQueryState query={spot}>
                {() => spot.data && <BalancesTable wallet={spot.data} />}
              </PaperQueryState>
            ),
          },
          {
            id: 'futures',
            label: p.tabFutures,
            panel: (
              <PaperQueryState query={futures}>
                {() => futures.data && <BalancesTable wallet={futures.data} />}
              </PaperQueryState>
            ),
          },
          {
            id: 'ledger',
            label: p.tabLedger,
            panel: tab === 'ledger' ? <LedgerHistory /> : null,
          },
          {
            id: 'transfers',
            label: p.tabTransfers,
            panel: tab === 'transfers' ? <TransferHistory /> : null,
          },
        ]}
      />
      <TransferDialog open={transferOpen} onOpenChange={setTransferOpen} />
    </div>
  );
}
