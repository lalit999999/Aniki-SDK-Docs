import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

/**
 * `true` once the component has mounted on the client, `false` during SSR
 * and the first client render. Used to defer rendering anything that
 * depends on browser-only state (the resolved theme, viewport size) until
 * hydration has happened, without the "setState called synchronously in
 * an effect" pattern `react-hooks/set-state-in-effect` flags.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
