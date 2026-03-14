"use client";
import { useEffect } from "react";

export default function ReportError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Report page error:", error); }, [error]);
  return (
    <div className="p-6 text-white">
      <h2 className="text-xl font-bold text-red-400 mb-4">Ошибка загрузки отчёта</h2>
      <pre className="bg-slate-800 p-4 rounded text-sm overflow-auto max-h-96 text-red-300 mb-4">{error.message}\n\n{error.stack}</pre>
      <button onClick={reset} className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500">Попробовать снова</button>
    </div>
  );
}
