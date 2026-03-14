// /var/www/transport-dashboard-system/frontend-v3/src/components/ExcelExport.tsx
'use client';
import { useState } from 'react';
import { Download } from 'lucide-react';

interface ExcelExportProps {
  type: string;        // vehicles | fuel | reports | repairs
  label?: string;
  period?: string;     // YYYY-MM for fuel/reports
  className?: string;
}

export default function ExcelExport({ type, label = "Excel", period, className }: ExcelExportProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const params = period ? `?period=${period}` : '';
      const res = await fetch(`/api/export/${type}${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_${period || 'all'}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export error:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className={`flex items-center gap-1.5 px-3 py-1.5 bg-green-600/20 border border-green-600/40 text-green-400 rounded-lg text-sm hover:bg-green-600/30 transition disabled:opacity-50 ${className || ''}`}
    >
      <Download size={14} className={loading ? 'animate-bounce' : ''} />
      {loading ? 'Загрузка...' : label}
    </button>
  );
}
