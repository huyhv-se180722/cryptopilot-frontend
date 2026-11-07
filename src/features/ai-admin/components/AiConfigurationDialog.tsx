import { useId, useState } from 'react';
import { FormNotice } from '../../../components/feedback/FormNotice';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Input } from '../../../components/ui/Input';
import {
  fieldControlClass,
  fieldErrorClass,
  fieldHintClass,
  fieldLabelClass,
} from '../../../components/ui/field-styles';
import { useCopy } from '../../../hooks/use-copy';
import { errorText } from '../../../i18n/messages';
import type {
  AiConfiguration,
  AiConfigurationDraft,
} from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import { useCreateAiConfiguration } from '../hooks/use-ai-admin';

const MODEL = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const TEMPERATURE = /^(0(\.\d{1,2})?|1(\.0{1,2})?)$/;
const PROMPT_MAX = 20_000;
const DISCLAIMER_MAX = 500;

interface Form {
  modelName: string;
  systemPrompt: string;
  temperature: string;
  maxOutputTokens: string;
  disclaimer: string;
}

type Errors = Partial<Record<keyof Form, string>>;

function fromVersion(version: AiConfiguration | null): Form {
  return {
    modelName: version?.modelName ?? '',
    systemPrompt: version?.systemPrompt ?? '',
    temperature: version?.temperature ?? '0.30',
    maxOutputTokens: String(version?.maxOutputTokens ?? 1024),
    disclaimer: version?.disclaimer ?? '',
  };
}

/** The checks of SRS 3.11.7, as the backend applies them. */
function check(form: Form, t: ReturnType<typeof useCopy>['aiAdmin']): Errors {
  const errors: Errors = {};
  const tokens = Number(form.maxOutputTokens);
  if (form.modelName.trim() === '') errors.modelName = t.required;
  else if (
    form.modelName.trim().length > 100 ||
    !MODEL.test(form.modelName.trim())
  )
    errors.modelName = t.badModel;
  if (form.systemPrompt.trim() === '') errors.systemPrompt = t.required;
  else if (form.systemPrompt.length > PROMPT_MAX)
    errors.systemPrompt = t.outOfRange;
  if (!TEMPERATURE.test(form.temperature.trim()))
    errors.temperature = t.outOfRange;
  if (!Number.isInteger(tokens) || tokens < 256 || tokens > 4096)
    errors.maxOutputTokens = t.outOfRange;
  if (form.disclaimer.trim() === '') errors.disclaimer = t.required;
  else if (form.disclaimer.length > DISCLAIMER_MAX)
    errors.disclaimer = t.outOfRange;
  return errors;
}

/**
 * A new version of the AI configuration (SCR-42, UC-50), started from the
 * active one so a change is one edit. It is saved inactive. The page
 * mounts it for each opening, so every form starts afresh.
 */
export function AiConfigurationDialog({
  open,
  base,
  onClose,
  onSaved,
}: {
  open: boolean;
  base: AiConfiguration | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const copy = useCopy();
  const t = copy.aiAdmin;
  const create = useCreateAiConfiguration();
  const [form, setForm] = useState<Form>(() => fromVersion(base));
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const promptId = useId();

  const set = (field: keyof Form) => (value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  async function save() {
    const found = check(form, t);
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    const draft: AiConfigurationDraft = {
      modelName: form.modelName.trim(),
      systemPrompt: form.systemPrompt.trim(),
      temperature: form.temperature.trim(),
      maxOutputTokens: Number(form.maxOutputTokens),
      disclaimer: form.disclaimer.trim(),
    };
    const result = await create.run(draft);
    if (result.status === 'success') onSaved();
    else if (result.status === 'error')
      setFailure(errorText(copy, result.error));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={t.formTitle}
      description={t.formHint}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button disabled={create.pending} onClick={() => void save()}>
            {t.save}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        {failure && <FormNotice tone="error">{failure}</FormNotice>}
        <Input
          label={t.modelName}
          hint={t.modelHint}
          value={form.modelName}
          error={errors.modelName}
          onChange={(event) => set('modelName')(event.target.value)}
        />
        <div>
          <label htmlFor={promptId} className={fieldLabelClass}>
            {t.systemPrompt}
          </label>
          <textarea
            id={promptId}
            rows={10}
            value={form.systemPrompt}
            aria-invalid={errors.systemPrompt ? true : undefined}
            onChange={(event) => set('systemPrompt')(event.target.value)}
            className={classNames(
              fieldControlClass,
              'resize-y font-mono text-xs',
            )}
          />
          <span
            className={errors.systemPrompt ? fieldErrorClass : fieldHintClass}
          >
            {errors.systemPrompt ?? form.systemPrompt.length + '/' + PROMPT_MAX}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label={t.temperature}
            inputMode="decimal"
            value={form.temperature}
            error={errors.temperature}
            onChange={(event) => set('temperature')(event.target.value)}
          />
          <Input
            label={t.maxOutputTokens}
            inputMode="numeric"
            value={form.maxOutputTokens}
            error={errors.maxOutputTokens}
            onChange={(event) => set('maxOutputTokens')(event.target.value)}
          />
        </div>
        <Input
          label={t.disclaimerField}
          hint={t.disclaimerHint}
          value={form.disclaimer}
          error={errors.disclaimer}
          onChange={(event) => set('disclaimer')(event.target.value)}
        />
      </div>
    </Dialog>
  );
}
