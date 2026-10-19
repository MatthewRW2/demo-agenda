import { describe, expect, it } from "vitest";
import { esDireccionLocal, problemaDeImagenOg } from "./despliegue";

const PUBLICA = "https://demo-agenda.vercel.app";

describe("esDireccionLocal", () => {
  it.each([
    ["http://localhost:3000", true],
    ["http://localhost", true],
    ["http://127.0.0.1:3139/", true],
    ["https://demo-agenda.vercel.app", false],
    ["https://localhost.miempresa.com", false],
    ["https://127.0.0.1.nip.io", false],
  ])("%s -> %s", (base, esperado) => {
    expect(esDireccionLocal(base)).toBe(esperado);
  });
});

describe("problemaDeImagenOg", () => {
  it("una imagen absoluta en la misma dirección está bien", () => {
    expect(problemaDeImagenOg(`${PUBLICA}/don-carlos/opengraph-image?f=1`, PUBLICA)).toBeNull();
    expect(problemaDeImagenOg(`${PUBLICA}/x.png`, `${PUBLICA}/`)).toBeNull();
  });

  it("detecta el error más común: la imagen apunta a localhost en un despliegue público", () => {
    const p = problemaDeImagenOg("http://localhost:3000/don-carlos/opengraph-image", PUBLICA);
    expect(p).toMatch(/apunta a localhost/);
    expect(p).toMatch(/APP_URL/);
  });

  it("detecta una imagen en otro dominio, y que 'empiece parecido' no cuenta", () => {
    expect(problemaDeImagenOg("https://otro.com/x.png", PUBLICA)).toMatch(/no está en/);
    expect(problemaDeImagenOg("https://demo-agenda.vercel.app.malo.com/x.png", PUBLICA)).toMatch(
      /no está en/,
    );
  });

  it("detecta que falte o sea relativa", () => {
    expect(problemaDeImagenOg(null, PUBLICA)).toBe("falta og:image");
    expect(problemaDeImagenOg("/don-carlos/opengraph-image", PUBLICA)).toMatch(/no es absoluta/);
  });

  it("en local acepta cualquier URL absoluta", () => {
    expect(problemaDeImagenOg("http://localhost:3000/x.png", "http://localhost:3139")).toBeNull();
  });
});
