import { cache } from "react";
import { cargarTenant } from "./cargar";

/** Igual que `cargarTenant`, pero se lee una sola vez por petición aunque layout y página lo pidan. */
export const obtenerTenant = cache((slug: string) => cargarTenant(slug));
