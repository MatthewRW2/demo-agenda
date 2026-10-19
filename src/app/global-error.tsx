"use client";

/** Último recurso: un error en el layout raíz. Define su propio <html> y no usa los estilos globales. */
export default function ErrorGlobal({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="es-CO">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: 16,
          color: "#171717",
        }}
      >
        <main style={{ maxWidth: 360 }}>
          <h1 style={{ fontSize: 24 }}>Algo no salió como esperábamos</h1>
          <p style={{ color: "#404040" }}>Inténtalo de nuevo en unos segundos.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              minHeight: 48,
              padding: "0 20px",
              fontSize: 16,
              fontWeight: 700,
              borderRadius: 12,
              border: "2px solid #171717",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Intentar de nuevo
          </button>
        </main>
      </body>
    </html>
  );
}
