import type { Services } from '../services/api/services';
import { marketFixtures } from './fixtures/market';

/** DEVELOPMENT ONLY. All unimplemented operations still fail explicitly. */
export function createDevelopmentServices(base: Services): Services {
  return {
    ...base,
    mode: 'development-fixtures',
    market: {
      async list(request) {
        request?.signal?.throwIfAborted();
        return {
          items: marketFixtures.filter(
            (quote) =>
              !request?.marketType || quote.marketType === request.marketType,
          ),
          nextCursor: null,
        };
      },
    },
  };
}
