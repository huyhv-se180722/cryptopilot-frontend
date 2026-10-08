import { createContext } from 'react';
import type { ToastTone } from '../../components/feedback/Toaster';

export type { ToastTone };

export interface ToastInput {
  tone: ToastTone;
  /** Final user text (an SRS message from the catalog). */
  message: string;
}

export interface ToastValue {
  show: (toast: ToastInput) => void;
}

export const ToastContext = createContext<ToastValue | null>(null);
