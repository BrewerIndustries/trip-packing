import type { Metadata, Viewport } from "next";
import Nav from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trip Packing",
  description: "Packing lists by trip type — reusable lists, per-trip checklists, ad hoc extras.",
  appleWebApp: { capable: true, title: "Packing", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f3ef" },
    { media: "(prefers-color-scheme: dark)", color: "#141412" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const isDev = process.env.JARVIS_ENV === "dev";
  return (
    <html lang="en">
      <body>
        {isDev && <div className="env-banner">Development · this is the dev site</div>}
        <Nav />
        <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-4">{children}</main>
      </body>
    </html>
  );
}
