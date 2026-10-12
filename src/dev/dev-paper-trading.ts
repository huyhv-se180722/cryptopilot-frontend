import type { PaperTradingService } from '../services/api/contracts';
import { ServiceError } from '../services/api/errors';
import type { PaperAccount, Session } from '../types/domain';

/**
 * DEVELOPMENT ONLY. In-memory `/paper/**` with the backend's answers: the
 * account opens once on the first call and every later call returns the
 * same one (TR-04); MSG44 without a session. A reload starts again.
 */
export function createDevelopmentPaperTrading(
  session: () => Promise<Session | null>,
  now: () => number = Date.now,
): { paperTrading: PaperTradingService } {
  let account: PaperAccount | null = null;
  return {
    paperTrading: {
      openAccount: async () => {
        if (!(await session()))
          throw new ServiceError(
            'Development paper refusal.',
            'HTTP_ERROR',
            401,
            {
              status: 401,
              code: 'AUTHENTICATION_REQUIRED',
              messageCode: 'MSG44',
              messageArgs: [],
              fieldErrors: {},
            },
          );
        account ??= {
          accountId: 'dev-paper-account-1',
          positionMode: 'one-way',
          openedAt: new Date(now()).toISOString(),
        };
        return account;
      },
    },
  };
}
