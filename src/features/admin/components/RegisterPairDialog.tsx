import { useDeferredValue, useState } from 'react';
import { Plus } from 'lucide-react';
import { Alert as Banner } from '../../../components/feedback/States';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Input } from '../../../components/ui/Input';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useCopy } from '../../../hooks/use-copy';
import { useToast } from '../../../hooks/use-toast';
import { formatCopy } from '../../../i18n/copy';
import { errorText } from '../../../i18n/messages';
import { problemOf } from '../../../services/api/errors';
import { pairLabel } from '../../../utils/pair-label';
import { useExchangeSymbols, useRegisterPair } from '../hooks/use-admin-pairs';

/**
 * SCR-37 Add pair (UC-45): a symbol the exchange trades and that is not a
 * pair yet, found by its letters; it is added inactive with its markets
 * off, so it shows nowhere until the Admin turns them on.
 */
export function RegisterPairDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const copy = useCopy();
  const t = copy.adminPairs;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={t.registerTitle}
      description={t.registerDescription}
      footer={
        <Button variant="secondary" onClick={onClose}>
          {copy.common.close}
        </Button>
      }
    >
      {open && <RegisterForm onDone={onClose} />}
    </Dialog>
  );
}

function RegisterForm({ onDone }: { onDone: () => void }) {
  const copy = useCopy();
  const t = copy.adminPairs;
  const { show } = useToast();
  const [typed, setTyped] = useState('');
  const q = useDeferredValue(typed.trim().toUpperCase());
  const symbols = useExchangeSymbols(q);
  const register = useRegisterPair();
  const problem = problemOf(
    register.state.status === 'error' ? register.state.error : null,
  );

  async function add(symbol: string) {
    const result = await register.run(symbol);
    if (result.status !== 'success') return;
    show({
      tone: 'success',
      message: formatCopy(t.registered, { pair: pairLabel(symbol) }),
    });
    onDone();
  }

  return (
    <div className="grid gap-3">
      <Input
        label={t.registerSearch}
        autoComplete="off"
        value={typed}
        onChange={(event) => {
          setTyped(event.target.value);
          register.reset();
        }}
        hint={t.registerHint}
      />
      {problem && (
        <Banner
          tone="danger"
          title={
            problem.code === 'PAIR_ALREADY_REGISTERED'
              ? t.alreadyRegistered
              : problem.code === 'PAIR_NOT_TRADING'
                ? t.notTrading
                : errorText(
                    copy,
                    register.state.status === 'error'
                      ? register.state.error
                      : null,
                  )
          }
        />
      )}
      {q.length < 2 ? null : symbols.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : symbols.isError ? (
        <Banner tone="danger" title={errorText(copy, symbols.error)} />
      ) : symbols.data.length === 0 ? (
        <p role="status" className="text-xs text-muted">
          {t.registerNone}
        </p>
      ) : (
        <ul className="grid max-h-64 gap-1 overflow-y-auto">
          {symbols.data.map((item) => (
            <li
              key={item.symbol}
              className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-fg">
                  {pairLabel(item.symbol)}
                </span>
                <span className="text-[11px] text-muted-dim">
                  {[
                    item.spotTrading ? copy.market.spot : null,
                    item.futuresTrading ? copy.market.futures : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={register.pending}
                aria-label={formatCopy(t.registerAdd, {
                  pair: pairLabel(item.symbol),
                })}
                onClick={() => void add(item.symbol)}
              >
                <Plus size={13} aria-hidden="true" />
                {t.addPair}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
