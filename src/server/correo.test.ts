import { describe, expect, it, vi } from "vitest";
import { codigoReserva, enlaceConfirmarPorWhatsApp, enlaceRecordatorio } from "@/lib/reserva";
import { tenantDePrueba } from "@/test/tenantDePrueba";
import { enviarCorreo, plantillaConfirmacion, remitenteDe } from "./correo";

const datos = {
  tenant: tenantDePrueba,
  nombreCliente: "María <script>alert(1)</script>",
  servicio: "Corte",
  profesional: "Carlos",
  inicio: new Date("2030-03-04T20:00:00Z"),
  codigo: "A3F9C2",
  enlaceGestion: "https://demo.ejemplo.com/prueba/cita/abc",
};

describe("plantillaConfirmacion", () => {
  const c = plantillaConfirmacion(datos);

  it("incluye los datos de la cita y el enlace de gestión", () => {
    expect(c.asunto).toBe("Tu cita en Barbería de Prueba está confirmada");
    for (const parte of [
      "lunes 4 de marzo, 3:00 p. m.",
      "A3F9C2",
      "Calle 1 #2-3, Bogotá",
      "Carlos",
    ]) {
      expect(c.html).toContain(parte);
      expect(c.texto).toContain(parte);
    }
    expect(c.html).toContain('href="https://demo.ejemplo.com/prueba/cita/abc"');
    expect(c.texto).toContain("https://demo.ejemplo.com/prueba/cita/abc");
  });

  it("escapa el HTML que escribe el cliente", () => {
    expect(c.html).not.toContain("<script>");
    expect(c.html).toContain("&lt;script&gt;");
  });
});

describe("enviarCorreo", () => {
  const correo = plantillaConfirmacion(datos);
  const base = { para: "maria@correo.com", remitente: "Negocio <onboarding@resend.dev>", correo };

  it("sin RESEND_API_KEY no llama a la red ni falla", async () => {
    const fetchFn = vi.fn();
    expect(await enviarCorreo({ ...base, env: {}, fetchFn })).toEqual({
      enviado: false,
      motivo: "sin_clave",
    });
    expect(await enviarCorreo({ ...base, env: { RESEND_API_KEY: "  " }, fetchFn })).toEqual({
      enviado: false,
      motivo: "sin_clave",
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("con clave, envía a Resend con el formato esperado", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    expect(await enviarCorreo({ ...base, env: { RESEND_API_KEY: "re_123" }, fetchFn })).toEqual({
      enviado: true,
    });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_123");
    const cuerpo = JSON.parse(init.body);
    expect(cuerpo).toMatchObject({
      from: base.remitente,
      to: ["maria@correo.com"],
      subject: correo.asunto,
    });
  });

  it("si Resend rechaza o la red falla, devuelve el motivo sin lanzar", async () => {
    const silencio = vi.spyOn(console, "error").mockImplementation(() => {});
    const rechaza = vi.fn().mockResolvedValue(new Response("{}", { status: 422 }));
    expect(await enviarCorreo({ ...base, env: { RESEND_API_KEY: "k" }, fetchFn: rechaza })).toEqual(
      {
        enviado: false,
        motivo: "rechazado",
      },
    );
    const cae = vi.fn().mockRejectedValue(new Error("sin red"));
    expect(await enviarCorreo({ ...base, env: { RESEND_API_KEY: "k" }, fetchFn: cae })).toEqual({
      enviado: false,
      motivo: "error",
    });
    silencio.mockRestore();
  });
});

describe("remitenteDe", () => {
  it("usa RESEND_FROM o el remitente de pruebas con el nombre del negocio, sin caracteres peligrosos", () => {
    expect(remitenteDe(tenantDePrueba, { RESEND_FROM: "Reservas <hola@miempresa.co>" })).toBe(
      "Reservas <hola@miempresa.co>",
    );
    expect(remitenteDe(tenantDePrueba, {})).toBe("Barbería de Prueba <onboarding@resend.dev>");
    expect(remitenteDe({ ...tenantDePrueba, nombre: 'Mal "Nombre" <x>' }, {})).toBe(
      "Mal Nombre x <onboarding@resend.dev>",
    );
  });
});

describe("reserva", () => {
  it("el código son 6 caracteres en mayúsculas", () => {
    expect(codigoReserva("a3f9c2d1-0000-4000-8000-000000000000")).toBe("A3F9C2");
  });

  it("el enlace de WhatsApp lleva el mensaje de confirmación", () => {
    const url = new URL(
      enlaceConfirmarPorWhatsApp({
        tenant: tenantDePrueba,
        nombreCliente: "María",
        servicio: "Corte",
        profesional: "Carlos",
        inicio: new Date("2030-03-04T20:00:00Z"),
        codigo: "A3F9C2",
      }),
    );
    expect(url.origin + url.pathname).toBe("https://wa.me/573001234567");
    const texto = url.searchParams.get("text");
    expect(texto).toContain("Hola, soy María");
    expect(texto).toContain("lunes 4 de marzo, 3:00 p. m.");
    expect(texto).toContain("Código: A3F9C2");
  });
});

describe("enlaceRecordatorio", () => {
  const base = {
    tenant: tenantDePrueba,
    nombreCliente: "María Fernanda Pérez",
    celular: "3001234567",
    hora: "3:00 p. m.",
    enlaceGestion: "https://demo.ejemplo.com/prueba/cita/abc",
  };

  it("va al celular del cliente con el mensaje del recordatorio y el enlace de gestión", () => {
    const url = new URL(enlaceRecordatorio(base)!);
    expect(url.origin + url.pathname).toBe("https://wa.me/573001234567");
    expect(url.searchParams.get("text")).toBe(
      "Hola María, te recordamos tu cita mañana a las 3:00 p. m. en Barbería de Prueba. " +
        "Si no puedes asistir, cámbiala o cancélala aquí: https://demo.ejemplo.com/prueba/cita/abc",
    );
  });

  it("sin celular no hay enlace", () => {
    expect(enlaceRecordatorio({ ...base, celular: "" })).toBeNull();
  });
});
