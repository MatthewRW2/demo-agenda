import { describe, expect, it } from "vitest";
import { contactoPublico, enlaceContacto, enlaceInstagramContacto } from "./contacto";

const base = {
  nombre: "Barbería Don Carlos",
  whatsapp: "573001234567", // de relleno: en una demo nunca debe salir
  instagram: "barberiadoncarlos", // de relleno: en una demo nunca debe salir
};

describe("contactoPublico", () => {
  it("un negocio real contacta al negocio, con el mensaje que se pida", () => {
    const t = { ...base, demo: false };
    expect(enlaceContacto(t, "Hola, quiero una cita.")).toBe(
      "https://wa.me/573001234567?text=Hola%2C%20quiero%20una%20cita.",
    );
    expect(enlaceInstagramContacto(t)).toBe("https://www.instagram.com/barberiadoncarlos/");
  });

  it("una demo con contactoDemo escribe a ese número con el mensaje de la demo", () => {
    const t = {
      ...base,
      demo: true,
      contactoDemo: { nombre: "Mateo", whatsapp: "573109998877" },
    };
    const url = new URL(enlaceContacto(t, "Hola, quiero una cita.")!);
    expect(url.origin + url.pathname).toBe("https://wa.me/573109998877");
    expect(url.searchParams.get("text")).toBe(
      "Hola Mateo, vi la demo de Barbería Don Carlos y quiero una para mi negocio",
    );
  });

  it("una demo sin nombre saluda sin nombre", () => {
    const t = { ...base, demo: true, contactoDemo: { whatsapp: "573109998877" } };
    const url = new URL(enlaceContacto(t, "x")!);
    expect(url.searchParams.get("text")).toBe(
      "Hola, vi la demo de Barbería Don Carlos y quiero una para mi negocio",
    );
  });

  it("una demo sin contactoDemo no ofrece ningún contacto: nunca el número ni el usuario del JSON", () => {
    const t = { ...base, demo: true };
    expect(contactoPublico(t).whatsapp).toBeUndefined();
    expect(enlaceContacto(t, "x")).toBeUndefined();
    expect(enlaceInstagramContacto(t)).toBeUndefined();
  });

  it("una demo usa el Instagram de contactoDemo y nunca el del JSON", () => {
    const sin = { ...base, demo: true, contactoDemo: { whatsapp: "573109998877" } };
    expect(enlaceInstagramContacto(sin)).toBeUndefined();
    const con = {
      ...base,
      demo: true,
      contactoDemo: { whatsapp: "573109998877", instagram: "mi.perfil" },
    };
    expect(enlaceInstagramContacto(con)).toBe("https://www.instagram.com/mi.perfil/");
  });
});
