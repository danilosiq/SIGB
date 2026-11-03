import { afterEach, describe, expect, it, vi } from "vitest";
import { searchOpenLibrary } from "../core/services/server/open-library";

afterEach(() => vi.unstubAllGlobals());
describe("public library sources", () => {
  it("rejects invalid requests without contacting a source", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      searchOpenLibrary(new URLSearchParams("kind=other")),
    ).rejects.toThrow("Selecione livros ou artigos.");
    await expect(
      searchOpenLibrary(new URLSearchParams("page=-1")),
    ).rejects.toThrow("Página inválida.");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not forward untrusted provider links or copyrighted books", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          count: 2,
          next: null,
          results: [
            {
              id: 55752,
              title: "Dom Casmurro",
              copyright: false,
              authors: [{ name: "Machado de Assis" }],
              formats: {
                "text/html": "https://untrusted.example/book",
                "image/jpeg": "javascript:alert(1)",
              },
            },
            { id: 1, title: "Excluded", copyright: true },
          ],
        }),
      ),
    );
    const result = await searchOpenLibrary(new URLSearchParams("kind=books"));
    expect(result.items).toHaveLength(1);
    expect(result.items[0].url).toBe("https://www.gutenberg.org/ebooks/55752");
    expect(result.items[0].coverUrl).toBeNull();
    expect(result.items[0].year).toBeNull();
  });
  it("restricts article queries to open access and preserves pagination", async () => {
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        hitCount: 60,
        resultList: {
          result: [
            {
              id: "123",
              source: "MED",
              title: "Study",
              isOpenAccess: "Y",
              pubYear: "2024",
            },
            { id: "456", source: "MED", title: "Closed", isOpenAccess: "N" },
          ],
        },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const result = await searchOpenLibrary(
      new URLSearchParams({
        kind: "articles",
        search: 'education" OR X:Y',
        page: "2",
      }),
    );
    const url = fetch.mock.calls[0][0] as URL;
    expect(url.hostname).toBe("www.ebi.ac.uk");
    expect(url.searchParams.get("query")).toBe(
      'OPEN_ACCESS:Y AND "education  OR X:Y"',
    );
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.has("sort")).toBe(false);
    expect(url.searchParams.get("pageSize")).toBe("20");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.items).toHaveLength(1);
    expect(result.hasNext).toBe(true);
  });
  it("uses only real synced metadata and announces fallback during a book source outage", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("provider timeout")),
    );
    const result = await searchOpenLibrary(
      new URLSearchParams("kind=books&search=machado"),
    );
    expect(result.degraded).toBe(true);
    expect(result.source).toContain("catálogo sincronizado em");
    expect(result.items.length).toBeGreaterThan(0);
    expect(
      result.items.every(
        (item) => item.authors.includes("Machado") && item.year === null,
      ),
    ).toBe(true);
  });
  it("falls back to live NCBI OA metadata with explicit attribution and safe article URLs", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(
        Response.json({ esearchresult: { count: "61", idlist: ["13724522"] } }),
      )
      .mockResolvedValueOnce(
        Response.json({
          result: {
            "13724522": {
              title: "A <i>scientific</i> study",
              authors: [{ name: "Yu Z" }],
              pubdate: "2026 Oct 19",
              fulljournalname: "Frontiers in neurology",
            },
          },
        }),
      );
    vi.stubGlobal("fetch", fetch);
    const result = await searchOpenLibrary(
      new URLSearchParams({
        kind: "articles",
        search: 'education"[Other]',
        page: "3",
      }),
    );
    const searchUrl = fetch.mock.calls[1][0] as URL;
    expect(searchUrl.hostname).toBe("eutils.ncbi.nlm.nih.gov");
    expect(searchUrl.searchParams.get("db")).toBe("pmc");
    expect(searchUrl.searchParams.get("term")).toBe(
      '"education  Other" AND open access[filter]',
    );
    expect(searchUrl.searchParams.get("retstart")).toBe("40");
    expect(searchUrl.searchParams.get("retmax")).toBe("20");
    expect(result.source).toContain("NCBI PubMed Central");
    expect(result.source).toContain("fonte alternativa");
    expect(result.items[0]).toMatchObject({
      title: "A scientific study",
      authors: "Yu Z",
      year: 2026,
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC13724522/",
    });
    expect(result.hasNext).toBe(true);
  });
  it("does not request summaries for an empty NCBI result", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("outage", { status: 503 }))
      .mockResolvedValueOnce(
        Response.json({ esearchresult: { count: "0", idlist: [] } }),
      );
    vi.stubGlobal("fetch", fetch);
    const result = await searchOpenLibrary(
      new URLSearchParams("kind=articles"),
    );
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("rejects malformed NCBI identifiers before summary retrieval", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("outage", { status: 503 }))
      .mockResolvedValueOnce(
        Response.json({
          esearchresult: { count: "1", idlist: ["../../untrusted"] },
        }),
      );
    vi.stubGlobal("fetch", fetch);
    await expect(
      searchOpenLibrary(new URLSearchParams("kind=articles")),
    ).rejects.toThrow("Resposta inválida");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("reports provider outages as a retryable friendly error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("private internal detail")),
    );
    await expect(
      searchOpenLibrary(new URLSearchParams("kind=articles")),
    ).rejects.toThrow("A biblioteca pública está indisponível no momento.");
  });
});
