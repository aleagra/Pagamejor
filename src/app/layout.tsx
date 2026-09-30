import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "@/styles/globals.css";
import { MotionProvider } from "@/components/MotionProvider";

// Sans geométrica y muy legible (recomendada en las reglas de UI), igual en todos los dispositivos
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

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
  themeColor: "#F7F7F5",
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
    <html lang="es" className={jakarta.variable}>
      <body>
        <MotionProvider>
          <div className="min-h-screen flex flex-col">{children}</div>
        </MotionProvider>
      </body>
    </html>
  );
}
