"use client";
export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="text-6xl">⚠️</div>
      <h2 className="text-xl font-bold text-red-400">Ошибка загрузки страницы</h2>
      <p className="text-slate-400 text-sm max-w-md text-center">{error?.message || "Неизвестная ошибка"}</p>
      <button onClick={reset} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white">
        Попробовать снова
      </button>
    </div>
  );
}
