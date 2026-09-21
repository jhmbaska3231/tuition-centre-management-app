// frontend/src/api/token-store.ts
//
// the access token lives in a module variable, never in localstorage or sessionstorage,
// so a script injected into the page cannot read it and it does not survive a tab close.
// durability comes from the httponly refresh cookie instead
//
// it is kept outside react because the fetch wrapper needs to read it synchronously on
// every request, and because a state update must not be able to leave a request holding
// a stale token

let accessToken: string | null = null;

type Listener = (token: string | null) => void;
const listeners = new Set<Listener>();

export const getAccessToken = (): string | null => accessToken;

export const setAccessToken = (token: string | null): void => {
  accessToken = token;
  for (const listener of listeners) listener(token);
};

// the auth context subscribes so it can clear the user when a refresh fails mid session
export const subscribeToToken = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};