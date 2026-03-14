import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/components/QueryProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { AppLayout } from "@/components/AppLayout";
import { ErrorTracker } from "@/shared/components/ErrorTracker";
import { BugReport } from "@/shared/components/BugReport";
import { AiChat } from "@/shared/components/AiChat";
import { RouteGuard } from "@/shared/components/RouteGuard";

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
      <head>
      </head>
      <body className="min-h-screen bg-slate-950">
        <QueryProvider>
          <AuthProvider>
            <ErrorTracker />
            <RouteGuard>
              <AppLayout>{children}</AppLayout>
            </RouteGuard>
            {/* <BugReport /> */}
            {/* <AiChat /> */}
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
