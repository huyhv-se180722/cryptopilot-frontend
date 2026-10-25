import { useState, type FormEvent } from 'react';
import { Alert as Banner } from '../../../components/feedback/States';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Dialog } from '../../../components/ui/Dialog';
import { Input } from '../../../components/ui/Input';
import { SectionTitle } from '../../../components/ui/SectionTitle';
import { Switch } from '../../../components/ui/Switch';
import { useCopy } from '../../../hooks/use-copy';
import { useToast } from '../../../hooks/use-toast';
import { formatCopy } from '../../../i18n/copy';
import type { Copy } from '../../../i18n/locales/en';
import { errorText, messageText } from '../../../i18n/messages';
import { problemOf } from '../../../services/api/errors';
import type { SystemSetting } from '../../../types/domain';
import { fractionToPercent, trimDecimal } from '../../../utils/decimal-format';
import { formatInstantLocal } from '../../../utils/instant-format';
import { useSaveSettings } from '../hooks/use-admin-settings';
import {
  changesOf,
  checkDraft,
  groupSettings,
  isRate,
  shownValue,
  type SettingError,
} from './settings-form';

const bound = (value: string) => trimDecimal(value, 0);

function errorWords(copy: Copy, error: SettingError): string {
  const t = copy.adminSettings;
  switch (error.kind) {
    case 'required':
      return messageText(copy, 'MSG01', [], { field: 'value' });
    case 'whole':
      return t.errWhole;
    case 'number':
      return t.errNumber;
    case 'range':
      return error.min !== null && error.max !== null
        ? messageText(copy, 'MSG15', [], {
            field: t.valueField,
            min: bound(error.min),
            max: bound(error.max),
          })
        : t.errRefused;
    case 'order':
      return formatCopy(error.bound === 'atMost' ? t.errAtMost : t.errAtLeast, {
        key: error.other,
        value: bound(error.value),
      });
    case 'server':
      return error.messageCode === 'MSG01'
        ? messageText(copy, 'MSG01', [], { field: 'value' })
        : error.messageCode === 'MSG41'
          ? messageText(copy, 'MSG41')
          : t.errRefused;
  }
}

function rangeHint(copy: Copy, setting: SystemSetting): string | undefined {
  const t = copy.adminSettings;
  const { min, max } = setting;
  if (min !== null && max !== null)
    return formatCopy(t.range, { min: bound(min), max: bound(max) });
  if (min !== null) return formatCopy(t.rangeFrom, { min: bound(min) });
  if (max !== null) return formatCopy(t.rangeTo, { max: bound(max) });
  return undefined;
}

/** The server's refusal of one value, as the row shows it. */
function serverError(error: unknown): SettingError | null {
  const problem = problemOf(error);
  if (!problem) return null;
  if (problem.messageCode === 'MSG41')
    return { kind: 'server', messageCode: 'MSG41' };
  const field = problem.fieldErrors.value;
  return field ? { kind: 'server', messageCode: field } : null;
}

/**
 * SCR-43 System Settings (UC-51): the settings by group, each with its
 * description, range and last change. Changed values wait in a save bar;
 * the confirmation lists them old → new, then each is saved on its own.
 */
export function SettingsForm({
  settings,
}: {
  settings: readonly SystemSetting[];
}) {
  const copy = useCopy();
  const t = copy.adminSettings;
  const { show } = useToast();
  const save = useSaveSettings();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [refused, setRefused] = useState<Record<string, SettingError>>({});
  const [banner, setBanner] = useState<string | null>(null);

  const changes = changesOf(settings, draft);
  const errors = {
    ...refused,
    ...(checked ? checkDraft(settings, draft) : {}),
  };

  const edit = (key: string, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setRefused((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([each]) => each !== key),
      ),
    );
    setBanner(null);
  };
  const discard = () => {
    setDraft({});
    setChecked(false);
    setRefused({});
    setBanner(null);
  };

  function review(event: FormEvent) {
    event.preventDefault();
    setChecked(true);
    if (Object.keys(checkDraft(settings, draft)).length) return;
    if (changes.length) setConfirming(true);
  }

  async function confirm() {
    const values = changes.map((change) => ({
      key: change.setting.key,
      value: change.value,
    }));
    const result = await save.run(values);
    setConfirming(false);
    if (result.status !== 'success') {
      setBanner(
        errorText(copy, result.status === 'error' ? result.error : null),
      );
      return;
    }
    const { saved, refused: failed } = result.data;
    const next: Record<string, SettingError> = {};
    for (const each of failed) {
      const error = serverError(each.error);
      if (error) next[each.key] = error;
    }
    setRefused(next);
    setDraft((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([key]) =>
          failed.some((each) => each.key === key),
        ),
      ),
    );
    if (!failed.length) {
      setChecked(false);
      show({ tone: 'success', message: messageText(copy, 'MSG14') });
      return;
    }
    const unexplained = failed.find((each) => !serverError(each.error));
    setBanner(
      unexplained
        ? errorText(copy, unexplained.error)
        : formatCopy(t.partial, {
            saved: saved.length,
            total: values.length,
          }),
    );
  }

  return (
    <form onSubmit={review} noValidate className="grid gap-4 pb-2">
      {banner && <Banner tone="danger" title={banner} />}
      {groupSettings(settings).map(({ group, settings: rows }) => (
        <Card key={group} padding="none">
          <div className="border-b border-line px-4 py-3 sm:px-5">
            <SectionTitle>{t[`group${group}`]}</SectionTitle>
          </div>
          <ul className="divide-y divide-line">
            {rows.map((setting) => {
              const value = draft[setting.key] ?? shownValue(setting);
              const error = errors[setting.key];
              const words = error ? errorWords(copy, error) : undefined;
              const label = formatCopy(t.valueLabel, { key: setting.key });
              const hint = rangeHint(copy, setting);
              return (
                <li
                  key={setting.key}
                  className="grid gap-3 px-4 py-4 sm:px-5 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] md:gap-6"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-semibold break-all text-fg">
                      {setting.key}
                    </p>
                    <p className="mt-1 text-xs text-fg-2">
                      {setting.description}
                    </p>
                    <p
                      className="mt-1 text-[11px] text-muted-x"
                      title={setting.updatedBy ?? undefined}
                    >
                      {setting.updatedBy === null
                        ? t.seeded
                        : formatCopy(t.changed, {
                            time: formatInstantLocal(setting.updatedAt),
                          })}
                    </p>
                  </div>
                  {setting.valueType === 'BOOLEAN' ? (
                    <Switch
                      label={label}
                      checked={value === 'true'}
                      onChange={(event) =>
                        edit(setting.key, String(event.target.checked))
                      }
                    />
                  ) : (
                    <div>
                      <Input
                        label={t.valueField}
                        aria-label={label}
                        inputMode={
                          setting.valueType === 'INT'
                            ? 'numeric'
                            : setting.valueType === 'DECIMAL'
                              ? 'decimal'
                              : 'text'
                        }
                        autoComplete="off"
                        value={value}
                        onChange={(event) =>
                          edit(setting.key, event.target.value)
                        }
                        error={words}
                        {...(hint ? { hint } : {})}
                      />
                      {isRate(setting.key) && !error && (
                        <p className="mt-1 text-right font-mono text-[11px] text-muted-dim tabular-nums">
                          {formatCopy(t.ratePercent, {
                            value: trimDecimal(
                              fractionToPercent(value.trim() || '0', 6),
                              0,
                            ),
                          })}
                        </p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
      {changes.length > 0 && (
        <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-2 rounded-xl border border-line-strong bg-surface px-4 py-3 shadow-overlay">
          <p className="mr-auto text-xs font-medium text-fg" role="status">
            {changes.length === 1
              ? t.unsavedOne
              : formatCopy(t.unsaved, { count: changes.length })}
          </p>
          <Button variant="ghost" onClick={discard}>
            {t.discard}
          </Button>
          <Button type="submit">{t.review}</Button>
        </div>
      )}
      <Dialog
        open={confirming}
        onOpenChange={(open) => !open && setConfirming(false)}
        title={t.confirmTitle}
        description={t.confirmDescription}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              {copy.common.cancel}
            </Button>
            <Button onClick={() => void confirm()} disabled={save.pending}>
              {t.save}
            </Button>
          </>
        }
      >
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full border-collapse text-xs">
            <caption className="sr-only">{t.confirmCaption}</caption>
            <thead>
              <tr className="border-b border-line bg-page-alt text-[10px] tracking-[0.07em] text-muted-x uppercase">
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  {t.colKey}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t.colFrom}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t.colTo}
                </th>
              </tr>
            </thead>
            <tbody>
              {changes.map((change) => (
                <tr
                  key={change.setting.key}
                  className="border-b border-line last:border-b-0"
                >
                  <th
                    scope="row"
                    className="px-3 py-2 text-left font-mono font-semibold break-all text-fg"
                  >
                    {change.setting.key}
                  </th>
                  <td className="px-3 py-2 text-right font-mono text-fg-2 tabular-nums">
                    {shownValue(change.setting)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-fg tabular-nums">
                    {change.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Dialog>
    </form>
  );
}
