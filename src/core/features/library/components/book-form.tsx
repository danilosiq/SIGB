"use client";
import { useState, type FormEvent } from "react";
import type { Book } from "@/core/@types";
import { UploadCloud } from "lucide-react";
import { libraryService as service } from "../services/library-service";
export function BookForm({
  book,
  run,
  onDone,
  pending,
}: {
  book?: Book;
  run: (fn: () => Promise<unknown>) => Promise<boolean>;
  onDone: () => void;
  pending: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = Object.fromEntries(new FormData(e.currentTarget));
    const ok = await run(async () => {
      const b = await service.saveBook(
        {
          ...input,
          year: Number(input.year),
          pages: Number(input.pages),
          available: input.available === "true",
        },
        book?.id,
      );
      if (file)
        try {
          await service.uploadCover(b.id, file);
        } catch {
          throw new Error(
            "Livro salvo, mas a capa falhou. Edite o livro para reenviar a imagem.",
          );
        }
    });
    if (ok) onDone();
  }
  return (
    <form onSubmit={submit} className="form">
      <div className="form-grid">
        <label>
          Título
          <input
            name="title"
            defaultValue={book?.title}
            required
            maxLength={200}
          />
        </label>
        <label>
          Autor
          <input
            name="author"
            defaultValue={book?.author}
            required
            minLength={2}
          />
        </label>
        <label>
          ISBN / código do exemplar
          <input name="isbn" defaultValue={book?.isbn} required minLength={5} />
        </label>
        <label>
          Categoria
          <select name="category" defaultValue={book?.category ?? "Literatura"}>
            {[
              "Literatura",
              "Ficção",
              "Design",
              "História",
              "Ciência",
              "Tecnologia",
              "Desenvolvimento pessoal",
            ].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Editora
          <input
            name="publisher"
            defaultValue={book?.publisher}
            required
            minLength={2}
          />
        </label>
        <label>
          Ano
          <input
            name="year"
            type="number"
            min={1000}
            max={2100}
            defaultValue={book?.year ?? 2026}
            required
          />
        </label>
        <label>
          Páginas
          <input
            name="pages"
            type="number"
            min={1}
            max={20000}
            defaultValue={book?.pages ?? 200}
            required
          />
        </label>
        <label>
          Status
          <select
            name="available"
            defaultValue={String(book?.available ?? true)}
          >
            <option value="true">Disponível</option>
            <option value="false">Indisponível</option>
          </select>
        </label>
      </div>
      <label>
        Descrição
        <textarea
          name="description"
          defaultValue={book?.description}
          required
          minLength={10}
          maxLength={5000}
          rows={3}
        />
      </label>
      <label className="upload">
        <UploadCloud size={24} />
        <span>
          {file?.name ?? "Selecionar capa do livro"}
          <small>PNG, JPG ou WebP · até 3 MB</small>
        </span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>
      <button className="button primary" disabled={pending}>
        {pending ? "Salvando…" : "Salvar livro"}
      </button>
    </form>
  );
}
