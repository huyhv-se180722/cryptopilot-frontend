import { Check, Circle } from 'lucide-react';
import { useCopy } from '../../../hooks/use-copy';
import { classNames } from '../../../utils/class-names';
import {
  PASSWORD_RULES,
  passwordRuleResults,
  type PasswordRule,
} from '../password-policy';

const meterTone = [
  'bg-negative',
  'bg-negative',
  'bg-warning',
  'bg-positive',
  'bg-accent',
] as const;
const labelTone = [
  'text-negative',
  'text-negative',
  'text-warning',
  'text-positive',
  'text-accent',
] as const;

/**
 * Figma register strength meter, driven by the BR-02 rules instead of a
 * heuristic, plus a live checklist so the requirement is explicit.
 */
export function PasswordRules({ password }: { password: string }) {
  const copy = useCopy();
  if (!password) return null;
  const results = passwordRuleResults(password);
  const met = PASSWORD_RULES.filter((rule) => results[rule]).length;
  const labels: Record<PasswordRule, string> = {
    length: copy.auth.ruleLength,
    lowercase: copy.auth.ruleLowercase,
    uppercase: copy.auth.ruleUppercase,
    digit: copy.auth.ruleDigit,
  };
  const strength = [
    copy.auth.strengthWeak,
    copy.auth.strengthWeak,
    copy.auth.strengthFair,
    copy.auth.strengthGood,
    copy.auth.strengthStrong,
  ][met];
  return (
    <div className="mt-2" aria-live="polite">
      <div className="mb-1 flex gap-1" aria-hidden="true">
        {PASSWORD_RULES.map((rule, index) => (
          <span
            key={rule}
            className={classNames(
              'h-1 flex-1 rounded-full',
              index < met ? meterTone[met] : 'bg-raised',
            )}
          />
        ))}
      </div>
      <div className={classNames('text-[11px]', labelTone[met])}>
        {strength}
      </div>
      <ul
        aria-label={copy.auth.rulesTitle}
        className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5"
      >
        {PASSWORD_RULES.map((rule) => (
          <li
            key={rule}
            className={classNames(
              'flex items-center gap-1.5 text-[11px]',
              results[rule] ? 'text-positive' : 'text-muted-dim',
            )}
          >
            {results[rule] ? (
              <Check size={11} aria-hidden="true" />
            ) : (
              <Circle size={9} aria-hidden="true" />
            )}
            <span>{labels[rule]}</span>
            <span className="sr-only">{results[rule] ? '✓' : '✗'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
