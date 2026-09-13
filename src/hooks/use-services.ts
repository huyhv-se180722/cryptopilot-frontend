import { useContext } from 'react';
import { ServicesContext } from '../app/providers/services-context';

export function useServices() {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('Services provider is missing.');
  return services;
}
