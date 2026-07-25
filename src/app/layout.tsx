import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const dmSans = localFont({
  src: "./fonts/dm-sans-latin.woff2",
  variable: "--font-dm-sans",
  weight: "400 700",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

const inter = localFont({
  src: "./fonts/inter-latin.woff2",
  variable: "--font-inter",
  weight: "400 600",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Manzana - Tu dinero, claro",
  description: "Registra, entiende y controla tus finanzas personales con inteligencia.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${dmSans.variable} ${inter.variable} h-full`}
    >
      <body
        style={
          {
            "--font-family-heading": "var(--font-dm-sans), system-ui, sans-serif",
            "--font-family-body": "var(--font-inter), system-ui, sans-serif",
          } as React.CSSProperties
        }
        className="min-h-full flex flex-col"
      >
        {children}
      </body>
    </html>
  );
}
