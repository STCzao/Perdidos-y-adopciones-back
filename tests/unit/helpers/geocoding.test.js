const AppError = require("../../../helpers/AppError");
const { geocodificarDireccion, esResultadoImpreciso } = require("../../../helpers/geocoding");

describe("helpers/geocoding", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe("geocodificarDireccion", () => {
    test("devuelve lat/lng/clase/tipo del primer resultado", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue([
          { lat: "-26.8241", lon: "-65.2226", class: "amenity", type: "park" },
        ]),
      });

      const resultado = await geocodificarDireccion({ direccion: "Plaza Independencia", contexto: "Tucumán" });

      expect(resultado).toEqual({ lat: -26.8241, lng: -65.2226, clase: "amenity", tipo: "park" });
    });

    test("manda un User-Agent identificable, como exige la política de Nominatim", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue([{ lat: "1", lon: "2", class: "place", type: "city" }]),
      });

      await geocodificarDireccion({ direccion: "Plaza Independencia" });

      const [, opciones] = global.fetch.mock.calls[0];
      expect(opciones.headers["User-Agent"]).toMatch(/PerdidosYAdopciones/);
    });

    test("lanza AppError 422 si no hay resultados", async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue([]) });

      const err = await geocodificarDireccion({ direccion: "direccion inexistente" }).catch((e) => e);

      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(422);
    });

    test("lanza AppError 502 si la respuesta HTTP no es ok", async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false });

      const err = await geocodificarDireccion({ direccion: "Plaza Independencia" }).catch((e) => e);

      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(502);
    });

    test("lanza AppError 502 si falla la conexión", async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error("network down"));

      const err = await geocodificarDireccion({ direccion: "Plaza Independencia" }).catch((e) => e);

      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(502);
    });
  });

  describe("esResultadoImpreciso", () => {
    test("un match de tipo boundary/administrative es impreciso", () => {
      expect(esResultadoImpreciso({ clase: "boundary", tipo: "administrative" })).toBe(true);
    });

    test("un match a nivel provincia (place/state) es impreciso", () => {
      expect(esResultadoImpreciso({ clase: "place", tipo: "state" })).toBe(true);
    });

    test("un match puntual (amenity/park) no es impreciso", () => {
      expect(esResultadoImpreciso({ clase: "amenity", tipo: "park" })).toBe(false);
    });
  });
});
