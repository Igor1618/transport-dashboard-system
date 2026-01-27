import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { QueryProvider } from "@/components/QueryProvider";

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
          <Sidebar />
          <main className="pt-14 lg:pt-0 lg:ml-64 p-4 lg:p-6 min-h-screen">
            {children}
          </main>
        </QueryProvider>
      </body>
    </html>
  );
}
