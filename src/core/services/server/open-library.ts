import { HttpError } from "./security";
import syncedCatalog from "../../../../prisma/catalog/books.json";

export type OpenLibraryItem = {
  id: string;
  kind: "books" | "articles";
  title: string;
  authors: string;
  summary: string;
  url: string;
  coverUrl: string | null;
  year: number | null;
  source: string;
};
export type OpenLibraryResult = {
  kind: "books" | "articles";
  query: string;
  page: number;
  total: number;
  hasNext: boolean;
  source: string;
  degraded?: boolean;
  items: OpenLibraryItem[];
};
type GutenbergBook = {
  id: number;
  title: string;
  authors?: { name: string }[];
  summaries?: string[];
  formats?: Record<string, string>;
  copyright?: boolean | null;
};
type Article = {
  id: string;
  source: string;
  title: string;
  authorString?: string;
  pubYear?: string;
  journalTitle?: string;
  isOpenAccess?: string;
};

function safeGutenbergUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (
      url.protocol === "https:" &&
      ["www.gutenberg.org", "gutenberg.org"].includes(url.hostname)
    )
      return url.toString();
  } catch {}
  return null;
}
async function sourceJson<T>(url: URL, timeout = 15_000): Promise<T> {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "SIGB-Library/1.0 (https://sigb-three.vercel.app)",
      },
      signal: AbortSignal.timeout(timeout),
      next: { revalidate: 1800 },
    });
    if (!response.ok) throw new Error("upstream");
    return (await response.json()) as T;
  } catch {
    throw new HttpError(
      502,
      "A biblioteca pública está indisponível no momento. Tente novamente em instantes.",
    );
  }
}
function syncedBooks(query: string, page: number): OpenLibraryResult {
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR");
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const matches = syncedCatalog.books.filter((book) =>
    terms.every((term) =>
      normalize(`${book.title} ${book.author}`).includes(term),
    ),
  );
  const items = matches.slice((page - 1) * 32, page * 32).map((book) => ({
    id: book.externalId,
    kind: "books" as const,
    title: book.title,
    authors: book.author,
    summary: book.description,
    url: book.readingUrl,
    coverUrl: safeGutenbergUrl(book.coverSource),
    year: null,
    source: "Project Gutenberg",
  }));
  const date = syncedCatalog.retrievedAt
    .slice(0, 10)
    .split("-")
    .reverse()
    .join("/");
  return {
    kind: "books",
    query,
    page,
    total: matches.length,
    hasNext: page * 32 < matches.length,
    degraded: true,
    source: `Project Gutenberg · catálogo sincronizado em ${date}`,
    items,
  };
}
export async function searchOpenLibrary(
  params: URLSearchParams,
): Promise<OpenLibraryResult> {
  const kind = params.get("kind") ?? "books";
  if (kind !== "books" && kind !== "articles")
    throw new HttpError(400, "Selecione livros ou artigos.");
  const rawPage = params.get("page") ?? "1";
  if (!/^\d{1,3}$/.test(rawPage)) throw new HttpError(400, "Página inválida.");
  const page = Number(rawPage);
  if (page < 1 || page > 100) throw new HttpError(400, "Página inválida.");
  const query = (params.get("search") ?? "").trim();
  if (query.length > 160)
    throw new HttpError(400, "A busca deve ter no máximo 160 caracteres.");

  if (kind === "books") {
    const url = new URL("https://gutendex.com/books/");
    url.searchParams.set("languages", "pt");
    url.searchParams.set("copyright", "false");
    url.searchParams.set("page", String(page));
    if (query) url.searchParams.set("search", query);
    let data: { count: number; next: string | null; results: GutenbergBook[] };
    try {
      data = await sourceJson<typeof data>(url);
    } catch {
      return syncedBooks(query, page);
    }
    if (!Array.isArray(data.results))
      throw new HttpError(502, "Resposta inválida da biblioteca pública.");
    const items = data.results
      .filter(
        (b) => Number.isSafeInteger(b.id) && b.id > 0 && b.copyright === false,
      )
      .map((book) => {
        const formats = book.formats ?? {};
        const readingUrl = Object.entries(formats)
          .filter(([mime]) => mime.startsWith("text/html"))
          .map(([, value]) => safeGutenbergUrl(value))
          .find(Boolean);
        return {
          id: "gutenberg:" + book.id,
          kind: "books" as const,
          title: book.title,
          authors:
            book.authors
              ?.map((a) => a.name.split(", ").reverse().join(" "))
              .join(" · ") || "Autoria não informada",
          summary:
            book.summaries?.[0]?.slice(0, 1000) ||
            "Edição digital em português disponibilizada pelo Project Gutenberg. Consulte a obra e as condições de uso na fonte.",
          url: readingUrl || "https://www.gutenberg.org/ebooks/" + book.id,
          coverUrl: safeGutenbergUrl(formats["image/jpeg"]),
          year: null,
          source: "Project Gutenberg",
        };
      });
    return {
      kind,
      query,
      page,
      total: data.count ?? items.length,
      hasNext: !!data.next,
      source: "Gutendex / Project Gutenberg",
      items,
    };
  }

  try {
    return await europeArticles(query, page);
  } catch {
    return await pmcArticles(query, page);
  }
}

async function europeArticles(
  query: string,
  page: number,
): Promise<OpenLibraryResult> {
  const kind = "articles";
  const url = new URL(
    "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
  );
  const phrase = query.replace(/["\\]/g, " ").trim();
  url.searchParams.set(
    "query",
    phrase ? `OPEN_ACCESS:Y AND "${phrase}"` : "OPEN_ACCESS:Y",
  );
  url.searchParams.set("format", "json");
  url.searchParams.set("pageSize", "20");
  url.searchParams.set("page", String(page));
  const data = await sourceJson<{
    hitCount: number;
    resultList?: { result?: Article[] };
  }>(url, 6_000);
  const rows = data.resultList?.result;
  if (!Array.isArray(rows))
    throw new HttpError(502, "Resposta inválida da base de artigos.");
  const items = rows
    .filter((a) => a.isOpenAccess === "Y" && a.id && a.source)
    .map((article) => ({
      id: `epmc:${article.source}:${article.id}`,
      kind: "articles" as const,
      title: article.title,
      authors: article.authorString || "Autoria não informada",
      summary: article.journalTitle
        ? `Publicado em ${article.journalTitle}. Artigo com acesso aberto; consulte o texto e a licença na fonte.`
        : "Artigo com acesso aberto. Consulte o texto e a licença na fonte.",
      url: `https://europepmc.org/article/${encodeURIComponent(article.source)}/${encodeURIComponent(article.id)}`,
      coverUrl: null,
      year:
        article.pubYear && /^\d{4}$/.test(article.pubYear)
          ? Number(article.pubYear)
          : null,
      source: "Europe PMC",
    }));
  return {
    kind,
    query,
    page,
    total: data.hitCount ?? items.length,
    hasNext: page * 20 < data.hitCount,
    source: "Europe PMC",
    items,
  };
}

type PmcSummary = {
  title?: string;
  authors?: { name?: string }[];
  pubdate?: string;
  fulljournalname?: string;
  source?: string;
};

// E-utilities provides metadata from the PMC Open Access Subset when the
// Europe PMC service is unavailable. Both requests use fixed official hosts.
async function pmcArticles(
  query: string,
  page: number,
): Promise<OpenLibraryResult> {
  const searchUrl = new URL(
    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi",
  );
  const phrase = query.replace(/["\\\[\]]/g, " ").trim();
  searchUrl.search = new URLSearchParams({
    db: "pmc",
    term: phrase
      ? `"${phrase}" AND open access[filter]`
      : "open access[filter]",
    retmode: "json",
    retmax: "20",
    retstart: String((page - 1) * 20),
    tool: "SIGB",
  }).toString();
  const search = await sourceJson<{
    esearchresult?: { count?: string; idlist?: string[] };
  }>(searchUrl, 5_000);
  const found = search.esearchresult;
  if (
    !found ||
    typeof found.count !== "string" ||
    !/^\d+$/.test(found.count) ||
    !Array.isArray(found.idlist)
  )
    throw new HttpError(
      502,
      "Não foi possível consultar as bases públicas de artigos. Tente novamente em instantes.",
    );
  const ids = found.idlist
    .slice(0, 20)
    .filter((id) => typeof id === "string" && /^\d+$/.test(id));
  if (ids.length !== found.idlist.length)
    throw new HttpError(502, "Resposta inválida da base de artigos.");
  const total = Number(found.count);
  const result: OpenLibraryResult = {
    kind: "articles",
    query,
    page,
    total,
    hasNext: page * 20 < total,
    source: "NCBI PubMed Central · fonte alternativa",
    items: [],
  };
  if (!ids.length) return result;
  const summaryUrl = new URL(
    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi",
  );
  summaryUrl.search = new URLSearchParams({
    db: "pmc",
    id: ids.join(","),
    retmode: "json",
    tool: "SIGB",
  }).toString();
  const data = await sourceJson<{ result?: Record<string, PmcSummary> }>(
    summaryUrl,
    5_000,
  );
  if (!data.result)
    throw new HttpError(502, "Resposta inválida da base de artigos.");
  result.items = ids.flatMap((id) => {
    const article = data.result?.[id];
    if (!article || typeof article.title !== "string") return [];
    const year =
      typeof article.pubdate === "string"
        ? article.pubdate.match(/^\d{4}/)?.[0]
        : null;
    const journal = article.fulljournalname || article.source;
    return [
      {
        id: `pmc:${id}`,
        kind: "articles" as const,
        title: article.title.replace(/<[^>]*>/g, ""),
        authors: Array.isArray(article.authors)
          ? article.authors
              .map((a) => a.name)
              .filter((a) => typeof a === "string")
              .join(", ") || "Autoria não informada"
          : "Autoria não informada",
        summary: journal
          ? `Publicado em ${journal}. Artigo do conjunto de acesso aberto do PubMed Central. Consulte o texto e a licença na fonte.`
          : "Artigo do conjunto de acesso aberto do PubMed Central. Consulte o texto e a licença na fonte.",
        url: `https://pmc.ncbi.nlm.nih.gov/articles/PMC${id}/`,
        coverUrl: null,
        year: year ? Number(year) : null,
        source: "NCBI PubMed Central",
      },
    ];
  });
  if (!result.items.length)
    throw new HttpError(502, "Resposta inválida da base de artigos.");
  return result;
}
