import type { Metadata } from "next";
import { Titillium_Web, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const titillium = Titillium_Web({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-sans",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "F1 Dash | Live Timing Dashboard",
  description:
    "Real-time Formula 1 timing, strategy, and analysis dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${titillium.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-bg-primary text-white font-sans antialiased min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
