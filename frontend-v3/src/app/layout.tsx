import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/components/QueryProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { AppLayout } from "@/components/AppLayout";

export const metadata: Metadata = {
  title: "TL196 - Экономика автопарка",
  description: "Система управления логистикой",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-slate-950">
        <QueryProvider>
          <AuthProvider>
            <AppLayout>{children}</AppLayout>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
