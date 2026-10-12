import type { Services } from '../services/api/services';
import { createDevelopmentAuth } from './dev-auth';
import { createDevelopmentMarket } from './dev-market';
import { createDevelopmentProfile } from './dev-profile';

/** DEVELOPMENT ONLY. All unimplemented operations still fail explicitly. */
export function createDevelopmentServices(base: Services): Services {
  return {
    ...base,
    mode: 'development-fixtures',
    auth: createDevelopmentAuth(),
    profile: createDevelopmentProfile(),
    ...createDevelopmentMarket(),
  };
}
