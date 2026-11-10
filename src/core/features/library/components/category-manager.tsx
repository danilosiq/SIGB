"use client";

import { useState, type FormEvent } from "react";
import type { Category } from "@/core/@types";
import { libraryService as service } from "../services/library-service";

export function CategoryManager({
  categories,
  run,
  pending,
}: {
  categories: Category[];
  run: (fn: () => Promise<unknown>) => Promise<boolean>;
  pending: boolean;
}) {
  const [name, setName] = useState("");
  const [createdCategories, setCreatedCategories] = useState<Category[]>([]);
  const allCategories = [
    ...categories,
    ...createdCategories.filter(
      (created) => !categories.some((category) => category.id === created.id),
    ),
  ].sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const categoryName = name.trim();
    if (pending || categoryName.length < 2 || categoryName.length > 60) return;
    const ok = await run(async () => {
      const created = await service.createCategory(categoryName);
      setCreatedCategories((current) => [...current, created]);
    });
    if (ok) setName("");
  }

  return (
    <section aria-labelledby="category-manager-title" className="form">
      <div>
        <h3 id="category-manager-title">Categorias do acervo</h3>
        <p>Organize os livros para facilitar a busca por assunto.</p>
      </div>
      <form onSubmit={submit} className="form" aria-busy={pending}>
        <label>
          Nova categoria
          <input
            name="categoryName"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Biografias"
            required
            minLength={2}
            maxLength={60}
            disabled={pending}
          />
        </label>
        <button
          type="submit"
          className="button primary"
          disabled={pending || name.trim().length < 2}
        >
          {pending ? "Salvando…" : "Cadastrar categoria"}
        </button>
      </form>
      {allCategories.length ? (
        <ul
          className="registered-category-list"
          aria-label="Categorias cadastradas"
        >
          {allCategories.map((category) => (
            <li key={category.id}>
              {category.name}
              {category._count && (
                <span>
                  {" "}
                  · {category._count.books}{" "}
                  {category._count.books === 1 ? "livro" : "livros"}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>Nenhuma categoria cadastrada. Comece criando uma acima.</p>
      )}
    </section>
  );
}
