import { useId, useState, type FormEvent } from 'react';
import { Alert as Banner } from '../../../components/feedback/States';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Switch } from '../../../components/ui/Switch';
import { useCopy } from '../../../hooks/use-copy';
import { useToast } from '../../../hooks/use-toast';
import { formatCopy } from '../../../i18n/copy';
import type { Copy } from '../../../i18n/locales/en';
import { errorText, fieldErrorText } from '../../../i18n/messages';
import { problemOf } from '../../../services/api/errors';
import type { PlanTier } from '../../../types/domain';
import {
  PAID_TIERS,
  useCreatePackage,
  useDeletePackage,
  useSaveTierLimits,
  useSetPackageActive,
  useUpdatePackage,
  type AdminPackage,
  type TierLimits,
} from '../hooks/use-admin-packages';
import {
  COUNT_FIELDS,
  FEATURE_FIELDS,
  limitsDraftOf,
  limitsOf,
  newPackageDraft,
  newPackageOf,
  packageChangeOf,
  packageDraftOf,
  type CountField,
  type LimitsDraft,
  type LimitsErrors,
  type PackageDraft,
  type PackageErrors,
  type PackageField,
  featureLabel,
  tierName,
} from './package-form';

function fieldText(
  copy: Copy,
  field: PackageField,
  error: 'required' | 'invalid' | 'taken',
  label: string,
) {
  const t = copy.adminPackages;
  if (error === 'required') return fieldErrorText(copy, 'MSG01', label);
  if (error === 'taken') return t.codeTaken;
  return {
    code: t.errCode,
    name: t.errName,
    price: t.errPrice,
    durationDays: t.errDuration,
  }[field];
}

/**
 * SCR-39 create and edit (UC-42). A new package is a paid one (Pro or
 * Premium) and takes its tier's limits; the code is fixed once created. The
 * FREE package takes a new name only.
 */
export function PackageFormDialog({
  open,
  pkg,
  onClose,
}: {
  open: boolean;
  /** null = a new package. */
  pkg: AdminPackage | null;
  onClose: () => void;
}) {
  const copy = useCopy();
  const t = copy.adminPackages;
  const formId = useId();
  const create = useCreatePackage();
  const update = useUpdatePackage();
  const pending = create.pending || update.pending;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={pkg ? formatCopy(t.editTitle, { name: pkg.name }) : t.createTitle}
      description={
        pkg
          ? pkg.tier === 'FREE'
            ? t.editFreeDescription
            : t.editDescription
          : t.createDescription
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {copy.common.cancel}
          </Button>
          <Button type="submit" form={formId} disabled={pending}>
            {t.save}
          </Button>
        </>
      }
    >
      {open && (
        <PackageForm
          key={pkg ? pkg.id + pkg.updatedAt : 'new'}
          id={formId}
          pkg={pkg}
          create={create}
          update={update}
          onSaved={onClose}
        />
      )}
    </Dialog>
  );
}

function PackageForm({
  id,
  pkg,
  create,
  update,
  onSaved,
}: {
  id: string;
  pkg: AdminPackage | null;
  create: ReturnType<typeof useCreatePackage>;
  update: ReturnType<typeof useUpdatePackage>;
  onSaved: () => void;
}) {
  const copy = useCopy();
  const t = copy.adminPackages;
  const { show } = useToast();
  const [draft, setDraft] = useState<PackageDraft>(() =>
    pkg ? packageDraftOf(pkg) : newPackageDraft(),
  );
  const [shown, setShown] = useState<PackageErrors>({});
  const free = pkg?.tier === 'FREE';
  const mutation = pkg ? update : create;
  const failure =
    mutation.state.status === 'error' ? mutation.state.error : null;
  const problem = problemOf(failure);
  const server: Partial<Record<PackageField, 'invalid' | 'taken'>> = {};
  for (const field of ['code', 'name', 'price', 'durationDays'] as const)
    if (problem?.fieldErrors[field]) server[field] = 'invalid';
  if (problem?.code === 'PACKAGE_CODE_TAKEN') server.code = 'taken';
  const errors = { ...server, ...shown };
  const banner =
    failure &&
    problem?.code !== 'PACKAGE_CODE_TAKEN' &&
    Object.keys(problem?.fieldErrors ?? {}).length === 0
      ? problem?.code === 'FREE_PACKAGE_FIXED'
        ? t.freeFixed
        : errorText(copy, failure)
      : null;

  const change = (patch: Partial<PackageDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setShown({});
    mutation.reset();
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pkg) {
      const checked = packageChangeOf(draft, pkg.tier);
      if (!checked.ok) return setShown(checked.errors);
      const result = await update.run(pkg.id, checked.change);
      if (result.status !== 'success') return;
      show({
        tone: 'success',
        message: formatCopy(t.saved, { name: result.data.name }),
      });
    } else {
      const checked = newPackageOf(draft);
      if (!checked.ok) return setShown(checked.errors);
      const result = await create.run(checked.input);
      if (result.status !== 'success') return;
      show({
        tone: 'success',
        message: formatCopy(t.created, { name: result.data.name }),
      });
    }
    onSaved();
  }

  const error = (field: PackageField, label: string) => {
    const kind = errors[field];
    return kind ? fieldText(copy, field, kind, label) : undefined;
  };
  return (
    <form
      id={id}
      onSubmit={(event) => void submit(event)}
      noValidate
      className="grid gap-4"
    >
      {banner && <Banner tone="danger" title={banner} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={t.codeField}
          value={draft.code}
          disabled={pkg !== null}
          autoComplete="off"
          {...(pkg ? {} : { hint: t.codeHint })}
          error={error('code', t.codeField)}
          onChange={(event) =>
            change({ code: event.target.value.toUpperCase() })
          }
        />
        <Select
          label={t.tierField}
          value={draft.tier}
          disabled={pkg !== null}
          onChange={(event) => change({ tier: event.target.value as PlanTier })}
        >
          {(pkg ? [pkg.tier] : PAID_TIERS).map((tier) => (
            <option key={tier} value={tier}>
              {tierName(copy, tier)}
            </option>
          ))}
        </Select>
      </div>
      <Input
        label={t.nameField}
        value={draft.name}
        autoComplete="off"
        error={error('name', t.nameField)}
        onChange={(event) => change({ name: event.target.value })}
      />
      {!free && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t.priceField}
              value={draft.price}
              inputMode="numeric"
              autoComplete="off"
              error={error('price', t.priceField)}
              onChange={(event) => change({ price: event.target.value })}
            />
            <Input
              label={t.durationField}
              value={draft.durationDays}
              inputMode="numeric"
              autoComplete="off"
              error={error('durationDays', t.durationField)}
              onChange={(event) => change({ durationDays: event.target.value })}
            />
          </div>
          <Switch
            label={t.purchasableField}
            description={t.purchasableHint}
            checked={draft.purchasable}
            onChange={(event) => change({ purchasable: event.target.checked })}
          />
        </>
      )}
    </form>
  );
}

const countLabel = (copy: Copy, field: CountField | 'aiDailyQuota') => {
  const t = copy.adminPackages;
  return {
    activePlanMax: t.planMax,
    watchlistMax: t.watchlistMax,
    activeAlertMax: t.alertMax,
    aiDailyQuota: t.aiQuota,
  }[field];
};

/** SCR-39 limits of one tier (BR-62), saved to every package of the tier. */
export function TierLimitsDialog({
  tier,
  limits,
  onClose,
}: {
  /** null = closed. */
  tier: PlanTier | null;
  limits: TierLimits | null;
  onClose: () => void;
}) {
  const copy = useCopy();
  const t = copy.adminPackages;
  const formId = useId();
  const save = useSaveTierLimits();
  return (
    <Dialog
      open={tier !== null && limits !== null}
      onOpenChange={(next) => !next && onClose()}
      title={
        tier ? formatCopy(t.limitsTitle, { tier: tierName(copy, tier) }) : ''
      }
      description={t.limitsDescription}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {copy.common.cancel}
          </Button>
          <Button type="submit" form={formId} disabled={save.pending}>
            {t.save}
          </Button>
        </>
      }
    >
      {tier && limits && (
        <LimitsForm
          id={formId}
          tier={tier}
          limits={limits}
          save={save}
          onSaved={onClose}
        />
      )}
    </Dialog>
  );
}

function LimitsForm({
  id,
  tier,
  limits,
  save,
  onSaved,
}: {
  id: string;
  tier: PlanTier;
  limits: TierLimits;
  save: ReturnType<typeof useSaveTierLimits>;
  onSaved: () => void;
}) {
  const copy = useCopy();
  const t = copy.adminPackages;
  const { show } = useToast();
  const [draft, setDraft] = useState<LimitsDraft>(() => limitsDraftOf(limits));
  const [shown, setShown] = useState<LimitsErrors>({});
  const failure = save.state.status === 'error' ? save.state.error : null;
  const problem = problemOf(failure);
  const server: LimitsErrors = {};
  for (const field of [...COUNT_FIELDS, 'aiDailyQuota'] as const)
    if (problem?.fieldErrors[field]) server[field] = true;
  const errors = { ...server, ...shown };
  const banner =
    failure && Object.keys(problem?.fieldErrors ?? {}).length === 0
      ? errorText(copy, failure)
      : null;
  const change = (patch: Partial<LimitsDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setShown({});
    save.reset();
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    const checked = limitsOf(draft);
    if (!checked.ok) return setShown(checked.errors);
    const result = await save.run(tier, checked.limits);
    if (result.status !== 'success') return;
    show({
      tone: 'success',
      message: formatCopy(t.limitsSaved, { tier: tierName(copy, tier) }),
    });
    onSaved();
  }

  return (
    <form
      id={id}
      onSubmit={(event) => void submit(event)}
      noValidate
      className="grid gap-5"
    >
      {banner && <Banner tone="danger" title={banner} />}
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-xs font-semibold text-muted-x">
          {t.countsGroup}
        </legend>
        {COUNT_FIELDS.map((field) => (
          <Input
            key={field}
            label={countLabel(copy, field)}
            value={draft[field]}
            inputMode="numeric"
            autoComplete="off"
            placeholder={copy.billing.unlimited}
            hint={t.countHint}
            error={errors[field] ? t.errCount : undefined}
            onChange={(event) => change({ [field]: event.target.value })}
          />
        ))}
        <Input
          label={t.aiQuota}
          value={draft.aiDailyQuota}
          inputMode="numeric"
          autoComplete="off"
          error={errors.aiDailyQuota ? t.errQuota : undefined}
          onChange={(event) => change({ aiDailyQuota: event.target.value })}
        />
      </fieldset>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-xs font-semibold text-muted-x">
          {t.featuresGroup}
        </legend>
        {FEATURE_FIELDS.map((field) => (
          <Switch
            key={field}
            label={featureLabel(copy, field)}
            checked={draft[field]}
            onChange={(event) => change({ [field]: event.target.checked })}
          />
        ))}
      </fieldset>
    </form>
  );
}

/** Confirms taking a package off sale, or deleting one without orders. */
export function PackageConfirmDialog({
  action,
  pkg,
  onClose,
}: {
  action: 'deactivate' | 'delete';
  /** null = closed. */
  pkg: AdminPackage | null;
  onClose: () => void;
}) {
  const copy = useCopy();
  const t = copy.adminPackages;
  const { show } = useToast();
  const setActive = useSetPackageActive();
  const remove = useDeletePackage();
  const mutation = action === 'delete' ? remove : setActive;
  const failure =
    mutation.state.status === 'error' ? mutation.state.error : null;
  const problem = problemOf(failure);
  const banner = failure
    ? problem?.code === 'PACKAGE_IN_USE'
      ? t.inUse
      : problem?.code === 'FREE_PACKAGE_FIXED'
        ? t.freeFixed
        : errorText(copy, failure)
    : null;
  const name = pkg?.name ?? '';
  const close = () => {
    setActive.reset();
    remove.reset();
    onClose();
  };

  async function confirm() {
    if (!pkg) return;
    const result =
      action === 'delete'
        ? await remove.run(pkg.id)
        : await setActive.run(pkg.id, false);
    if (result.status !== 'success') return;
    show({
      tone: 'success',
      message: formatCopy(action === 'delete' ? t.deleted : t.deactivated, {
        name,
      }),
    });
    close();
  }

  return (
    <Dialog
      open={pkg !== null}
      onOpenChange={(next) => !next && close()}
      title={formatCopy(
        action === 'delete' ? t.confirmDeleteTitle : t.confirmDeactivateTitle,
        { name },
      )}
      description={
        action === 'delete' ? t.confirmDeleteBody : t.confirmDeactivateBody
      }
      size="sm"
      accent="negative"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            {copy.common.cancel}
          </Button>
          <Button
            variant="danger"
            disabled={mutation.pending}
            onClick={() => void confirm()}
          >
            {action === 'delete' ? t.remove : t.deactivate}
          </Button>
        </>
      }
    >
      {banner && <Banner tone="danger" title={banner} />}
    </Dialog>
  );
}
