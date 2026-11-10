"use client";
import { useState, type FormEvent } from "react";
import type { Book, Category } from "@/core/@types";
import { UploadCloud } from "lucide-react";
import { libraryService as service } from "../services/library-service";
export function BookForm({
  book,
  categories,
  run,
  onDone,
  pending,
}: {
  book?: Book;
  categories: Category[];
  run: (fn: () => Promise<unknown>) => Promise<boolean>;
  onDone: () => void;
  pending: boolean;
}) {
  const digital = book?.format === "DIGITAL";
  const [category, setCategory] = useState(book?.category ?? "");
  const [createdCategories, setCreatedCategories] = useState<string[]>([]);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const categoryNames = [
    ...new Set([
      ...(book?.category ? [book.category] : []),
      ...categories.map((item) => item.name),
      ...createdCategories,
    ]),
  ].sort((left, right) => left.localeCompare(right, "pt-BR"));
  async function addCategory() {
    const name = categoryName.trim();
    if (pending || name.length < 2 || name.length > 60) return;
    const ok = await run(async () => {
      const created = await service.createCategory(name);
      setCreatedCategories((current) => [...current, created.name]);
      setCategory(created.name);
    });
    if (ok) {
      setCategoryName("");
      setCreatingCategory(false);
    }
  }
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
        <div className="form">
          <label>
            Categoria
            <select
              name="category"
              value={category || categoryNames[0] || ""}
              onChange={(event) => setCategory(event.target.value)}
              required
              disabled={pending}
            >
              {!categoryNames.length && (
                <option value="">Cadastre uma categoria</option>
              )}
              {categoryNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="button secondary"
            onClick={() => setCreatingCategory((current) => !current)}
            aria-expanded={creatingCategory}
            disabled={pending}
          >
            {creatingCategory ? "Cancelar nova categoria" : "Nova categoria"}
          </button>
          {creatingCategory && (
            <div className="form">
              <label>
                Nome da nova categoria
                <input
                  value={categoryName}
                  onChange={(event) => setCategoryName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void addCategory();
                    }
                  }}
                  maxLength={60}
                  placeholder="Ex.: Biografias"
                  disabled={pending}
                />
              </label>
              <button
                type="button"
                className="button secondary"
                onClick={addCategory}
                disabled={pending || categoryName.trim().length < 2}
              >
                {pending ? "Salvando…" : "Adicionar categoria"}
              </button>
            </div>
          )}
        </div>
        <label>
          Setor
          <input
            name="sector"
            defaultValue={book?.sector ?? ""}
            maxLength={80}
            placeholder="Ex.: Literatura brasileira"
          />
        </label>
        <label>
          Prateleira
          <input
            name="shelf"
            defaultValue={book?.shelf ?? ""}
            maxLength={80}
            placeholder="Ex.: A-03"
          />
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
          Ano{digital ? " (opcional)" : ""}
          <input
            name="year"
            type="number"
            min={1000}
            max={2100}
            defaultValue={
              digital && book?.year === 0 ? "" : (book?.year ?? 2026)
            }
            placeholder={digital ? "Não informado" : undefined}
            required={!digital}
          />
        </label>
        <label>
          Páginas{digital ? " (opcional)" : ""}
          <input
            name="pages"
            type="number"
            min={1}
            max={20000}
            defaultValue={
              digital && book?.pages === 0 ? "" : (book?.pages ?? 200)
            }
            placeholder={digital ? "Não informado" : undefined}
            required={!digital}
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
