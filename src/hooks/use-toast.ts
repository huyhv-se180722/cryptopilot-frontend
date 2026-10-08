import { useContext } from 'react';
import { ToastContext } from '../app/providers/toast-context';

export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error('Toast provider is missing.');
  return toast;
}
