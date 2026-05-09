jest.mock("../../helpers/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const db = require("../setup/db");
const { createUser, createAdmin, createPublicacion } = require("../setup/factories");
const Publicacion = require("../../models/publicacion");
const publicacionService = require("../../service/publicaciones");

describe("service/publicaciones — integración", () => {
  beforeAll(async () => await db.connect());
  afterAll(async () => await db.disconnect());
  afterEach(async () => await db.clearCollections());

  // ─── crearPublicacion ────────────────────────────────────────────────────────
  describe("crearPublicacion", () => {
    test("asigna estado defecto PERDIDO → SE BUSCA", async () => {
      const user = await createUser();
      const result = await publicacionService.crearPublicacion({
        body: {
          tipo: "PERDIDO",
          especie: "PERRO",
          raza: "LABRADOR RETRIEVER",
          nombreanimal: "FIRULAIS",
          sexo: "MACHO",
          tamaño: "GRANDE",
          color: "NEGRO",
          edad: "ADULTO",
          localidad: "SAN MIGUEL DE TUCUMAN",
          lugar: "PARQUE 9 DE JULIO",
          fecha: "2026-03-19",
          whatsapp: "3812345678901",
          img: "https://res.cloudinary.com/demo/image/upload/test.jpg",
        },
        usuarioId: user._id,
        correo: user.correo,
        ip: "::1",
      });
      expect(result.publicacion.estado).toBe("SE BUSCA");
    });

    test("asigna estado defecto ENCONTRADO → BUSCANDO A SU FAMILIA", async () => {
      const user = await createUser();
      const result = await publicacionService.crearPublicacion({
        body: {
          tipo: "ENCONTRADO",
          especie: "PERRO",
          raza: "LABRADOR RETRIEVER",
          nombreanimal: "FIRULAIS",
          sexo: "MACHO",
          tamaño: "GRANDE",
          color: "NEGRO",
          edad: "ADULTO",
          localidad: "SAN MIGUEL DE TUCUMAN",
          lugar: "PARQUE 9 DE JULIO",
          fecha: "2026-03-19",
          whatsapp: "3812345678901",
          img: "https://res.cloudinary.com/demo/image/upload/test.jpg",
        },
        usuarioId: user._id,
        correo: user.correo,
        ip: "::1",
      });
      expect(result.publicacion.estado).toBe("BUSCANDO A SU FAMILIA");
    });

    test("asigna estado defecto ADOPCION → EN BUSCA DE UN HOGAR", async () => {
      const user = await createUser();
      const result = await publicacionService.crearPublicacion({
        body: {
          tipo: "ADOPCION",
          especie: "PERRO",
          raza: "LABRADOR RETRIEVER",
          nombreanimal: "FIRULAIS",
          sexo: "MACHO",
          tamaño: "GRANDE",
          color: "NEGRO",
          edad: "ADULTO",
          afinidad: "ALTA",
          afinidadanimales: "MEDIA",
          energia: "ALTA",
          castrado: true,
          whatsapp: "3812345678901",
          img: "https://res.cloudinary.com/demo/image/upload/test.jpg",
        },
        usuarioId: user._id,
        correo: user.correo,
        ip: "::1",
      });
      expect(result.publicacion.estado).toBe("EN BUSCA DE UN HOGAR");
    });

    test("normaliza los campos a mayúsculas antes de guardar", async () => {
      const user = await createUser();
      const result = await publicacionService.crearPublicacion({
        body: {
          tipo: "perdido",
          especie: "perro",
          raza: "labrador retriever",
          nombreanimal: "firulais",
          sexo: "macho",
          tamaño: "grande",
          color: "negro",
          edad: "adulto",
          localidad: "san miguel de tucuman",
          lugar: "parque 9 de julio",
          fecha: "2026-03-19",
          whatsapp: "3812345678901",
          img: "https://res.cloudinary.com/demo/image/upload/test.jpg",
        },
        usuarioId: user._id,
        correo: user.correo,
        ip: "::1",
      });
      expect(result.publicacion.tipo).toBe("PERDIDO");
      expect(result.publicacion.raza).toBe("LABRADOR RETRIEVER");
    });

    test("no hereda el estado que venga en el body", async () => {
      const user = await createUser();
      const result = await publicacionService.crearPublicacion({
        body: {
          tipo: "PERDIDO",
          especie: "PERRO",
          raza: "LABRADOR RETRIEVER",
          nombreanimal: "FIRULAIS",
          sexo: "MACHO",
          tamaño: "GRANDE",
          color: "NEGRO",
          edad: "ADULTO",
          localidad: "SAN MIGUEL DE TUCUMAN",
          lugar: "PARQUE 9 DE JULIO",
          fecha: "2026-03-19",
          whatsapp: "3812345678901",
          img: "https://res.cloudinary.com/demo/image/upload/test.jpg",
          estado: "ADOPTADO", // intento inyección
        },
        usuarioId: user._id,
        correo: user.correo,
        ip: "::1",
      });
      expect(result.publicacion.estado).toBe("SE BUSCA");
    });

    test("no persiste localidad/lugar/fecha en publicación ADOPCION", async () => {
      const user = await createUser();
      const result = await publicacionService.crearPublicacion({
        body: {
          tipo: "ADOPCION",
          especie: "PERRO",
          raza: "LABRADOR RETRIEVER",
          nombreanimal: "FIRULAIS",
          sexo: "MACHO",
          tamaño: "GRANDE",
          color: "NEGRO",
          edad: "ADULTO",
          afinidad: "ALTA",
          afinidadanimales: "MEDIA",
          energia: "ALTA",
          castrado: true,
          localidad: "SAN MIGUEL DE TUCUMAN",
          lugar: "PARQUE 9 DE JULIO",
          fecha: "2026-03-19",
          whatsapp: "3812345678901",
          img: "https://res.cloudinary.com/demo/image/upload/test.jpg",
        },
        usuarioId: user._id,
        correo: user.correo,
        ip: "::1",
      });
      expect(result.publicacion.localidad).toBeUndefined();
      expect(result.publicacion.lugar).toBeUndefined();
    });
  });

  // ─── getPublicaciones ────────────────────────────────────────────────────────
  describe("getPublicaciones", () => {
    test("excluye publicaciones con estado INACTIVO", async () => {
      const user = await createUser();
      await createPublicacion(user._id, { estado: "INACTIVO" });
      await createPublicacion(user._id, { estado: "SE BUSCA" });

      const result = await publicacionService.getPublicaciones({});
      expect(result.total).toBe(1);
      result.publicaciones.forEach((p) => expect(p.estado).not.toBe("INACTIVO"));
    });

    test("filtra por tipo correctamente", async () => {
      const user = await createUser();
      await createPublicacion(user._id, { tipo: "PERDIDO", estado: "SE BUSCA" });
      await createPublicacion(user._id, { tipo: "ENCONTRADO", estado: "BUSCANDO A SU FAMILIA" });

      const result = await publicacionService.getPublicaciones({ tipo: "PERDIDO" });
      expect(result.total).toBe(1);
      expect(result.publicaciones[0].tipo).toBe("PERDIDO");
    });

    test("paginación retorna el total correcto", async () => {
      const user = await createUser();
      for (let i = 0; i < 5; i++) {
        await createPublicacion(user._id, { estado: "SE BUSCA" });
      }
      const result = await publicacionService.getPublicaciones({ page: 1, limit: 2 });
      expect(result.total).toBe(5);
      expect(result.publicaciones).toHaveLength(2);
      expect(result.totalPages).toBe(3);
    });

    test("filtra por raza y retorna solo los que coinciden", async () => {
      const user = await createUser();
      await createPublicacion(user._id, { raza: "GOLDEN RETRIEVER", estado: "SE BUSCA" });
      await createPublicacion(user._id, { raza: "MESTIZO", estado: "SE BUSCA" });

      const result = await publicacionService.getPublicaciones({ raza: "golden retriever" });
      expect(result.total).toBe(1);
      expect(result.publicaciones[0].raza).toBe("GOLDEN RETRIEVER");
    });

    test("filtra por sexo y retorna solo los que coinciden", async () => {
      const user = await createUser();
      await createPublicacion(user._id, { sexo: "MACHO", estado: "SE BUSCA" });
      await createPublicacion(user._id, { sexo: "HEMBRA", estado: "SE BUSCA" });

      const result = await publicacionService.getPublicaciones({ sexo: "hembra" });
      expect(result.total).toBe(1);
      expect(result.publicaciones[0].sexo).toBe("HEMBRA");
    });

    test("filtra por edad y retorna solo los que coinciden", async () => {
      const user = await createUser();
      await createPublicacion(user._id, { edad: "CACHORRO", estado: "SE BUSCA" });
      await createPublicacion(user._id, { edad: "ADULTO", estado: "SE BUSCA" });

      const result = await publicacionService.getPublicaciones({ edad: "cachorro" });
      expect(result.total).toBe(1);
      expect(result.publicaciones[0].edad).toBe("CACHORRO");
    });

    test("filtra por localidad en publicaciones PERDIDO/ENCONTRADO", async () => {
      const user = await createUser();
      await createPublicacion(user._id, {
        localidad: "SAN MIGUEL DE TUCUMAN",
        estado: "SE BUSCA",
      });
      await createPublicacion(user._id, { localidad: "LULES", estado: "SE BUSCA" });

      const result = await publicacionService.getPublicaciones({ localidad: "lules" });
      expect(result.total).toBe(1);
      expect(result.publicaciones[0].localidad).toBe("LULES");
    });

    test("combinación tipo + raza + sexo reduce correctamente el resultado", async () => {
      const user = await createUser();
      await createPublicacion(user._id, {
        tipo: "PERDIDO",
        raza: "MESTIZO",
        sexo: "MACHO",
        estado: "SE BUSCA",
      });
      await createPublicacion(user._id, {
        tipo: "PERDIDO",
        raza: "MESTIZO",
        sexo: "HEMBRA",
        estado: "SE BUSCA",
      });
      await createPublicacion(user._id, {
        tipo: "PERDIDO",
        raza: "GOLDEN RETRIEVER",
        sexo: "MACHO",
        estado: "SE BUSCA",
      });

      const result = await publicacionService.getPublicaciones({
        tipo: "perdido",
        raza: "mestizo",
        sexo: "macho",
      });
      expect(result.total).toBe(1);
    });
  });

  // ─── getPublicacion ──────────────────────────────────────────────────────────
  describe("getPublicacion", () => {
    test("no incluye el campo whatsapp en la respuesta", async () => {
      const user = await createUser();
      const pub = await createPublicacion(user._id, { estado: "SE BUSCA" });

      const result = await publicacionService.getPublicacion({ id: pub._id.toString() });
      expect(result.publicacion.whatsapp).toBeUndefined();
    });

    test("lanza 404 para publicación INACTIVO", async () => {
      const user = await createUser();
      const pub = await createPublicacion(user._id, { estado: "INACTIVO" });
      await expect(publicacionService.getPublicacion({ id: pub._id.toString() })).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // ─── actualizarPublicacion ───────────────────────────────────────────────────
  describe("actualizarPublicacion", () => {
    test("no permite cambiar el tipo", async () => {
      const user = await createUser();
      const pub = await createPublicacion(user._id, { tipo: "PERDIDO", estado: "SE BUSCA" });

      await publicacionService.actualizarPublicacion({
        id: pub._id.toString(),
        body: { tipo: "ADOPCION", color: "BLANCO" },
        usuarioActual: user,
      });

      const inDB = await Publicacion.findById(pub._id);
      expect(inDB.tipo).toBe("PERDIDO");
    });

    test("no permite cambiar el estado vía actualizar", async () => {
      const user = await createUser();
      const pub = await createPublicacion(user._id, { tipo: "PERDIDO", estado: "SE BUSCA" });

      await publicacionService.actualizarPublicacion({
        id: pub._id.toString(),
        body: { estado: "ADOPTADO", color: "BLANCO" },
        usuarioActual: user,
      });

      const inDB = await Publicacion.findById(pub._id);
      expect(inDB.estado).toBe("SE BUSCA");
    });

    test("403 para usuario que intenta editar publicación ajena", async () => {
      const owner = await createUser();
      const other = await createUser();
      const pub = await createPublicacion(owner._id, { estado: "SE BUSCA" });

      await expect(
        publicacionService.actualizarPublicacion({
          id: pub._id.toString(),
          body: { color: "BLANCO" },
          usuarioActual: other,
        })
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  // ─── eliminarPublicacion ──────────────────────────────────────────────────────
  describe("eliminarPublicacion", () => {
    test("elimina el documento de la DB", async () => {
      const user = await createUser();
      const pub = await createPublicacion(user._id, { estado: "SE BUSCA" });

      await publicacionService.eliminarPublicacion({
        id: pub._id.toString(),
        usuarioActual: user,
        correo: user.correo,
        ip: "::1",
      });

      const inDB = await Publicacion.findById(pub._id);
      expect(inDB).toBeNull();
    });

    test("403 si quiere eliminar publicación ajena sin ser admin", async () => {
      const owner = await createUser();
      const other = await createUser();
      const pub = await createPublicacion(owner._id, { estado: "SE BUSCA" });

      await expect(
        publicacionService.eliminarPublicacion({
          id: pub._id.toString(),
          usuarioActual: other,
          correo: other.correo,
          ip: "::1",
        })
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  // ─── getContacto ─────────────────────────────────────────────────────────────
  describe("getContacto", () => {
    test("retorna el whatsapp de la publicación", async () => {
      const user = await createUser();
      const pub = await createPublicacion(user._id, { estado: "SE BUSCA", whatsapp: "3812345678901" });

      const result = await publicacionService.getContacto({ id: pub._id.toString() });
      expect(result.whatsapp).toBe("3812345678901");
    });

    test("404 si la publicación está INACTIVO", async () => {
      const user = await createUser();
      const pub = await createPublicacion(user._id, { estado: "INACTIVO" });
      await expect(publicacionService.getContacto({ id: pub._id.toString() })).rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
