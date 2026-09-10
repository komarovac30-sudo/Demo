import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Veloura — Client Demo",
  description: "Premium public profile, private digital content, reviews and visitor intelligence demo.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
