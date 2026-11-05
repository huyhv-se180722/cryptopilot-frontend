// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminAiConfigPage } from '../../pages/admin/AdminAiConfigPage';
import { AiAssistantPage } from '../../pages/trader/AiAssistantPage';
import type {
  AiAdminService,
  AiService,
  MarketService,
  TradingPlanService,
} from '../../services/api/contracts';
import type {
  AiAnswerPush,
  AiConfiguration,
  AiConfigurationDraft,
  AiMessage,
  AiQuestion,
  AiQuota,
  MarketPair,
  Session,
} from '../../types/domain';
import { fakeAuth, page, renderRoutes } from '../../test/render';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

const trader = fakeAuth({
  restoreSession: async () => ({
    user: {
      id: 'test-trader',
      email: 'trader@example.test',
      displayName: 'Test Trader',
      role: 'Trader',
      status: 'active',
    },
    entitlements: 'unknown',
  }),
});
const admin: Session = {
  user: {
    id: 'test-admin',
    email: 'admin@example.test',
    displayName: 'Test Admin',
    role: 'Admin',
    status: 'active',
  },
  entitlements: 'unknown',
};

const AT = '2026-11-02T03:00:00Z';
const PRO: AiQuota = {
  limit: 30,
  used: 2,
  remaining: 28,
  resetsAt: '2026-11-02T17:00:00Z',
  canAsk: true,
  performanceContext: false,
};
const BTC = {
  pairId: 'p-btc',
  symbol: 'BTCUSDT',
  market: 'spot',
} as MarketPair;

function message(
  id: string,
  role: AiMessage['role'],
  content: string,
  status: AiMessage['status'] = 'COMPLETED',
): AiMessage {
  return { id, conversationId: 'c1', role, content, status, createdAt: AT };
}

function aiService(
  quota: AiQuota,
  messages: { items: AiMessage[] },
  overrides: Partial<AiService> = {},
): AiService & { push: (value: AiAnswerPush) => void } {
  let listener: ((value: AiAnswerPush) => void) | null = null;
  return {
    conversations: async () => ({
      items: [
        {
          id: 'c1',
          title: 'RSI của BTC',
          pairId: null,
          createdAt: AT,
          updatedAt: AT,
        },
      ],
      page: 1,
      pageSize: 50,
      total: 1,
    }),
    start: async () => {
      throw new Error('not used');
    },
    rename: async () => {
      throw new Error('not used');
    },
    remove: async () => undefined,
    messages: async () => ({
      items: [...messages.items],
      page: 1,
      pageSize: 100,
      total: messages.items.length,
    }),
    ask: async () => {
      throw new Error('not used');
    },
    quota: async () => quota,
    subscribeAnswers: (next) => {
      listener = next;
      return () => {
        listener = null;
      };
    },
    push: (value) => listener?.(value),
    ...overrides,
  };
}

const market = { listPairs: async () => [BTC] } as unknown as MarketService;
const tradingPlan = {
  list: async () => ({ items: [], page: 1, pageSize: 50, total: 0 }),
} as unknown as TradingPlanService;

async function openAssistant(ai: AiService, path = '/ai') {
  return renderRoutes([page('/ai', <AiAssistantPage />)], path, trader, {
    ai,
    market,
    tradingPlan,
  });
}

describe('AI assistant screen (SCR-29, UC-35, UC-36, T-076)', () => {
  it('opens the latest conversation, oldest message first, with the disclaimer on the answer', async () => {
    await openAssistant(
      aiService(PRO, {
        items: [
          message(
            'a1',
            'ASSISTANT',
            'RSI trên 70 là **vùng quá mua**.\n- Động lượng mạnh\n\nThông tin chỉ mang tính tham khảo.',
          ),
          message('q1', 'USER', 'RSI 72 nghĩa là gì?'),
        ],
      }),
    );

    const question = await screen.findByText('RSI 72 nghĩa là gì?');
    const bold = screen.getByText('vùng quá mua');
    expect(bold.tagName).toBe('STRONG');
    expect(
      question.compareDocumentPosition(bold) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText('Động lượng mạnh').tagName).toBe('LI');
    expect(screen.getByText('Thông tin chỉ mang tính tham khảo.')).toBeTruthy();
    expect(screen.getByText(/Còn 28\/30 câu hỏi hôm nay/)).toBeTruthy();
  });

  it('asks about the chosen pair, shows the typing line, then the pushed answer', async () => {
    const user = userEvent.setup();
    const thread = { items: [] as AiMessage[] };
    const asked: AiQuestion[] = [];
    let quota = PRO;
    const ai = aiService(PRO, thread, {
      quota: async () => quota,
      ask: async (_id, question) => {
        asked.push(question);
        quota = { ...PRO, used: 3, remaining: 27 };
        thread.items = [message('q1', 'USER', question.question, 'PENDING')];
        return {
          question: thread.items[0] as AiMessage,
          quota: { ...PRO, used: 3, remaining: 27 },
        };
      },
    });
    await openAssistant(ai, '/ai?symbol=BTCUSDT&market=spot');

    const box = await screen.findByPlaceholderText(/Hỏi về cặp coin/);
    await waitFor(() =>
      expect(
        (screen.getByLabelText('Cặp coin') as HTMLSelectElement).value,
      ).toBe('spot:p-btc'),
    );
    await user.selectOptions(screen.getByLabelText('Khung thời gian'), '4h');
    await user.type(box, 'Setup score nói gì?');
    await user.click(screen.getByRole('button', { name: /Gửi/ }));

    expect(asked).toEqual([
      {
        question: 'Setup score nói gì?',
        pairId: 'p-btc',
        market: 'spot',
        timeframe: '4h',
      },
    ]);
    expect(await screen.findByText('Trợ lý đang trả lời…')).toBeTruthy();
    expect(screen.getByText(/Còn 27\/30/)).toBeTruthy();

    thread.items = [
      message('a1', 'ASSISTANT', 'Điểm 72 cho thấy xu hướng tốt.'),
      message('q1', 'USER', 'Setup score nói gì?'),
    ];
    ai.push({
      conversationId: 'c1',
      questionId: 'q1',
      status: 'COMPLETED',
      answer: thread.items[0] ?? null,
    });

    expect(
      await screen.findByText('Điểm 72 cho thấy xu hướng tốt.'),
    ).toBeTruthy();
    await waitFor(() =>
      expect(screen.queryByText('Trợ lý đang trả lời…')).toBeNull(),
    );
  });

  it('without a conversation the box is open and the first question starts one', async () => {
    const user = userEvent.setup();
    const started: (string | null)[] = [];
    const asked: [string, AiQuestion][] = [];
    const ai = aiService(
      PRO,
      { items: [] },
      {
        conversations: async () => ({
          items: [],
          page: 1,
          pageSize: 50,
          total: 0,
        }),
        start: async (pairId) => {
          started.push(pairId);
          return {
            id: 'c9',
            title: 'Mới',
            pairId,
            createdAt: AT,
            updatedAt: AT,
          };
        },
        ask: async (id, question) => {
          asked.push([id, question]);
          const pending = message('q1', 'USER', question.question, 'PENDING');
          return { question: pending, quota: PRO };
        },
      },
    );
    await openAssistant(ai);

    const box = (await screen.findByPlaceholderText(
      /Hỏi về cặp coin/,
    )) as HTMLTextAreaElement;
    await waitFor(() => expect(box.disabled).toBe(false));
    expect(
      (screen.getByLabelText('Khung thời gian') as HTMLSelectElement).disabled,
    ).toBe(true);
    await user.type(box, 'DCA là gì?');
    await user.click(screen.getByRole('button', { name: /Gửi/ }));

    await waitFor(() =>
      expect(asked).toEqual([['c9', { question: 'DCA là gì?' }]]),
    );
    expect(started).toEqual([null]);
  });

  it('lists the pairs of both markets in one list, the market goes with the pair', async () => {
    const user = userEvent.setup();
    const asked: AiQuestion[] = [];
    await openAssistant(
      aiService(
        PRO,
        { items: [] },
        {
          ask: async (_id, question) => {
            asked.push(question);
            const pending = message('q1', 'USER', question.question, 'PENDING');
            return { question: pending, quota: PRO };
          },
        },
      ),
    );

    const pair = (await screen.findByLabelText(
      'Cặp coin',
    )) as HTMLSelectElement;
    await waitFor(() =>
      expect(
        Array.from(pair.querySelectorAll('optgroup')).map(
          (group) => group.label,
        ),
      ).toEqual(['Spot', 'Futures']),
    );
    await user.selectOptions(pair, 'futures:p-btc');
    expect(
      (screen.getByLabelText('Khung thời gian') as HTMLSelectElement).disabled,
    ).toBe(false);
    await user.type(
      screen.getByPlaceholderText(/Hỏi về cặp coin/),
      'Funding thế nào?',
    );
    await user.click(screen.getByRole('button', { name: /Gửi/ }));

    await waitFor(() =>
      expect(asked).toEqual([
        {
          question: 'Funding thế nào?',
          pairId: 'p-btc',
          market: 'futures',
          timeframe: '1h',
        },
      ]),
    );
  });

  it('shows MSG31 under a question whose answer failed', async () => {
    await openAssistant(
      aiService(PRO, { items: [message('q1', 'USER', 'Câu hỏi', 'FAILED')] }),
    );

    expect((await screen.findByRole('alert')).textContent).toContain(
      'tạm thời không khả dụng',
    );
  });

  it('BR-52: on FREE the conversation stays readable with the upgrade prompt', async () => {
    await openAssistant(
      aiService(
        { ...PRO, limit: 0, remaining: 0, used: 0, canAsk: false },
        { items: [message('q1', 'USER', 'Câu hỏi cũ')] },
      ),
    );

    expect(await screen.findByText('Câu hỏi cũ')).toBeTruthy();
    expect(screen.getByText('Trợ lý AI có ở gói PRO và PREMIUM')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Xem các gói' }).getAttribute('href'),
    ).toBe('/subscription');
    expect(screen.queryByPlaceholderText(/Hỏi về cặp coin/)).toBeNull();
    expect(
      (
        screen.getByRole('button', {
          name: /Cuộc trò chuyện mới/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it('BR-50: a used-up quota shows MSG30 and cannot send', async () => {
    await openAssistant(
      aiService(
        { ...PRO, used: 30, remaining: 0, canAsk: false },
        { items: [] },
      ),
    );

    expect(
      await screen.findByText(/Bạn đã dùng hết 30 câu hỏi hôm nay/),
    ).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: /Gửi/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});

const ACTIVE: AiConfiguration = {
  id: 'v1',
  modelName: 'gemini-3.5-flash-lite',
  systemPrompt: 'Explain, never advise.',
  temperature: '0.30',
  maxOutputTokens: 1024,
  disclaimer: 'Chỉ để tham khảo.',
  active: true,
  createdAt: AT,
  updatedAt: AT,
  updatedBy: null,
};
const OLD: AiConfiguration = {
  ...ACTIVE,
  id: 'v0',
  modelName: 'gemini-old',
  active: false,
};

describe('AI configuration console (SCR-42, UC-50)', () => {
  function adminService(
    overrides: Partial<AiAdminService> = {},
  ): AiAdminService {
    return {
      list: async () => [ACTIVE, OLD],
      create: async (draft) => ({
        ...ACTIVE,
        ...draft,
        id: 'v2',
        active: false,
      }),
      activate: async (id) => ({ ...OLD, id, active: true }),
      ...overrides,
    };
  }

  async function openConsole(aiAdmin: AiAdminService) {
    return renderRoutes(
      [page('/admin/ai-config', <AdminAiConfigPage />)],
      '/admin/ai-config',
      fakeAuth({ restoreSession: async () => admin }),
      { aiAdmin },
    );
  }

  it('starts a new version from the active one, checks the ranges, then saves it', async () => {
    const user = userEvent.setup();
    const created: AiConfigurationDraft[] = [];
    await openConsole(
      adminService({
        create: async (draft) => {
          created.push(draft);
          return { ...ACTIVE, ...draft, id: 'v2', active: false };
        },
      }),
    );

    await user.click(
      await screen.findByRole('button', { name: /New version/ }),
    );
    const model = screen.getByLabelText('Model') as HTMLInputElement;
    expect(model.value).toBe('gemini-3.5-flash-lite');
    const temperature = screen.getByLabelText('Temperature (0-1)');
    await user.clear(temperature);
    await user.type(temperature, '1.5');
    await user.click(screen.getByRole('button', { name: 'Save version' }));
    expect(screen.getByText('Out of range.')).toBeTruthy();
    expect(created).toEqual([]);

    await user.clear(temperature);
    await user.type(temperature, '0.5');
    await user.click(screen.getByRole('button', { name: 'Save version' }));

    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0]).toMatchObject({
      modelName: 'gemini-3.5-flash-lite',
      temperature: '0.5',
    });
  });

  it('activates an older version after a confirmation', async () => {
    const user = userEvent.setup();
    const activated: string[] = [];
    await openConsole(
      adminService({
        activate: async (id) => {
          activated.push(id);
          return { ...OLD, active: true };
        },
      }),
    );

    await user.click(
      await screen.findByRole('button', { name: 'Activate gemini-old' }),
    );
    expect(activated).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Activate' }));

    await waitFor(() => expect(activated).toEqual(['v0']));
    expect(
      screen.queryByRole('button', { name: 'Activate gemini-3.5-flash-lite' }),
    ).toBeNull();
  });
});
