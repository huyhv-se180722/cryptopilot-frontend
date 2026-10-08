import { useState } from 'react';
import { ClipboardList, Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Dialog } from '../../../components/ui/Dialog';
import { useCopy } from '../../../hooks/use-copy';
import { errorText, messageText } from '../../../i18n/messages';
import { formatCopy } from '../../../i18n/copy';
import type { RiskProfile, RiskProfileParams } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import { FormNotice } from '../../../components/feedback/FormNotice';
import { useChooseRiskProfile } from '../hooks/use-profile';
import { RiskQuestionnaireDialog } from './RiskQuestionnaireDialog';
import { SectionTitle } from '../../../components/ui/SectionTitle';

const PROFILES: readonly RiskProfile[] = [
  'CONSERVATIVE',
  'BALANCED',
  'AGGRESSIVE',
];

/**
 * SCR-07 risk profile (BR-66, BR-67). AGGRESSIVE asks MSG48 before sending;
 * the questionnaire only pre-selects a profile, the Trader saves it.
 */
export function RiskProfileSection({
  risk,
  onSaved,
}: {
  risk: RiskProfileParams;
  onSaved: () => void;
}) {
  const copy = useCopy();
  const p = copy.profile;
  const action = useChooseRiskProfile();
  const [selected, setSelected] = useState<RiskProfile>(risk.riskProfile);
  const [confirming, setConfirming] = useState(false);
  const [questionnaire, setQuestionnaire] = useState(false);
  const [banner, setBanner] = useState<
    { tone: 'error'; error: unknown } | { tone: 'success' } | null
  >(null);
  const label = (profile: RiskProfile) => p[`risk${profile}`];

  async function save(confirmAggressive: boolean) {
    setConfirming(false);
    setBanner(null);
    const result = await action.run(selected, confirmAggressive);
    if (result.status === 'success') {
      setBanner({ tone: 'success' });
      onSaved();
    } else if (result.status === 'error')
      setBanner({ tone: 'error', error: result.error });
  }

  return (
    <Card padding="lg" className="mb-5">
      <SectionTitle>{p.riskTitle}</SectionTitle>
      <p className="-mt-2 mb-4 text-xs text-muted-dim">{p.riskHint}</p>
      {banner?.tone === 'success' && (
        <FormNotice tone="success">{messageText(copy, 'MSG14')}</FormNotice>
      )}
      {banner?.tone === 'error' && (
        <FormNotice tone="error">{errorText(copy, banner.error)}</FormNotice>
      )}

      <dl className="mb-5 grid grid-cols-1 gap-3 rounded-lg border border-line bg-raised p-4 sm:grid-cols-4">
        <div>
          <dt className="text-[11px] text-muted-x">{p.riskCurrent}</dt>
          <dd className="text-sm font-semibold text-fg">
            {label(risk.riskProfile)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted-x">{p.riskPerTrade}</dt>
          <dd className="font-mono text-sm text-fg-2">
            {risk.riskPerTradePercent} %
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted-x">{p.maxLeverage}</dt>
          <dd className="font-mono text-sm text-fg-2">
            {formatCopy(p.leverageValue, { value: risk.maxFuturesLeverage })}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted-x">{p.maxOpenRisk}</dt>
          <dd className="font-mono text-sm text-fg-2">
            {risk.maxTotalOpenRiskPercent} %
          </dd>
        </div>
      </dl>

      <div
        role="radiogroup"
        aria-label={p.riskTitle}
        className="mb-5 grid gap-2 sm:grid-cols-3"
      >
        {PROFILES.map((profile) => {
          const checked = profile === selected;
          return (
            <button
              key={profile}
              type="button"
              role="radio"
              aria-checked={checked}
              disabled={action.pending}
              onClick={() => setSelected(profile)}
              className={classNames(
                'rounded-lg border px-4 py-3 text-left text-sm font-semibold transition-colors disabled:opacity-60',
                checked
                  ? 'border-primary bg-primary-soft text-primary'
                  : 'border-line bg-surface text-muted hover:text-fg-2',
                profile === 'AGGRESSIVE' &&
                  checked &&
                  'border-warning text-warning bg-warning-soft',
              )}
            >
              {label(profile)}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" onClick={() => setQuestionnaire(true)}>
          <ClipboardList size={14} aria-hidden="true" />
          {p.questionnaireOpen}
        </Button>
        <Button
          disabled={action.pending || selected === risk.riskProfile}
          onClick={() =>
            selected === 'AGGRESSIVE' ? setConfirming(true) : void save(false)
          }
        >
          {action.pending && (
            <Loader2 size={14} aria-hidden="true" className="animate-spin" />
          )}
          {action.pending ? p.saving : p.riskSave}
        </Button>
      </div>

      <Dialog
        open={confirming}
        onOpenChange={setConfirming}
        title={p.riskConfirmTitle}
        description={messageText(copy, 'MSG48')}
        accent="warning"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              {copy.common.cancel}
            </Button>
            <Button onClick={() => void save(true)}>
              {p.riskConfirmAction}
            </Button>
          </>
        }
      />

      <RiskQuestionnaireDialog
        open={questionnaire}
        onOpenChange={setQuestionnaire}
        onUse={setSelected}
      />
    </Card>
  );
}
