import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { ErrorState, Loading } from '../../../components/feedback/States';
import { useCopy } from '../../../hooks/use-copy';
import { errorText } from '../../../i18n/messages';
import { formatCopy } from '../../../i18n/copy';
import type { RiskProfile, RiskQuestion } from '../../../types/domain';
import { FormNotice } from '../../auth/components/FormNotice';
import {
  useRiskQuestionnaire,
  useSuggestRiskProfile,
} from '../hooks/use-profile';

const GROUPS: readonly RiskQuestion['group'][] = ['CAPACITY', 'ATTITUDE'];

/**
 * Risk questionnaire v1 (BR-67): the backend scores the answers and
 * suggests a profile; nothing is saved here (SRS 3.2.5).
 */
export function RiskQuestionnaireDialog({
  open,
  onOpenChange,
  onUse,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUse: (profile: RiskProfile) => void;
}) {
  const copy = useCopy();
  const p = copy.profile;
  const { state, reload } = useRiskQuestionnaire(open);
  const suggest = useSuggestRiskProfile();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const questions = state.status === 'success' ? state.data : [];
  const complete =
    questions.length > 0 && questions.every((q) => answers[q.code]);
  const result = suggest.state.status === 'success' ? suggest.state.data : null;

  function close(next: boolean) {
    if (!next) {
      setAnswers({});
      suggest.reset();
    }
    onOpenChange(next);
  }

  let body;
  if (state.status === 'loading') body = <Loading />;
  else if (state.status === 'error')
    body = (
      <ErrorState message={errorText(copy, state.error)} onRetry={reload} />
    );
  else if (result)
    body = (
      <div className="rounded-lg border border-primary-line bg-primary-soft p-4">
        <p className="text-[11px] text-muted-dim">{p.suggestionTitle}</p>
        <p className="mt-1 text-lg font-semibold text-primary">
          {p[`risk${result.suggestedProfile}`]}
        </p>
        <p className="mt-1 font-mono text-xs text-muted">
          {formatCopy(p.suggestionScores, {
            capacity: result.capacityScore,
            attitude: result.attitudeScore,
          })}
        </p>
        <p className="mt-3 text-xs text-fg-2">{p.suggestionNote}</p>
      </div>
    );
  else
    body = (
      <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
        {suggest.state.status === 'error' && (
          <FormNotice tone="error">
            {errorText(copy, suggest.state.error)}
          </FormNotice>
        )}
        {GROUPS.map((group) => (
          <section key={group}>
            <h3 className="mb-2 text-[10px] font-semibold tracking-widest text-muted-x uppercase">
              {p[`group${group}`]}
            </h3>
            {questions
              .filter((q) => q.group === group)
              .map((q) => (
                <fieldset key={q.code} className="mb-4">
                  <legend className="mb-2 text-sm text-fg-2">{q.text}</legend>
                  <div className="space-y-1.5">
                    {q.options.map((option) => (
                      <label
                        key={option.code}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-line px-3 py-2 text-xs text-muted has-checked:border-primary has-checked:bg-primary-soft has-checked:text-fg"
                      >
                        <input
                          type="radio"
                          name={q.code}
                          value={option.code}
                          checked={answers[q.code] === option.code}
                          disabled={suggest.pending}
                          onChange={() =>
                            setAnswers((a) => ({ ...a, [q.code]: option.code }))
                          }
                          className="accent-(--cp-primary)"
                        />
                        {option.text}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
          </section>
        ))}
      </div>
    );

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={p.questionnaireTitle}
      description={p.questionnaireIntro}
      size="lg"
      footer={
        result ? (
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setAnswers({});
                suggest.reset();
              }}
            >
              {p.questionnaireRetake}
            </Button>
            <Button
              onClick={() => {
                onUse(result.suggestedProfile);
                close(false);
              }}
            >
              {p.suggestionUse}
            </Button>
          </>
        ) : state.status === 'success' ? (
          <>
            {!complete && (
              <span className="mr-auto text-[11px] text-muted-dim">
                {p.questionnaireAnswerAll}
              </span>
            )}
            <Button
              disabled={!complete || suggest.pending}
              onClick={() => void suggest.run(answers)}
            >
              {suggest.pending && (
                <Loader2
                  size={14}
                  aria-hidden="true"
                  className="animate-spin"
                />
              )}
              {p.questionnaireSubmit}
            </Button>
          </>
        ) : undefined
      }
    >
      {body}
    </Dialog>
  );
}
