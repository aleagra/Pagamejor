import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "PagaMejor | ¿Con qué tarjeta conviene pagar hoy?",
  description: "Descubrí al instante con qué tarjeta o billetera virtual te conviene pagar hoy en Argentina para maximizar tus descuentos bancarios.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#FBF9F5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <div className="w-full max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 min-h-screen flex flex-col justify-between">
          {children}
        </div>
      </body>
    </html>
  );
}
