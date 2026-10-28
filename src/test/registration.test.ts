import { describe, it, expect } from "vitest";
import { registrationSchema } from "../core/services/server/validation";
const valid = {
  name: "Maria da Silva",
  phone: "(11) 99999-1234",
  email: " MARIA@EXAMPLE.COM ",
  password: "UmaSenhaDeTeste123",
};
describe("cadastro público de alunos", () => {
  it("normaliza o e-mail sem alterar a senha", () => {
    const result = registrationSchema.parse(valid);
    expect(result.email).toBe("maria@example.com");
    expect(result.password).toBe(valid.password);
  });
  it("rejeita campos de elevação de privilégios", () => {
    expect(
      registrationSchema.safeParse({ ...valid, role: "ADMIN" }).success,
    ).toBe(false);
    expect(
      registrationSchema.safeParse({ ...valid, blocked: false }).success,
    ).toBe(false);
  });
  it("exige telefone válido e nome completo", () => {
    for (const phone of ["", "--------", "abc12345678"])
      expect(registrationSchema.safeParse({ ...valid, phone }).success).toBe(
        false,
      );
    expect(
      registrationSchema.safeParse({ ...valid, name: "Maria" }).success,
    ).toBe(false);
  });
  it("rejeita senha curta e e-mail inválido", () => {
    expect(
      registrationSchema.safeParse({ ...valid, password: "123" }).success,
    ).toBe(false);
    expect(
      registrationSchema.safeParse({ ...valid, email: "invalido" }).success,
    ).toBe(false);
  });
});
