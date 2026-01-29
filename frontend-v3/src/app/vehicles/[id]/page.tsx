"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Fuel, Truck, MapPin, Wallet, Users, Package } from "lucide-react";
import { useState } from "react";

async function safeFetch(url: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

async function fetchVehicleData(vehicleNumber: string, month: string) {
  const [year, mon] = month.split('-');
  const startDate = `${year}-${mon}-01`;
  const endDate = new Date(parseInt(year), parseInt(mon), 0).toISOString().split('T')[0];
  const monthStart = `${year}-${mon}-01`;

  const [economics, contracts, trips, reports, allReports] = await Promise.all([
    safeFetch(`/rest/v1/vehicle_economics_combined?vehicle_number=eq.${encodeURIComponent(vehicleNumber)}&month=eq.${monthStart}`),
    safeFetch(`/rest/v1/contracts?vehicle_number=eq.${encodeURIComponent(vehicleNumber)}&date=gte.${startDate}&date=lte.${endDate}T23:59:59&order=date.desc&limit=50`),
    safeFetch(`/rest/v1/trips?vehicle_number=eq.${encodeURIComponent(vehicleNumber)}&loading_date=gte.${startDate}&loading_date=lte.${endDate}&order=loading_date.desc&limit=100`),
    safeFetch(`/rest/v1/driver_reports?vehicle_number=eq.${encodeURIComponent(vehicleNumber)}&date_to=gte.${startDate}&date_to=lte.${endDate}&order=date_from.desc&limit=50`),
    safeFetch(`/rest/v1/driver_reports?vehicle_number=eq.${encodeURIComponent(vehicleNumber)}&order=date_from.desc&limit=100`),
  ]);
  return { economics: economics[0] || null, contracts, trips, reports, allReports };
}

function formatMoney(n: number): string {
  if (!n) return "0 ₽";
  if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1) + "M ₽";
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(0) + "К ₽";
  return n.toLocaleString("ru-RU") + " ₽";
}

function formatDate(d: string): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("ru-RU");
}

export default function VehiclePage() {
  const params = useParams();
  const vehicleNumber = decodeURIComponent(params.id as string);
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);

  const { data, isLoading, error } = useQuery({
    queryKey: ["vehicle", vehicleNumber, month],
    queryFn: () => fetchVehicleData(vehicleNumber, month),
  });

  if (isLoading) return <div className="p-6 text-slate-400">Загрузка...</div>;
  if (error) return <div className="p-6 text-red-400">Ошибка загрузки</div>;

  // Данные из economics (агрегированные)
  const eco = data?.economics || {};
  const totalRevenue = eco.total_revenue || 0;
  const wbRevenue = eco.wb_revenue || 0;
  const trfRevenue = eco.trf_revenue || 0;
  const wbTrips = eco.wb_trips || 0;
  const trfTrips = eco.trf_trips || 0;
  const expenses = eco.expenses || 0;
  const margin = eco.margin || 0;
  const fuelCost = eco.fuel_cost || 0;
  const mileage = eco.mileage || 0;

  // Водители из отчётов
  const drivers = data?.allReports 
    ? [...new Set((data.allReports as any[]).map((r) => r.driver_name).filter(Boolean))] as string[]
    : [];

  // Водители из WB trips
  const wbDrivers = data?.trips
    ? [...new Set((data.trips as any[]).map((t) => t.driver_name).filter(Boolean))] as string[]
    : [];
  
  const allDrivers = [...new Set([...drivers, ...wbDrivers])] as string[];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <Link href="/vehicles" className="flex items-center gap-2 text-slate-400 hover:text-white mb-4">
        <ArrowLeft className="w-4 h-4" /> Назад к списку
      </Link>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Truck className="w-6 h-6 text-blue-400" />
            {vehicleNumber}
          </h1>
          <p className="text-slate-400">Детальная статистика машины</p>
        </div>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
        />
      </div>

      {/* Основные показатели */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="text-slate-400 text-xs mb-1">Общая выручка</div>
          <div className="text-xl font-bold text-blue-400">{formatMoney(totalRevenue)}</div>
          <div className="text-slate-500 text-xs">{wbTrips + trfTrips} рейсов</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="text-slate-400 text-xs mb-1">Расходы</div>
          <div className="text-xl font-bold text-red-400">{formatMoney(expenses)}</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="text-slate-400 text-xs mb-1">Маржа</div>
          <div className={`text-xl font-bold ${margin >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatMoney(margin)}
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="text-slate-400 text-xs mb-1">Пробег</div>
          <div className="text-xl font-bold text-purple-400">{mileage.toLocaleString('ru-RU')} км</div>
        </div>
      </div>

      {/* Разбивка по источникам */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* WB */}
        <div className="bg-purple-900/20 rounded-xl p-4 border border-purple-500/30">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-5 h-5 text-purple-400" />
            <span className="text-purple-400 font-medium">Wildberries</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-slate-400 text-xs">Выручка</div>
              <div className="text-lg font-bold text-purple-400">{formatMoney(wbRevenue)}</div>
            </div>
            <div>
              <div className="text-slate-400 text-xs">Рейсов</div>
              <div className="text-lg font-bold text-white">{wbTrips}</div>
            </div>
          </div>
        </div>

        {/* РФ Транспорт */}
        <div className="bg-green-900/20 rounded-xl p-4 border border-green-500/30">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-5 h-5 text-green-400" />
            <span className="text-green-400 font-medium">РФ Транспорт</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-slate-400 text-xs">Выручка</div>
              <div className="text-lg font-bold text-green-400">{formatMoney(trfRevenue)}</div>
            </div>
            <div>
              <div className="text-slate-400 text-xs">Рейсов</div>
              <div className="text-lg font-bold text-white">{trfTrips}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Водители */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-6">
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-400" />
          Водители ({allDrivers.length})
        </h2>
        {allDrivers.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {allDrivers.map((name, i) => (
              <span key={i} className="bg-slate-700 px-3 py-1 rounded-lg text-slate-300 text-sm">
                {name}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-slate-500">Нет данных</div>
        )}
      </div>

      {/* WB Рейсы */}
      {data?.trips && data.trips.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-6">
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Package className="w-5 h-5 text-purple-400" />
            Рейсы Wildberries за {month}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700">
                  <th className="text-left py-2 px-2">Дата</th>
                  <th className="text-left py-2 px-2">Маршрут</th>
                  <th className="text-left py-2 px-2">Водитель</th>
                  <th className="text-right py-2 px-2">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {data.trips.slice(0, 20).map((trip: any, i: number) => (
                  <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="py-2 px-2 text-slate-300">{formatDate(trip.loading_date)}</td>
                    <td className="py-2 px-2 text-slate-300 truncate max-w-[200px]">{trip.route_name || '-'}</td>
                    <td className="py-2 px-2 text-slate-300">{trip.driver_name || '-'}</td>
                    <td className="py-2 px-2 text-purple-400 text-right">{formatMoney(trip.trip_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.trips.length > 20 && (
              <div className="text-slate-500 text-sm mt-2 text-center">
                Показано 20 из {data.trips.length} рейсов
              </div>
            )}
          </div>
        </div>
      )}

      {/* Contracts / Заявки РФ */}
      {data?.contracts && data.contracts.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-6">
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-green-400" />
            Заявки РФ Транспорт за {month}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700">
                  <th className="text-left py-2 px-2">Дата</th>
                  <th className="text-left py-2 px-2">Маршрут</th>
                  <th className="text-left py-2 px-2">Заказчик</th>
                  <th className="text-right py-2 px-2">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {data.contracts.slice(0, 20).map((c: any, i: number) => (
                  <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="py-2 px-2 text-slate-300">{formatDate(c.date)}</td>
                    <td className="py-2 px-2 text-slate-300 truncate max-w-[200px]">{c.route || '-'}</td>
                    <td className="py-2 px-2 text-slate-300">{c.contractor_name || '-'}</td>
                    <td className="py-2 px-2 text-green-400 text-right">{formatMoney(c.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Нет данных */}
      {(!data?.trips || data.trips.length === 0) && (!data?.contracts || data.contracts.length === 0) && (
        <div className="bg-slate-800 rounded-xl p-8 border border-slate-700 text-center">
          <div className="text-slate-500">Нет рейсов за выбранный период</div>
        </div>
      )}
    </div>
  );
}
