import type { Services } from '../services/api/services';
import { createDevelopmentAuth } from './dev-auth';
import { createDevelopmentProfile } from './dev-profile';

/** DEVELOPMENT ONLY. All unimplemented operations still fail explicitly. */
export function createDevelopmentServices(base: Services): Services {
  return {
    ...base,
    mode: 'development-fixtures',
    auth: createDevelopmentAuth(),
    profile: createDevelopmentProfile(),
  };
}
