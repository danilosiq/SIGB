import { describe, it, expect } from "vitest";
import { fineAt, shouldBlock, retryDelay } from "../core/utils/rules";
describe("políticas de empréstimo", () => {
  it("não aplica multa antes do prazo e aumenta por dia de atraso", () => {
    const due = new Date("2026-10-20T12:00:00-03:00");
    expect(fineAt(due, new Date("2026-10-19T12:00:00-03:00"), 100)).toBe(0);
    expect(fineAt(due, new Date("2026-10-23T12:00:00-03:00"), 100)).toBe(300);
  });
  it("bloqueia somente após dois meses de calendário", () => {
    const start = new Date("2026-01-31T12:00:00Z");
    expect(shouldBlock(start, new Date("2026-03-31T12:00:00Z"))).toBe(false);
    expect(shouldBlock(start, new Date("2026-03-31T12:00:01Z"))).toBe(true);
  });
  it("trata o fim de mês sem converter dois meses em 60 dias", () => {
    expect(
      shouldBlock(
        new Date("2026-07-31T12:00:00Z"),
        new Date("2026-10-01T12:00:00Z"),
      ),
    ).toBe(true);
  });
  it("retentativas esperam intervalos crescentes", () => {
    expect(retryDelay(1)).toBe(60_000);
    expect(retryDelay(2)).toBe(120_000);
  });
});
