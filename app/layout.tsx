import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CreatorSpace Demo",
  description: "A clean creator profile and access demo platform",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
