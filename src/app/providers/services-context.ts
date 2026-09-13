import { createContext } from 'react';
import type { Services } from '../../services/api/services';
export const ServicesContext = createContext<Services | null>(null);
