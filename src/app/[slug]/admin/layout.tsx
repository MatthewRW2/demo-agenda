import type { Metadata } from "next";

// El panel es privado: no se indexa y no se envía como referencia a otros sitios.
export const metadata: Metadata = {
  title: "Panel",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function AdminLayout({ children }: LayoutProps<"/[slug]/admin">) {
  return <>{children}</>;
}
