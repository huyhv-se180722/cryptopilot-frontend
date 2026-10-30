import { useState } from 'react';
import { Checkbox } from '../../../components/ui/Checkbox';
import { NumericText } from '../../../components/ui/NumericText';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Table } from '../../../components/ui/Table';
import { buttonClassName } from '../../../components/ui/button-styles';
import { useCopy } from '../../../hooks/use-copy';
import type {
  PaperLedgerEntry,
  PaperLedgerType,
  PaperTransfer,
  PaperWallet,
  PaperWalletType,
} from '../../../types/domain';
import {
  groupThousands,
  toFixedDecimal,
  trimDecimal,
} from '../../../utils/decimal-format';
import { compare } from '../../../utils/decimal-math';
import { timeCell } from '../hooks/use-paper-columns';
import {
  PAPER_PAGE_SIZE,
  useLedger,
  useTransfers,
} from '../hooks/use-paper-orders';
import { periodStart, type Period } from '../model/period';
import { PaperPager, PaperQueryState } from './paper-tables';
import { PeriodControl } from './PeriodControl';

const LEDGER_TYPES: readonly PaperLedgerType[] = [
  'INITIAL_GRANT',
  'TRADE',
  'FEE',
  'TRANSFER',
  'REALIZED_PNL',
  'FUNDING_FEE',
  'LIQUIDATION_FEE',
];

/** An amount as stored ("5000.00000000") without the zeros its scale adds: "5,000.00". */
const amountText = (value: string) => groupThousands(trimDecimal(value, 2));

/**
 * The coins of one wallet (B Spot / Futures wallet): search by coin,
 * hide zero balances, total, available, in orders and value in USDT.
 */
export function BalancesTable({ wallet }: { wallet: PaperWallet }) {
  const copy = useCopy();
  const p = copy.paper;
  const [search, setSearch] = useState('');
  const [hideZero, setHideZero] = useState(false);
  const needle = search.trim().toUpperCase();
  const rows = wallet.balances.filter(
    (row) =>
      (needle === '' || row.asset.includes(needle)) &&
      (!hideZero || compare(row.total, '0') > 0),
  );
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="w-full sm:w-56">
          <span className="sr-only">{p.searchCoin}</span>
          <input
            type="search"
            value={search}
            placeholder={p.searchCoin}
            onChange={(event) => setSearch(event.target.value)}
            className="h-9 w-full rounded-lg border border-line bg-raised px-3 text-xs text-fg placeholder:text-muted-dim focus:border-primary-line focus:outline-none"
          />
        </label>
        <Checkbox
          label={p.hideZero}
          checked={hideZero}
          onChange={(event) => setHideZero(event.target.checked)}
        />
      </div>
      <Table
        caption={wallet.wallet === 'SPOT' ? p.spotWallet : p.futuresWallet}
        columns={[
          { id: 'coin', header: p.fundsCoin, render: (row) => row.asset },
          {
            id: 'total',
            header: p.fundsTotal,
            numeric: true,
            render: (row) => <NumericText value={amountText(row.total)} />,
          },
          {
            id: 'free',
            header: p.fundsFree,
            numeric: true,
            render: (row) => <NumericText value={amountText(row.free)} />,
          },
          {
            id: 'locked',
            header: p.fundsLocked,
            numeric: true,
            render: (row) => <NumericText value={amountText(row.locked)} />,
          },
          {
            id: 'value',
            header: p.fundsValue,
            numeric: true,
            render: (row) =>
              row.usdtValue ? (
                <NumericText
                  value={groupThousands(toFixedDecimal(row.usdtValue, 2))}
                />
              ) : (
                copy.market.noValue
              ),
          },
        ]}
        rows={rows}
        rowKey={(row) => row.asset}
        emptyMessage={copy.messages.MSG41}
      />
      {!wallet.complete && (
        <p className="mt-2 text-[11px] text-warning">{p.incompleteValue}</p>
      )}
    </>
  );
}

/**
 * Transaction history (B Transaction History): every balance change with
 * its signed amount and the balance after it; filters by wallet, type and
 * period; 20 rows a page.
 */
export function LedgerHistory() {
  const copy = useCopy();
  const p = copy.paper;
  const [wallet, setWallet] = useState<PaperWalletType | 'ALL'>('ALL');
  const [type, setType] = useState<PaperLedgerType | ''>('');
  const [period, setPeriod] = useState<Period>('30');
  const [page, setPage] = useState(1);
  const from = periodStart(period);
  const query = useLedger(
    {
      ...(wallet !== 'ALL' ? { wallet } : {}),
      ...(type ? { type } : {}),
      ...(from ? { from } : {}),
      page,
      pageSize: PAPER_PAGE_SIZE,
    },
    true,
  );
  const reset = () => {
    setWallet('ALL');
    setType('');
    setPeriod('30');
    setPage(1);
  };
  return (
    <>
      <div
        role="group"
        aria-label={p.filtersLabel}
        className="mb-3 flex flex-wrap items-center gap-3"
      >
        <SegmentedControl
          label={p.filterWallet}
          value={wallet}
          onChange={(value) => {
            setWallet(value);
            setPage(1);
          }}
          options={[
            { value: 'ALL', label: p.filterAll },
            { value: 'SPOT', label: p.tabSpot },
            { value: 'FUTURES', label: p.tabFutures },
          ]}
        />
        <label className="flex items-center gap-2 text-xs text-muted">
          {p.filterType}
          <select
            value={type}
            onChange={(event) => {
              setType(event.target.value as PaperLedgerType | '');
              setPage(1);
            }}
            className="h-8 rounded-lg border border-line bg-raised px-2 text-xs text-fg"
          >
            <option value="">{p.filterAll}</option>
            {LEDGER_TYPES.map((value) => (
              <option key={value} value={value}>
                {p[`ledger${value}`]}
              </option>
            ))}
          </select>
        </label>
        <PeriodControl
          value={period}
          onChange={(value) => {
            setPeriod(value);
            setPage(1);
          }}
        />
        <button
          type="button"
          onClick={reset}
          className={buttonClassName('ghost', 'sm')}
        >
          {p.resetFilters}
        </button>
      </div>
      <PaperQueryState query={query}>
        {() => (
          <>
            <Table<PaperLedgerEntry>
              caption={p.tabLedger}
              columns={[
                {
                  id: 'time',
                  header: p.colTime,
                  render: (row) => timeCell(row.createdAt),
                },
                {
                  id: 'wallet',
                  header: p.colWallet,
                  render: (row) =>
                    row.wallet === 'SPOT' ? p.tabSpot : p.tabFutures,
                },
                { id: 'coin', header: p.colCoin, render: (row) => row.asset },
                {
                  id: 'type',
                  header: p.colLedgerType,
                  render: (row) => p[`ledger${row.type}`],
                },
                {
                  id: 'amount',
                  header: p.colChange,
                  numeric: true,
                  render: (row) => (
                    <NumericText signed value={amountText(row.amount)} />
                  ),
                },
                {
                  id: 'after',
                  header: p.colBalanceAfter,
                  numeric: true,
                  render: (row) => (
                    <NumericText value={amountText(row.balanceAfter)} />
                  ),
                },
              ]}
              rows={query.data?.items ?? []}
              rowKey={(row) => row.entryId}
              emptyMessage={p.noLedger}
            />
            <PaperPager page={query.data} current={page} onChange={setPage} />
          </>
        )}
      </PaperQueryState>
    </>
  );
}

/** Transfers between the Spot and Futures wallets, newest first. */
export function TransferHistory() {
  const copy = useCopy();
  const p = copy.paper;
  const [page, setPage] = useState(1);
  const query = useTransfers(page, true);
  const walletName = (wallet: PaperWalletType) =>
    wallet === 'SPOT' ? p.tabSpot : p.tabFutures;
  return (
    <PaperQueryState query={query}>
      {() => (
        <>
          <Table<PaperTransfer>
            caption={p.tabTransfers}
            columns={[
              {
                id: 'time',
                header: p.colTime,
                render: (row) => timeCell(row.transferredAt),
              },
              { id: 'coin', header: p.colCoin, render: (row) => row.asset },
              {
                id: 'from',
                header: p.colFrom,
                render: (row) => walletName(row.from),
              },
              {
                id: 'to',
                header: p.colTo,
                render: (row) => walletName(row.to),
              },
              {
                id: 'amount',
                header: p.colAmountPlain,
                numeric: true,
                render: (row) => <NumericText value={amountText(row.amount)} />,
              },
            ]}
            rows={query.data?.items ?? []}
            rowKey={(row) => row.transferId}
            emptyMessage={p.noTransfers}
          />
          <PaperPager page={query.data} current={page} onChange={setPage} />
        </>
      )}
    </PaperQueryState>
  );
}
