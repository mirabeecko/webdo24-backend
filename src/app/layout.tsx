import type { Metadata } from "next";
import "./globals.css";
import AuthGuard from "@/components/auth/AuthGuard";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "Webdo24 - Admin",
  description: "Webdo24 backend and admin system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <ToastProvider>
          <AuthGuard>{children}</AuthGuard>
        </ToastProvider>
      </body>
    </html>
  );
}
