import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "./components/AuthProvider";

export const metadata: Metadata = {
  title: "JOTLayerRaid — Jersey Mockup Manager",
  description: "AI-powered jersey mockup generator & multi-store product publisher",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
