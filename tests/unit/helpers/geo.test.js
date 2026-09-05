const {
  MIN_OFFSET_M,
  MAX_OFFSET_M,
  coordenadasAPunto,
  puntoACoordenadas,
  distanciaMetros,
  desplazarCoordenadas,
  generarUbicacionPublica,
} = require("../../../helpers/geo");

const PLAZA_INDEPENDENCIA = { lat: -26.8241, lng: -65.2226 };

describe("helpers/geo", () => {
  describe("coordenadasAPunto / puntoACoordenadas", () => {
    test("convierte lat/lng a GeoJSON Point y viceversa sin pérdida", () => {
      const punto = coordenadasAPunto(PLAZA_INDEPENDENCIA);
      expect(punto).toEqual({ type: "Point", coordinates: [-65.2226, -26.8241] });
      expect(puntoACoordenadas(punto)).toEqual(PLAZA_INDEPENDENCIA);
    });
  });

  describe("distanciaMetros", () => {
    test("la distancia entre un punto y sí mismo es 0", () => {
      expect(distanciaMetros(PLAZA_INDEPENDENCIA, PLAZA_INDEPENDENCIA)).toBeCloseTo(0, 5);
    });

    test("un grado de latitud son aproximadamente 111km", () => {
      const otroPunto = { lat: PLAZA_INDEPENDENCIA.lat + 1, lng: PLAZA_INDEPENDENCIA.lng };
      const distancia = distanciaMetros(PLAZA_INDEPENDENCIA, otroPunto);
      expect(distancia).toBeGreaterThan(110000);
      expect(distancia).toBeLessThan(112000);
    });
  });

  describe("desplazarCoordenadas", () => {
    test("desplaza siempre entre 100 y 200 metros del punto original", () => {
      for (let i = 0; i < 200; i++) {
        const desplazado = desplazarCoordenadas(PLAZA_INDEPENDENCIA);
        const distancia = distanciaMetros(PLAZA_INDEPENDENCIA, desplazado);
        expect(distancia).toBeGreaterThanOrEqual(MIN_OFFSET_M - 0.5);
        expect(distancia).toBeLessThanOrEqual(MAX_OFFSET_M + 0.5);
      }
    });

    test("dos llamadas seguidas no dan el mismo resultado (aleatoriedad)", () => {
      const a = desplazarCoordenadas(PLAZA_INDEPENDENCIA);
      const b = desplazarCoordenadas(PLAZA_INDEPENDENCIA);
      expect(a).not.toEqual(b);
    });
  });

  describe("generarUbicacionPublica", () => {
    test("devuelve un GeoJSON Point desplazado 100-200m del punto exacto", () => {
      const exacto = coordenadasAPunto(PLAZA_INDEPENDENCIA);
      const publico = generarUbicacionPublica(exacto);

      expect(publico.type).toBe("Point");
      const distancia = distanciaMetros(puntoACoordenadas(exacto), puntoACoordenadas(publico));
      expect(distancia).toBeGreaterThanOrEqual(MIN_OFFSET_M - 0.5);
      expect(distancia).toBeLessThanOrEqual(MAX_OFFSET_M + 0.5);
    });
  });
});
