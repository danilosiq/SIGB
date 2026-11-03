import { describe, expect, it } from "vitest";
import {
  bookSchema,
  digitalBookSchema,
} from "../core/services/server/validation";

const book = {
  title: "Livro de teste",
  author: "Autor de Teste",
  isbn: "TEST-0001",
  category: "Literatura",
  description: "Descrição fictícia para validação do acervo.",
  publisher: "Editora de Teste",
  year: 2026,
  pages: 200,
};

describe("metadados de livros físicos e digitais", () => {
  it("exige ano e páginas conhecidos para livros físicos", () => {
    expect(bookSchema.safeParse(book).success).toBe(true);
    expect(bookSchema.safeParse({ ...book, year: 0 }).success).toBe(false);
    expect(bookSchema.safeParse({ ...book, pages: 0 }).success).toBe(false);
  });

  it("permite metadados desconhecidos no acervo digital", () => {
    expect(
      digitalBookSchema.safeParse({ ...book, year: 0, pages: 0 }).success,
    ).toBe(true);
    expect(digitalBookSchema.safeParse(book).success).toBe(true);
  });

  it.each([-1, 1, 999, 2101, 2026.5])(
    "rejeita ano digital inválido: %s",
    (year) => {
      expect(digitalBookSchema.safeParse({ ...book, year }).success).toBe(
        false,
      );
    },
  );

  it.each([-1, 20001, 1.5])(
    "rejeita quantidade de páginas inválida: %s",
    (pages) => {
      expect(digitalBookSchema.safeParse({ ...book, pages }).success).toBe(
        false,
      );
    },
  );

  it("aceita os limites conhecidos do acervo digital", () => {
    expect(
      digitalBookSchema.safeParse({ ...book, year: 1000, pages: 1 }).success,
    ).toBe(true);
    expect(
      digitalBookSchema.safeParse({ ...book, year: 2100, pages: 20000 })
        .success,
    ).toBe(true);
  });
});
