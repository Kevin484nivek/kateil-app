import type { Metadata } from "next";
import { Antic_Didone } from "next/font/google";

import "./globals.css";

const anticDidone = Antic_Didone({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-heading",
});

export const metadata: Metadata = {
  title: "Kateil Platform",
  description: "Plataforma modular multi-tenant para operaciones de negocio.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={anticDidone.variable}>{children}</body>
    </html>
  );
}
