import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { OfflineBanner } from "@/components/OfflineBanner";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "QR-Dine | Smart Restaurant Ordering",
  description: "Scan, Order, Enjoy - QR-based dine-in ordering system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${jakarta.className} antialiased bg-stone-50 text-stone-900`}>
        <OfflineBanner />
        {children}
      </body>
    </html>
  );
}
