import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Incidencias GLPI",
    short_name: "Incidencias",
    description: "Gestion movil de incidencias asignadas",
    start_url: "/incidencias",
    display: "standalone",
    background_color: "#f4f6f8",
    theme_color: "#0b5cad",
    lang: "es",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
