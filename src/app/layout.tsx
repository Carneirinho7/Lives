import type { Metadata } from "next";
import "@/frontend/styles/globals.css";

export const metadata: Metadata = {
  title: "LiveLoot — entre na sua conta",
  description: "Entre no LiveLoot para acompanhar suas lives favoritas.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
