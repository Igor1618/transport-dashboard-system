"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, TrendingUp, Fuel, Users, FileText } from "lucide-react";

const SUPABASE_URL = "";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxdnR2b2NzcWhemFyYWtudm56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE2NjkxMDcsImV4cCI6MjA0NzI0NTEwN30.f3qnR6VfPvNjWiMfCPLiPbHr4UkPK8eDHzBxbRNJvXw";

async function fetchVehicleData(vehicleNumber: string) {
  const [economics, contracts, trips, reports] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/vehicle_economics_combined?vehicle_number=eq.${encodeURIComponent(vehicleNumber)}&order=month.desc&limit=12`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    }).then(r => r.json()),
    fetch(`${SUPABASE_URL}/rest/v1/contracts?vehicle_number=eq.${encodeURIComponent(vehicleNumber)}&order=date.desc&limit=20`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    }).then(r => r.json()),
    fetch(`${SUPABASE_URL}/rest/v1/trips?vehicle_number=eq.${encodeURIComponent(vehicleNumber)}&order=loading_date.desc&limit=20`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    }).then(r => r.json()),
    fetch(`${SUPABASE_URL}/rest/v1/driver_reports?vehicle_number=eq.${encodeURIComponent(vehicleNumber)}&order=date_from.desc&limit=12`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    }).then(r => r.json()),
  ]);
  return { economics, contracts, trips, reports };
}

function formatMoney(n: number) {
  if (!n) return "0 ₽";
  return n.toLocaleString("ru-RU") + " ₽";
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("ru-RU");
}

export default function VehiclePage() {
  const params = useParams();
  const vehicleNumber = decodeURIComponent(params.id as string);

  const { data, isLoading } = useQuery({
    queryKey: ["vehicle", vehicleNumber],
    queryFn: () => fetchVehicleData(vehicleNumber),
  });

  if (isLoading) return <div className="text-slate-400">Загрузка...</div>;

  const totals = data?.economics?.reduce((acc: any, e: any) => ({
    revenue: acc.revenue + (e.total_revenue || 0),
    expenses: acc.expenses + (e.expenses || 0),
    margin: acc.margin + (e.margin || 0),
    mileage: acc.mileage + (e.mileage || 0),
    fuel: acc.fuel + (e.fuel_cost || 0),
  }), { revenue: 0, expenses: 0, margin: 0, mileage: 0, fuel: 0 }) || {};

  const drivers = [...new Set(data?.reports?.map((r: any) => r.driver_name).filter(Boolean))];

  return (
    <div>
      <Link href="/vehicles" className="flex items-center gap-2 text-slate-400 hover:text-white mb-4">
        <ArrowLeft className="w-4 h-4" /> Назад к машинам
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">{vehicleNumber}</h1>
        <p className="text-slate-400">Детальная статистика машины</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <TrendingUp className="w-4 h-4" /> Выручка (год)
          </div>
          <div className="text-2xl font-bold text-blue-400">{formatMoney(totals.revenue)}</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <Fuel className="w-4 h-4" /> Расходы
          </div>
          <div className="text-2xl font-bold text-yellow-400">{formatMoney(totals.expenses)}</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <TrendingUp className="w-4 h-4" /> Маржа
          </div>
          <div className={`text-2xl font-bold ${totals.margin >= 0 ? "text-green-400" : "text-red-400"}`}>
            {formatMoney(totals.margin)}
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <Fuel className="w-4 h-4" /> Топливо
          </div>
          <div className="text-2xl font-bold text-red-400">{formatMoney(totals.fuel)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Водители */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" /> Водители ({drivers.length})
          </h3>
          <div className="space-y-2">
            {drivers.slice(0, 10).map((driver: any) => (
              <div key={driver} className="flex items-center justify-between py-2 border-b border-slate-700">
                <span className="text-slate-300">{driver}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Помесячная экономика */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" /> По месяцам
          </h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {data?.economics?.map((e: any) => (
              <div key={e.month} className="flex items-center justify-between py-2 border-b border-slate-700">
                <span className="text-slate-400">{formatDate(e.month)}</span>
                <div className="flex gap-4">
                  <span className="text-blue-400">{formatMoney(e.total_revenue)}</span>
                  <span className={e.margin >= 0 ? "text-green-400" : "text-red-400"}>
                    {formatMoney(e.margin)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Последние рейсы ТРФ */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" /> Последние рейсы ТРФ
          </h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {data?.contracts?.slice(0, 10).map((c: any) => (
              <div key={c.number} className="py-2 border-b border-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-300">{c.number}</span>
                  <span className="text-blue-400">{formatMoney(c.amount)}</span>
                </div>
                <div className="text-xs text-slate-500">{formatDate(c.date)} • {c.route?.slice(0, 50)}...</div>
              </div>
            ))}
          </div>
        </div>

        {/* Последние рейсы ВБ */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-400" /> Последние рейсы ВБ
          </h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {data?.trips?.slice(0, 10).map((t: any) => (
              <div key={t.wb_trip_number} className="py-2 border-b border-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-300">{t.wb_trip_number}</span>
                  <span className="text-purple-400">{formatMoney(t.trip_amount)}</span>
                </div>
                <div className="text-xs text-slate-500">{formatDate(t.loading_date)} • {t.route_name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
