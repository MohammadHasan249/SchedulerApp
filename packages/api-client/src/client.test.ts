import { describe, it, expect, vi, beforeEach } from "vitest";
import { configureApiClient, apiFetch } from "./client";

function mockFetchOnce(response: Partial<Response> & { ok: boolean }) {
  global.fetch = vi.fn().mockResolvedValue(response as Response);
}

describe("apiFetch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns undefined for a 204 No Content response instead of parsing a body", async () => {
    configureApiClient({ baseUrl: "http://api.test", getToken: async () => "token" });
    mockFetchOnce({ ok: true, status: 204, text: async () => "" } as Response);

    const result = await apiFetch("/thing");
    expect(result).toBeUndefined();
  });

  it("returns undefined for a 200 response with an empty body", async () => {
    configureApiClient({ baseUrl: "http://api.test", getToken: async () => "token" });
    mockFetchOnce({ ok: true, status: 200, text: async () => "" } as Response);

    const result = await apiFetch("/thing");
    expect(result).toBeUndefined();
  });

  it("parses a normal JSON body", async () => {
    configureApiClient({ baseUrl: "http://api.test", getToken: async () => "token" });
    mockFetchOnce({ ok: true, status: 200, text: async () => JSON.stringify({ id: "1" }) } as Response);

    const result = await apiFetch("/thing");
    expect(result).toEqual({ id: "1" });
  });

  it("retries once with a refreshed token on 401, then succeeds", async () => {
    const refreshToken = vi.fn().mockResolvedValue("new-token");
    configureApiClient({ baseUrl: "http://api.test", getToken: async () => "stale-token", refreshToken });

    let call = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      call += 1;
      if (call === 1) return { ok: false, status: 401, text: async () => "" } as Response;
      return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true }) } as Response;
    });

    const result = await apiFetch("/thing");
    expect(refreshToken).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("throws the server-provided error message on failure", async () => {
    configureApiClient({ baseUrl: "http://api.test", getToken: async () => "token" });
    mockFetchOnce({ ok: false, status: 400, text: async () => JSON.stringify({ error: "Bad input" }) } as Response);

    await expect(apiFetch("/thing")).rejects.toThrow("Bad input");
  });

  it("falls back to a generic message when the error body isn't JSON", async () => {
    configureApiClient({ baseUrl: "http://api.test", getToken: async () => "token" });
    mockFetchOnce({ ok: false, status: 500, statusText: "Internal Server Error", text: async () => "oops" } as Response);

    await expect(apiFetch("/thing")).rejects.toThrow("Request failed: 500");
  });
});
