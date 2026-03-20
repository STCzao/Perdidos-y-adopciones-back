const { normalizarTexto } = require("../../../helpers/normalizar-texto");

describe("normalizarTexto", () => {
  test("convierte a mayúsculas y elimina espacios extremos", () => {
    expect(normalizarTexto("  hola mundo  ")).toBe("HOLA MUNDO");
  });

  test("ya en mayúsculas — no modifica", () => {
    expect(normalizarTexto("PERDIDO")).toBe("PERDIDO");
  });

  test("string vacío retorna string vacío", () => {
    expect(normalizarTexto("")).toBe("");
  });

  test("string solo espacios retorna string vacío", () => {
    expect(normalizarTexto("   ")).toBe("");
  });

  test("undefined retorna undefined sin error", () => {
    expect(normalizarTexto(undefined)).toBeUndefined();
  });

  test("null retorna null sin error", () => {
    expect(normalizarTexto(null)).toBeNull();
  });

  test("número retorna el número sin modificar", () => {
    expect(normalizarTexto(42)).toBe(42);
  });

  test("false retorna false sin modificar", () => {
    expect(normalizarTexto(false)).toBe(false);
  });

  test("normaliza caracteres especiales correctamente", () => {
    expect(normalizarTexto("labrador retriever")).toBe("LABRADOR RETRIEVER");
  });
});
