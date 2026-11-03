"use client";
import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  FileText,
  Search,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { openLibraryService } from "../services/open-library-service";
import { errorMessage } from "@/core/services/api-service";
import styles from "./open-library-panel.module.css";

export function OpenLibraryPanel() {
  const [kind, setKind] = useState<"books" | "articles">("books");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["open-library", kind, search, page],
    queryFn: () => openLibraryService.search(kind, search, page),
    staleTime: 30 * 60_000,
    retry: 1,
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSearch(draft.trim());
    setPage(1);
  }
  function changeKind(next: "books" | "articles") {
    setKind(next);
    setPage(1);
  }
  return (
    <section className={styles.library}>
      <header className={styles.heading}>
        <span>BIBLIOTECA ABERTA</span>
        <h1>Conhecimento sem fronteiras.</h1>
        <p>
          Livros digitais em português e artigos científicos com acesso aberto,
          direto de bibliotecas públicas.
        </p>
      </header>
      <div className={styles.tools}>
        <div className={styles.tabs} aria-label="Tipo de conteúdo">
          <button
            type="button"
            aria-pressed={kind === "books"}
            onClick={() => changeKind("books")}
          >
            <BookOpen size={17} />
            Livros digitais
          </button>
          <button
            type="button"
            aria-pressed={kind === "articles"}
            onClick={() => changeKind("articles")}
          >
            <FileText size={17} />
            Artigos científicos
          </button>
        </div>
        <form onSubmit={submit} className={styles.search}>
          <Search size={18} />
          <input
            aria-label="Pesquisar na biblioteca aberta"
            placeholder={
              kind === "books"
                ? "Busque um título ou autor"
                : "Busque um tema de pesquisa"
            }
            value={draft}
            maxLength={160}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit">Buscar</button>
        </form>
      </div>
      <div className={styles.source}>
        <span>
          {query.data?.source ??
            (kind === "books" ? "Project Gutenberg · Gutendex" : "Europe PMC")}
        </span>
        <p>
          {kind === "books"
            ? "Edições digitais externas, sem retirada de exemplar físico."
            : "Referências e links para leitura na fonte. Grande parte dos artigos está em inglês."}
        </p>
      </div>
      {query.data?.degraded && (
        <p className={styles.offline} role="status">
          A consulta ao vivo está temporariamente indisponível. Exibindo os
          livros do catálogo sincronizado acima.
        </p>
      )}
      {query.isPending ? (
        <div className={styles.state} role="status">
          <LoaderCircle size={28} className="spin" />
          <p>Consultando a biblioteca pública…</p>
        </div>
      ) : query.isError ? (
        <div className={styles.state} role="alert">
          <p>{errorMessage(query.error)}</p>
          <button type="button" onClick={() => void query.refetch()}>
            <RefreshCw size={16} />
            Tentar novamente
          </button>
        </div>
      ) : query.data.items.length === 0 ? (
        <div className={styles.state}>
          <Search size={30} />
          <h2>Nenhum resultado encontrado</h2>
          <p>Tente outro título, autor ou tema.</p>
        </div>
      ) : (
        <>
          <p className={styles.resultCount}>
            {query.data.total.toLocaleString("pt-BR")} resultados · página{" "}
            {page}
          </p>
          <div className={kind === "books" ? styles.books : styles.articles}>
            {query.data.items.map((item) => (
              <article className={styles.card} key={item.id}>
                {kind === "books" && (
                  <div className={styles.cover}>
                    {item.coverUrl ? (
                      <img
                        src={item.coverUrl}
                        alt={"Capa de " + item.title}
                        loading="lazy"
                      />
                    ) : (
                      <BookOpen size={42} />
                    )}
                  </div>
                )}
                <div className={styles.cardContent}>
                  <span className={styles.kicker}>
                    {item.source}
                    {item.year ? ` · ${item.year}` : ""}
                  </span>
                  <h2>{item.title}</h2>
                  <p className={styles.author}>{item.authors}</p>
                  <p className={styles.summary}>{item.summary}</p>
                  <a href={item.url} target="_blank" rel="noopener noreferrer">
                    {kind === "books" ? "Ler edição digital" : "Abrir artigo"}
                    <ArrowUpRight size={16} />
                  </a>
                </div>
              </article>
            ))}
          </div>
          <nav
            className={styles.pagination}
            aria-label="Páginas da biblioteca aberta"
          >
            <button
              disabled={page === 1 || query.isFetching}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={16} />
              Anterior
            </button>
            <span>Página {page}</span>
            <button
              disabled={!query.data.hasNext || query.isFetching}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
              <ChevronRight size={16} />
            </button>
          </nav>
        </>
      )}
    </section>
  );
}
