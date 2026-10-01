import type { Metadata, Viewport } from "next";
import { Instrument_Sans } from "next/font/google";
import "@/styles/globals.css";
import { MotionProvider } from "@/components/MotionProvider";
import { Analytics } from "@vercel/analytics/next";

// Sans cálida y compacta, muy legible en tamaños grandes; igual en todos los dispositivos
const instrument = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
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
  themeColor: "#EEEDE8",
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
    <html lang="es" className={instrument.variable}>
      <body>
        <MotionProvider>
          <div className="min-h-screen flex flex-col">{children}</div>
        </MotionProvider>
        {/* Visitas anónimas de Vercel (sin cookies ni datos personales); solo envía datos en producción */}
        <Analytics />
      </body>
    </html>
  );
}
