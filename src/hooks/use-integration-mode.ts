import { useServices } from './use-services';
export function useIntegrationMode() {
  return useServices().mode;
}
