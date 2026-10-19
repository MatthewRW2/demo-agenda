import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  DURACION_SESION_S,
  contrasenaCorrecta,
  crearTokenSesion,
  nombreCookie,
  verificarTokenSesion,
} from "./sesion";

const AHORA = new Date("2030-03-01T15:00:00Z");
const PASS = "clave-secreta";

describe("contrasenaCorrecta", () => {
  it("acepta solo la contraseña exacta", () => {
    expect(contrasenaCorrecta(PASS, PASS)).toBe(true);
    expect(contrasenaCorrecta("clave-secret", PASS)).toBe(false);
    expect(contrasenaCorrecta(`${PASS} `, PASS)).toBe(false);
    expect(contrasenaCorrecta("", PASS)).toBe(false);
  });

  it("si no hay contraseña configurada, nada es válido (ni siquiera vacío)", () => {
    expect(contrasenaCorrecta("", "")).toBe(false);
    expect(contrasenaCorrecta("algo", "")).toBe(false);
  });
});

describe("token de sesión", () => {
  const token = crearTokenSesion("don-carlos", PASS, AHORA);

  it("es válido para su negocio durante 7 días", () => {
    expect(verificarTokenSesion(token, "don-carlos", PASS, AHORA)).toBe(true);
    const casiVencido = new Date(AHORA.getTime() + (DURACION_SESION_S - 5) * 1000);
    expect(verificarTokenSesion(token, "don-carlos", PASS, casiVencido)).toBe(true);
  });

  it("vence", () => {
    const vencido = new Date(AHORA.getTime() + (DURACION_SESION_S + 1) * 1000);
    expect(verificarTokenSesion(token, "don-carlos", PASS, vencido)).toBe(false);
  });

  it("no sirve para otro negocio", () => {
    expect(verificarTokenSesion(token, "otro-negocio", PASS, AHORA)).toBe(false);
  });

  it("se invalida si cambia la contraseña", () => {
    expect(verificarTokenSesion(token, "don-carlos", "otra-clave", AHORA)).toBe(false);
  });

  it("rechaza tokens alterados, incompletos o vacíos", () => {
    const [carga, firma] = token.split(".");
    // alterar la carga (p. ej. extender la expiración) rompe la firma
    const falsa = Buffer.from(JSON.stringify({ s: "don-carlos", e: 9_999_999_999 })).toString(
      "base64url",
    );
    expect(verificarTokenSesion(`${falsa}.${firma}`, "don-carlos", PASS, AHORA)).toBe(false);
    expect(verificarTokenSesion(`${carga}.${firma}x`, "don-carlos", PASS, AHORA)).toBe(false);
    expect(verificarTokenSesion(`${carga}.${firma}.extra`, "don-carlos", PASS, AHORA)).toBe(false);
    expect(verificarTokenSesion(carga, "don-carlos", PASS, AHORA)).toBe(false);
    expect(verificarTokenSesion("", "don-carlos", PASS, AHORA)).toBe(false);
    expect(verificarTokenSesion(undefined, "don-carlos", PASS, AHORA)).toBe(false);
    expect(verificarTokenSesion("basura", "don-carlos", PASS, AHORA)).toBe(false);
  });

  it("sin contraseña configurada ningún token vale (falla cerrada)", () => {
    expect(
      verificarTokenSesion(crearTokenSesion("don-carlos", "", AHORA), "don-carlos", "", AHORA),
    ).toBe(false);
  });

  it("una carga con firma válida pero contenido inválido se rechaza sin lanzar error", () => {
    // Se firma de verdad con la misma clave: el rechazo debe venir del contenido, no de la firma.
    const firmaReal = (carga: string) =>
      createHmac("sha256", createHash("sha256").update(`admin-session:${PASS}`).digest())
        .update(carga)
        .digest("base64url");
    const casos = [
      Buffer.from("no es json").toString("base64url"),
      Buffer.from(JSON.stringify({ s: "x" })).toString("base64url"), // sin expiración
      Buffer.from(JSON.stringify({ s: "x", e: "mañana" })).toString("base64url"),
      Buffer.from(JSON.stringify({ s: "otro", e: 9_999_999_999 })).toString("base64url"), // otro negocio
    ];
    for (const carga of casos) {
      expect(verificarTokenSesion(`${carga}.${firmaReal(carga)}`, "x", PASS, AHORA)).toBe(false);
    }
    // y la misma firma sobre una carga correcta sí vale (el helper firma como el código real)
    const buena = Buffer.from(JSON.stringify({ s: "x", e: 9_999_999_999 })).toString("base64url");
    expect(verificarTokenSesion(`${buena}.${firmaReal(buena)}`, "x", PASS, AHORA)).toBe(true);
  });

  it("el nombre de la cookie es por negocio", () => {
    expect(nombreCookie("don-carlos")).toBe("admin_don-carlos");
  });
});
