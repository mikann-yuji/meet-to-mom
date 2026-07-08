import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meet To Mom",
  description: "A small Phaser prototype about a state-changing cat."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
