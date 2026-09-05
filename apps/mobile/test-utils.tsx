import type { ReactElement } from "react";
import { render as rtlRender, type RenderOptions } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export * from "@testing-library/react-native";

// Screens under test call TanStack Query hooks, which need a QueryClient in
// context. Each render() gets its own fresh client (retries disabled so
// mocked-rejection tests fail fast instead of retrying) so query state never
// leaks between tests.
export function render(ui: ReactElement, options?: RenderOptions) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return rtlRender(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>, options);
}
