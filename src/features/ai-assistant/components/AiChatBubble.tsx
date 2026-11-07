import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { Maximize2, SquarePen, X } from 'lucide-react';
import { useCopy } from '../../../hooks/use-copy';
import { useToast } from '../../../hooks/use-toast';
import { I18nProvider } from '../../../i18n/I18nProvider';
import { classNames } from '../../../utils/class-names';
import { aiErrorText } from '../ai-assistant-errors';
import {
  useAiAnswerPush,
  useAiMessages,
  useAiQuota,
  useAskQuestion,
  useStartConversation,
} from '../hooks/use-ai-assistant';
import { AiBotIcon } from './AiBotIcon';
import { ChatPanel, SuggestionTag, type AskSuggestion } from './ChatPanel';

/** Fired by SCR-29 to open the floating chat for a general question. */
export const OPEN_AI_BUBBLE_EVENT = 'cryptopilot:open-ai-bubble';

const POSITION_KEY = 'cryptopilot.aiBubble.position';
const CONVERSATION_KEY = 'cryptopilot.aiBubble.conversation';
const LAUNCHER = 56;
const MARGIN = 8;
const PANEL_WIDTH = 400;
const PANEL_HEIGHT = 600;
/** A press that moves less than this is a click, not a drag. */
const DRAG_THRESHOLD = 5;
const SMALL_SCREEN = '(max-width: 639px)';

/** Where the launcher sits, from the right and bottom edges of the window. */
interface Position {
  right: number;
  bottom: number;
}

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function store(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // The chat still works; it only forgets the place or the conversation.
  }
}

function clamp(position: Position): Position {
  const maxRight = Math.max(MARGIN, window.innerWidth - LAUNCHER - MARGIN);
  const maxBottom = Math.max(MARGIN, window.innerHeight - LAUNCHER - MARGIN);
  return {
    right: Math.min(Math.max(position.right, MARGIN), maxRight),
    bottom: Math.min(Math.max(position.bottom, MARGIN), maxBottom),
  };
}

function storedPosition(): Position | null {
  const raw = readStored(POSITION_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Position>;
    return typeof value.right === 'number' && typeof value.bottom === 'number'
      ? clamp({ right: value.right, bottom: value.bottom })
      : null;
  } catch {
    return null;
  }
}

function useSmallScreen() {
  const [small, setSmall] = useState(
    () =>
      typeof window.matchMedia === 'function' &&
      window.matchMedia(SMALL_SCREEN).matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(SMALL_SCREEN);
    const onChange = () => setSmall(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return small;
}

/** The panel opens beside the launcher, towards the middle of the window. */
function panelStyle(launcher: DOMRect): CSSProperties {
  const style: CSSProperties = { width: PANEL_WIDTH };
  if (launcher.left + launcher.width / 2 > window.innerWidth / 2)
    style.right = Math.max(MARGIN, window.innerWidth - launcher.right);
  else style.left = Math.max(MARGIN, launcher.left);
  if (launcher.top + launcher.height / 2 > window.innerHeight / 2) {
    const bottom = window.innerHeight - launcher.top + MARGIN;
    style.bottom = bottom;
    style.height = Math.min(PANEL_HEIGHT, window.innerHeight - bottom - MARGIN);
  } else {
    const top = launcher.bottom + MARGIN;
    style.top = top;
    style.height = Math.min(PANEL_HEIGHT, window.innerHeight - top - MARGIN);
  }
  return style;
}

/**
 * The floating chat for general trading questions (SRS 3.9.1): it sends no
 * market data, plan or performance, those are asked on SCR-29. It is on
 * every Trader screen; the launcher can be dragged anywhere and keeps its
 * place. It keeps one conversation (shown on SCR-29 too) until "new
 * question". Quota, upgrade prompt and answers work as on SCR-29.
 */
export function AiChatBubble() {
  return (
    <I18nProvider locale="vi">
      <FloatingChat />
    </I18nProvider>
  );
}

function FloatingChat() {
  const t = useCopy().aiAssistant;
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(storedPosition);
  const [panel, setPanel] = useState<CSSProperties | null>(null);
  const small = useSmallScreen();
  const launcher = useRef<HTMLButtonElement>(null);
  const press = useRef<{ x: number; y: number; from: Position } | null>(null);
  const dragged = useRef(false);

  const place = useCallback(() => {
    const rect = launcher.current?.getBoundingClientRect();
    if (rect) setPanel(panelStyle(rect));
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, position, small, place]);

  useEffect(() => {
    const onResize = () => {
      setPosition((current) => (current ? clamp(current) : current));
      place();
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('resize', onResize);
    window.addEventListener(OPEN_AI_BUBBLE_EVENT, onOpen);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener(OPEN_AI_BUBBLE_EVENT, onOpen);
    };
  }, [place]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    press.current = {
      x: event.clientX,
      y: event.clientY,
      from: {
        right: window.innerWidth - rect.right,
        bottom: window.innerHeight - rect.bottom,
      },
    };
    dragged.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const start = press.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!dragged.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    dragged.current = true;
    setPosition(
      clamp({ right: start.from.right - dx, bottom: start.from.bottom - dy }),
    );
  }

  function onPointerUp(event: PointerEvent<HTMLButtonElement>) {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    press.current = null;
    if (dragged.current && position)
      store(POSITION_KEY, JSON.stringify(position));
  }

  function onClick() {
    // The click that ends a drag does not open the chat.
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    setOpen((current) => !current);
  }

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label={t.bubbleTitle}
          style={small ? undefined : (panel ?? undefined)}
          className={classNames(
            'fixed z-40 flex flex-col overflow-hidden rounded-[20px] border border-line-strong bg-surface shadow-2xl',
            small && 'inset-x-2 top-16 bottom-24',
          )}
        >
          <ChatBody onClose={() => setOpen(false)} />
        </div>
      )}
      <button
        ref={launcher}
        type="button"
        aria-label={open ? t.bubbleClose : t.bubbleOpen}
        aria-expanded={open}
        title={t.bubbleOpen}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={onClick}
        style={position ?? undefined}
        className={classNames(
          'fixed z-40 inline-flex touch-none items-center justify-center rounded-full bg-primary text-white shadow-[0_0_0_6px_rgba(37,99,235,0.18),0_10px_24px_rgba(37,99,235,0.35)] transition-transform select-none hover:scale-105 active:cursor-grabbing',
          'size-14 cursor-grab',
          !position && 'right-4 bottom-24 lg:right-6 lg:bottom-6',
          open && small && 'hidden',
        )}
      >
        {open ? <X size={24} aria-hidden="true" /> : <AiBotIcon size={36} />}
      </button>
    </>
  );
}

function ChatBody({ onClose }: { onClose: () => void }) {
  const copy = useCopy();
  const t = copy.aiAssistant;
  const { show } = useToast();
  const navigate = useNavigate();
  const [conversationId, setConversationId] = useState(() =>
    readStored(CONVERSATION_KEY),
  );
  useAiAnswerPush();
  const quota = useAiQuota();
  const messages = useAiMessages(conversationId);
  const start = useStartConversation();
  const ask = useAskQuestion();

  // A conversation deleted on SCR-29 (or of another account) counts as
  // none: the next question starts a new one.
  const current = messages.isError ? null : conversationId;

  function remember(id: string | null) {
    store(CONVERSATION_KEY, id);
    setConversationId(id);
  }

  async function askQuestion(text: string): Promise<boolean> {
    let id = current;
    if (id === null) {
      const started = await start.run('GENERAL');
      if (started.status === 'error')
        show({ tone: 'error', message: aiErrorText(copy, started.error) });
      if (started.status !== 'success') return false;
      id = started.data.id;
      remember(id);
    }
    // A general question: no pair, plan or performance.
    const result = await ask.run(id, { question: text });
    if (result.status === 'error') {
      show({ tone: 'error', message: aiErrorText(copy, result.error) });
      return false;
    }
    return result.status === 'success';
  }

  const suggestions: AskSuggestion[] = [
    {
      key: 'rsi',
      text: t.suggestionRsi,
      icon: (
        <SuggestionTag label="RSI" className="bg-primary-soft text-primary" />
      ),
    },
    {
      key: 'dca',
      text: t.suggestionDca,
      icon: (
        <SuggestionTag label="DCA" className="bg-accent-soft text-accent" />
      ),
    },
    {
      key: 'stop-loss',
      text: t.suggestionStopLoss,
      icon: (
        <SuggestionTag label="SL" className="bg-negative-soft text-negative" />
      ),
    },
  ];
  const headerButton =
    'inline-flex size-8 items-center justify-center rounded-[9px] text-[#d9e0ea] hover:bg-white/10 hover:text-white pointer-coarse:size-11';

  return (
    <>
      <header className="flex items-center gap-2.5 bg-[#17212f] py-3 pr-2.5 pl-3.5 text-white">
        <span
          aria-hidden="true"
          className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-primary"
        >
          <AiBotIcon size={26} />
          <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-[#17212f] bg-[#10b981]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 text-sm font-semibold">{t.bubbleTitle}</p>
          <p className="m-0 text-[11px] leading-snug text-[#b8c4d4]">
            {t.bubbleSubtitle}
          </p>
        </div>
        <button
          type="button"
          aria-label={t.bubbleNew}
          title={t.bubbleNew}
          onClick={() => remember(null)}
          className={headerButton}
        >
          <SquarePen size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={t.bubbleExpand}
          title={t.bubbleExpand}
          onClick={() => {
            onClose();
            void navigate('/ai/market');
          }}
          className={headerButton}
        >
          <Maximize2 size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={t.bubbleClose}
          title={t.bubbleClose}
          onClick={onClose}
          className={headerButton}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">
        <ChatPanel
          compact
          messages={current === null ? [] : (messages.data?.items ?? [])}
          loading={messages.isPending && current !== null}
          quota={quota.data}
          asking={ask.pending || start.pending}
          placeholder={t.placeholderGeneral}
          attachments={[]}
          welcome={{
            title: t.welcomeGeneralTitle,
            body: t.welcomeGeneralBody,
          }}
          suggestions={suggestions}
          onAsk={askQuestion}
        />
      </div>
    </>
  );
}
