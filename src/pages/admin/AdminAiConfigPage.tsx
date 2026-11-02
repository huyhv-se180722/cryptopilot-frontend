import { useState } from 'react';
import { Bot, Eye, Plus } from 'lucide-react';
import { EmptyState, ErrorState } from '../../components/feedback/States';
import { PageHeader } from '../../components/layout/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Skeleton } from '../../components/ui/Skeleton';
import { Table, type Column } from '../../components/ui/Table';
import { AiConfigurationDialog } from '../../features/ai-admin/components/AiConfigurationDialog';
import {
  useActivateAiConfiguration,
  useAiConfigurations,
} from '../../features/ai-admin/hooks/use-ai-admin';
import { useCopy } from '../../hooks/use-copy';
import { useToast } from '../../hooks/use-toast';
import { formatCopy } from '../../i18n/copy';
import { errorText } from '../../i18n/messages';
import type { AiConfiguration } from '../../types/domain';
import { formatInstantLocal } from '../../utils/instant-format';

/**
 * SCR-42 AI Configuration (SRS 3.11.7, UC-50): the versions of the model,
 * system prompt, temperature, output tokens and disclaimer, the newest
 * first. A new version starts from the active one and is saved inactive;
 * activating it deactivates the previous, which stays as history. Every
 * change is audited by the backend (BR-57). No Figma frame: the layout
 * follows SCR-41.
 */
export function AdminAiConfigPage() {
  const copy = useCopy();
  const t = copy.aiAdmin;
  const { show } = useToast();
  const versions = useAiConfigurations();
  const activation = useActivateAiConfiguration();
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<AiConfiguration | null>(null);
  const [activating, setActivating] = useState<AiConfiguration | null>(null);
  const active = versions.data?.find((version) => version.active) ?? null;

  async function confirmActivate() {
    if (!activating) return;
    const result = await activation.run(activating.id);
    setActivating(null);
    if (result.status === 'success')
      show({ tone: 'success', message: t.activated });
    else if (result.status === 'error')
      show({ tone: 'error', message: errorText(copy, result.error) });
  }

  const columns: Column<AiConfiguration>[] = [
    {
      id: 'model',
      header: t.colModel,
      render: (v) => (
        <span className="font-mono text-xs text-fg">{v.modelName}</span>
      ),
    },
    {
      id: 'temperature',
      header: t.colTemperature,
      numeric: true,
      render: (v) => v.temperature,
    },
    {
      id: 'tokens',
      header: t.colTokens,
      numeric: true,
      render: (v) => v.maxOutputTokens,
    },
    {
      id: 'created',
      header: t.colCreated,
      render: (v) => formatInstantLocal(v.createdAt),
    },
    {
      id: 'status',
      header: t.colStatus,
      render: (v) => (
        <Badge tone={v.active ? 'success' : 'neutral'} withDot>
          {v.active ? t.active : t.inactive}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: t.colActions,
      render: (v) => (
        <span className="flex items-center gap-1">
          <Button
            size="sm"
            variant="secondary"
            aria-label={t.view + ' ' + v.modelName}
            onClick={() => setViewing(v)}
          >
            <Eye size={14} aria-hidden="true" />
            {t.view}
          </Button>
          {!v.active && (
            <Button
              size="sm"
              aria-label={t.activate + ' ' + v.modelName}
              onClick={() => setActivating(v)}
            >
              {t.activate}
            </Button>
          )}
        </span>
      ),
    },
  ];

  const body = versions.isPending ? (
    <div className="grid gap-2">
      {[0, 1].map((k) => (
        <Skeleton key={k} className="h-12 w-full" />
      ))}
    </div>
  ) : versions.isError ? (
    <ErrorState
      message={errorText(copy, versions.error)}
      onRetry={() => void versions.refetch()}
    />
  ) : versions.data.length === 0 ? (
    <EmptyState icon={Bot} title={t.empty} />
  ) : (
    <Table
      caption={t.caption}
      columns={columns}
      rows={versions.data}
      rowKey={(v) => v.id}
    />
  );

  return (
    <div className="w-full">
      <PageHeader
        size="sm"
        title={t.title}
        description={t.subtitle}
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus size={14} aria-hidden="true" />
            {t.addVersion}
          </Button>
        }
      />
      {body}
      {creating && (
        <AiConfigurationDialog
          open
          base={active}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            show({ tone: 'success', message: t.created });
          }}
        />
      )}
      <Dialog
        open={viewing !== null}
        onOpenChange={(next) => !next && setViewing(null)}
        title={formatCopy(t.viewTitle, { model: viewing?.modelName ?? '' })}
        size="lg"
        footer={
          <Button variant="secondary" onClick={() => setViewing(null)}>
            {t.close}
          </Button>
        }
      >
        {viewing && (
          <dl className="m-0 grid gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted">{t.systemPrompt}</dt>
              <dd className="m-0 mt-1 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-md bg-page-alt p-2 font-mono text-xs text-fg">
                {viewing.systemPrompt}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{t.disclaimerField}</dt>
              <dd className="m-0 mt-1 text-fg">{viewing.disclaimer}</dd>
            </div>
          </dl>
        )}
      </Dialog>
      <Dialog
        open={activating !== null}
        onOpenChange={(next) => !next && setActivating(null)}
        title={t.activateTitle}
        description={t.activateBody}
        size="sm"
        accent="warning"
        footer={
          <>
            <Button variant="secondary" onClick={() => setActivating(null)}>
              {t.cancel}
            </Button>
            <Button
              disabled={activation.pending}
              onClick={() => void confirmActivate()}
            >
              {t.activate}
            </Button>
          </>
        }
      />
    </div>
  );
}
