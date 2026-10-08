import { useAuth } from '../../../hooks/use-auth';
import { useMutation } from '../../../hooks/use-mutation';
import { useServices } from '../../../hooks/use-services';

/** Sign in through the session store (global state changes on success). */
export function useLogin() {
  return useMutation(useAuth().login);
}

/** Account flows that do not open a session (SRS 3.2.1–3.2.4). */
export function useRegister() {
  return useMutation(useServices().auth.register);
}
export function useResendVerification() {
  return useMutation(useServices().auth.resendVerification);
}
export function useForgotPassword() {
  return useMutation(useServices().auth.forgotPassword);
}
export function useResetPassword() {
  return useMutation(useServices().auth.resetPassword);
}

/** SCR-07 Security tab for a Trader or an Admin (UC-07). */
export function useChangePassword() {
  return useMutation(useServices().auth.changePassword);
}
