import type { Metadata, Viewport } from "next";
import { Geist, Schibsted_Grotesk } from "next/font/google";
import { urlBase } from "@/lib/enlaces";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Voz de los títulos: una sola fuente variable (pesos 400 a 900), cargada sin bloquear el texto
const schibsted = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(urlBase()),
  title: "Reservas en línea",
  description: "Agenda tu cita en línea, rápido y desde el celular.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-CO" className={`${geistSans.variable} ${schibsted.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
