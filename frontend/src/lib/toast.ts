/**
 * App-wide toast notifications — the replacement for error/info Alert popups.
 *
 * Module-level API so it can be called from anywhere (screens, hooks, api
 * helpers) without threading a hook through every call site:
 *
 *   import { toast } from '../lib/toast';
 *   toast.error('Could not send message', getApiErrorMessage(error));
 *   toast.success('Invite sent');
 *
 * `ToastHost` (mounted once in App.tsx) subscribes and renders these.
 * Confirmation dialogs (destructive actions with buttons) should still use
 * Alert.alert — this is only for one-way notices.
 */

export type ToastKind = 'error' | 'success' | 'info';

export type ToastPayload = {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
};

type Listener = (toast: ToastPayload) => void;

const listeners = new Set<Listener>();
let nextId = 1;

export function subscribeToToasts(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function show(kind: ToastKind, title: string, message?: string): void {
  const payload: ToastPayload = { id: nextId++, kind, title, message };
  for (const listener of listeners) listener(payload);
}

export const toast = {
  error: (title: string, message?: string) => show('error', title, message),
  success: (title: string, message?: string) => show('success', title, message),
  info: (title: string, message?: string) => show('info', title, message),
  show,
};
