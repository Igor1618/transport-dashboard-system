"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

export function GpsSensorWidget() {
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  React.useEffect(() => { setMounted(true); }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["gps-sensor-status"],
    queryFn: async () => {
      const res = await fetch('/api/validation/sensor-status');
      if (!res.ok) throw new Error('API error');
      return res.json();
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
    enabled: mounted,
  });

  if (!mounted || isLoading || !data) return null;
  
  const { summary, vehicles } = data;
  const problems = vehicles?.filter((v: any) => v.status !== 'ok') || [];
  
  if (problems.length === 0) return null;

  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-yellow-500/30 mb-4">
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-500/20 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <p className="text-white font-medium text-sm">Датчики GPS</p>
            <p className="text-slate-400 text-xs">
              {summary.error > 0 && <span className="text-red-400">{summary.error} без данных</span>}
              {summary.error > 0 && summary.warning > 0 && ' · '}
              {summary.warning > 0 && <span className="text-yellow-400">{summary.warning} без движения 24ч</span>}
              {' · '}<span className="text-green-400">{summary.ok} ок</span>
              {' из '}{summary.total}
            </p>
          </div>
        </div>
        <span className="text-slate-400 text-sm">{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div className="mt-3 space-y-1 max-h-64 overflow-y-auto">
          {problems.map((v: any, i: number) => (
            <div key={i} className={`flex items-center justify-between text-xs px-2 py-1.5 rounded ${
              v.status === 'error' ? 'bg-red-500/10' : 'bg-yellow-500/10'
            }`}>
              <div className="flex items-center gap-2">
                <span className={v.status === 'error' ? 'text-red-400' : 'text-yellow-400'}>
                  {v.status === 'error' ? '❌' : '⚠️'}
                </span>
                <span className="text-white font-medium">{v.vehicle}</span>
                <span className="text-slate-500">{v.vehicle_type}</span>
              </div>
              <span className={v.status === 'error' ? 'text-red-400' : 'text-yellow-400'}>{v.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
