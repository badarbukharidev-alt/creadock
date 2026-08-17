import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/env", () => ({
  ENV: {
    forgeApiUrl: "https://forge.example",
    forgeApiKey: "test-forge-key",
  },
}));

import { storageGetObjectSize } from "./storage";

describe("storageGetObjectSize", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses the object store content-length as the authoritative byte total", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: "https://storage.example/signed-object" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: { "content-length": "1048576" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(storageGetObjectSize("creators/42/digital-products/guide.pdf")).resolves.toBe(1_048_576);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://storage.example/signed-object");
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "HEAD" });
  });
});
