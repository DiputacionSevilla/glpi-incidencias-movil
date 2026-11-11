import type { Metadata, Viewport } from "next";
import { PwaRegistration } from "@/components/PwaRegistration";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Incidencias", template: "%s | Incidencias" },
  description: "Gestion movil de incidencias asignadas en GLPI",
  applicationName: "Incidencias",
  appleWebApp: { capable: true, title: "Incidencias", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b5cad",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <PwaRegistration />
        {children}
      </body>
    </html>
  );
}
