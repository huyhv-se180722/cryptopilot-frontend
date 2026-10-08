import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { Toaster, type ToastItem } from '../../components/feedback/Toaster';
import { ToastContext, type ToastInput } from './toast-context';

const MAX_VISIBLE = 3;

/** Sits outside the router so a toast survives the redirect after it. */
export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const show = useCallback((toast: ToastInput) => {
    const id = ++nextId.current;
    setToasts((current) => [...current, { ...toast, id }].slice(-MAX_VISIBLE));
  }, []);
  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);
  const value = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}
