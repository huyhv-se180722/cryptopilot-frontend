import { createContext } from 'react';
import type { AuthStore } from '../../services/auth/auth-store';
export const AuthContext = createContext<AuthStore | null>(null);
