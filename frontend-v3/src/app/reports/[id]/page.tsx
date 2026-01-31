"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Truck, User, Save, Loader2, Zap, Plus, Trash2, RefreshCw, Fuel } from "lucide-react";

interface WbTrip { loading_date: string; unloading_date?: string; route_name: string; driver_rate: number; }
interface RfContract { number: string; date: string; route: string; }
interface FuelBySource { source: string; liters: number; amount: number; count: number; }
interface Expense { name: string; amount: number; }
interface Report {
  id: string; number: string; driver_id: string; driver_name: string;
  vehicle_id: string; vehicle_number: string; date_from: string; date_to: string;
  fuel_quantity: number; fuel_amount: number; mileage: number;
  total_expenses: number; driver_accruals: number; expense_categories: any;
}

export default function ReportEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [report, setReport] = useState<Report | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);
  
  const [driverName, setDriverName] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  
  const [wbTrips, setWbTrips] = useState<WbTrip[]>([]);
  const [wbTotals, setWbTotals] = useState({count: 0, driver_rate: 0});
  const [wbGpsMileage, setWbGpsMileage] = useState(0);
  const [wbDays, setWbDays] = useState(0);
  const [wbCoef, setWbCoef] = useState(1.0);
  
  const [rfContracts, setRfContracts] = useState<RfContract[]>([]);
  const [rfDateFrom, setRfDateFrom] = useState("");
  const [rfDateTo, setRfDateTo] = useState("");
  const [rfGpsMileage, setRfGpsMileage] = useState(0);
  const [rfGpsLoading, setRfGpsLoading] = useState(false);
  const [rfRatePerKm, setRfRatePerKm] = useState(6);
  
  const [gpsMileage, setGpsMileage] = useState(0);
  
  const [fuelBySource, setFuelBySource] = useState<FuelBySource[]>([]);
  const [fuelTotal, setFuelTotal] = useState({ liters: 0, amount: 0, count: 0 });
  const [fuelLoading, setFuelLoading] = useState(false);
  const [fuelConsumption, setFuelConsumption] = useState<any>(null);
  
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [newExpenseName, setNewExpenseName] = useState("");
  const [newExpenseAmount, setNewExpenseAmount] = useState<number | "">("");

  useEffect(() => {
    fetchReport();
  }, [id]);

  const fetchReport = async () => {
    try {
      const res = await fetch("/rest/v1/driver_reports?id=eq." + id);
      const data = await res.json();
      if (data && data[0]) {
        const r = data[0];
        setReport(r);
        setDriverName(r.driver_name || "");
        setVehicleNumber(r.vehicle_number || "");
        setDateFrom(r.date_from || "");
        setDateTo(r.date_to || "");
        setGpsMileage(r.mileage || 0);
        setFuelTotal({ liters: r.fuel_quantity || 0, amount: r.fuel_amount || 0, count: 0 });
        if (r.expense_categories && Array.isArray(r.expense_categories)) {
          setExpenses(r.expense_categories.map((e: any) => ({ name: e.category || e.name, amount: parseFloat(e.amount) || 0 })));
        }
      }
    } catch (e) { console.error(e); }
    setPageLoading(false);
  };

  const shortDate = (d: string) => { const p = d.slice(5,10).split("-"); return p[1] + "." + p[0]; };

  const getUniqueDays = (trips: WbTrip[]): string[] => {
    const days = new Set<string>();
    trips.forEach(t => {
      const start = new Date(t.loading_date);
      const end = new Date(t.unloading_date || t.loading_date);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        days.add(d.toISOString().slice(0, 10));
      }
    });
    return Array.from(days).sort();
  };

  const loadRfGps = async () => {
    if (!vehicleNumber || !rfDateFrom || !rfDateTo) { alert("Укажите период РФ"); return; }
    setRfGpsLoading(true);
    try {
      // datetime-local даёт "YYYY-MM-DDTHH:MM", берём только дату для API
      const fromDate = rfDateFrom.split("T")[0];
      const toDate = rfDateTo.split("T")[0];
      const res = await fetch("/api/reports/telematics/mileage?vehicle=" + encodeURIComponent(vehicleNumber) + "&from=" + fromDate + "&to=" + toDate);
      const data = await res.json();
      if (data.mileage === null) {
        alert("GPS не найден для машины " + vehicleNumber + (data.error ? ": " + data.error : ""));
        setRfGpsMileage(0);
      } else {
        setRfGpsMileage(data.mileage || 0);
      }
    } catch (e) { 
      alert("Ошибка загрузки GPS"); 
      setRfGpsMileage(0); 
    }
    setRfGpsLoading(false);
  };

  const loadFuel = async () => {
    if (!vehicleNumber || !dateFrom || !dateTo) return;
    setFuelLoading(true);
    try {
      const res = await fetch("/api/reports/fuel/detail?vehicle=" + encodeURIComponent(vehicleNumber) + "&from=" + dateFrom + "&to=" + dateTo);
      const data = await res.json();
      setFuelBySource(data.by_source || []);
      setFuelTotal(data.total || { liters: 0, amount: 0, count: 0 });
      
      // Расчёт расхода если есть пробег
      if (gpsMileage > 0 && data.total?.liters > 0) {
        const calcRes = await fetch("/api/fuel-norms/calculate?vehicle=" + encodeURIComponent(vehicleNumber) + "&from=" + dateFrom + "&liters=" + data.total.liters + "&mileage=" + gpsMileage);
        const calcData = await calcRes.json();
        setFuelConsumption(calcData);
      }
    } catch (e) { 
      setFuelBySource([]); 
      setFuelTotal({ liters: 0, amount: 0, count: 0 }); 
    }
    setFuelLoading(false);
  };

  const handleAutoFill = async () => {
    if (!vehicleNumber || !dateFrom || !dateTo) { alert("Нет данных для загрузки"); return; }
    
    setAutoLoading(true);
    setWbTrips([]); setWbTotals({count: 0, driver_rate: 0}); setWbGpsMileage(0); setWbDays(0);
    setRfContracts([]); setRfGpsMileage(0); setRfDateFrom(""); setRfDateTo("");
    
    try {
      const baseParams = new URLSearchParams({ from: dateFrom, to: dateTo });
      if (driverName) baseParams.append("driver", driverName);
      if (vehicleNumber) baseParams.append("vehicle", vehicleNumber);
      
      // WB
      const wbRes = await fetch("/api/reports/trips-detail-v2?" + baseParams);
      const wbData = await wbRes.json();
      
      if (wbData.trips) {
        setWbTrips(wbData.trips);
        setWbTotals({
          count: wbData.trips.length,
          driver_rate: wbData.trips.reduce((s: number, t: WbTrip) => s + parseFloat(String(t.driver_rate || 0)), 0)
        });
        
        if (vehicleNumber) {
          const uniqueDays = getUniqueDays(wbData.trips);
          setWbDays(uniqueDays.length);
          if (uniqueDays.length > 0) {
            const wbGpsRes = await fetch("/api/reports/telematics/mileage-by-dates", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ vehicle: vehicleNumber, dates: uniqueDays })
            });
            const wbGpsData = await wbGpsRes.json();
            setWbGpsMileage(wbGpsData.total || 0);
          }
        }
      }
      
      // РФ
      const rfRes = await fetch("/api/reports/contracts-rf-v2?" + baseParams);
      const rfData = await rfRes.json();
      if (rfData.contracts && rfData.contracts.length > 0) {
        setRfContracts(rfData.contracts);
      }
      
      if (vehicleNumber) {
        // Общий GPS
        const mileageRes = await fetch("/api/reports/telematics/mileage?vehicle=" + encodeURIComponent(vehicleNumber) + "&from=" + dateFrom + "&to=" + dateTo);
        const mileageData = await mileageRes.json();
        if (mileageData.mileage) setGpsMileage(mileageData.mileage);
        
        // Топливо
        const fuelRes = await fetch("/api/reports/fuel/detail?vehicle=" + encodeURIComponent(vehicleNumber) + "&from=" + dateFrom + "&to=" + dateTo);
        const fuelData = await fuelRes.json();
        setFuelBySource(fuelData.by_source || []);
        setFuelTotal(fuelData.total || { liters: 0, amount: 0, count: 0 });
      }
    } catch (err) { console.error(err); }
    setAutoLoading(false);
  };

  const addExpense = () => {
    if (!newExpenseName || !newExpenseAmount) return;
    setExpenses([...expenses, { name: newExpenseName, amount: Number(newExpenseAmount) }]);
    setNewExpenseName(""); setNewExpenseAmount("");
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const wbDriverPay = Math.round(wbTotals.driver_rate * wbCoef);
  const rfDriverPay = Math.round(rfGpsMileage * rfRatePerKm);
  const totalDriverPay = wbDriverPay + rfDriverPay;

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch("/rest/v1/driver_reports?id=eq." + id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Prefer": "return=minimal" },
        body: JSON.stringify({
          mileage: gpsMileage,
          fuel_quantity: fuelTotal.liters,
          fuel_amount: fuelTotal.amount,
          total_expenses: totalExpenses,
          driver_accruals: totalDriverPay,
          expense_categories: expenses.map(e => ({ category: e.name, amount: String(e.amount) }))
        })
      });
      if (res.ok) {
        alert("Сохранено!");
        router.push("/reports");
      } else {
        alert("Ошибка сохранения");
      }
    } catch (e) {
      alert("Ошибка сохранения");
    }
    setLoading(false);
  };

  if (pageLoading) return <div className="p-8 text-center text-slate-400">Загрузка...</div>;
  if (!report) return <div className="p-8 text-center text-red-400">Отчёт не найден</div>;

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <button onClick={() => router.back()} className="p-2 hover:bg-slate-700 rounded-lg"><ArrowLeft className="w-5 h-5" /></button>
        <span className="text-slate-400">Назад</span>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Отчёт {report.number}</h1>
        <span className="text-slate-400">{new Date(dateFrom).toLocaleDateString("ru-RU")} — {new Date(dateTo).toLocaleDateString("ru-RU")}</span>
      </div>

      {/* Водитель и машина */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 space-y-3">
        <div className="flex items-center gap-2 text-slate-400"><User className="w-4 h-4" /> Водитель</div>
        <div className="text-lg font-semibold">{driverName || "—"}</div>
        
        <div className="flex items-center gap-2 text-slate-400 mt-3"><Truck className="w-4 h-4" /> Машина</div>
        <div className="text-lg font-semibold">{vehicleNumber}</div>

        <button 
          onClick={handleAutoFill} 
          disabled={autoLoading}
          className="w-full mt-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 py-3 rounded-lg font-medium flex items-center justify-center gap-2"
        >
          {autoLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
          Загрузить данные
        </button>
      </div>

      {/* WB */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
        <div className="flex items-center justify-between mb-3">
          <span className="text-orange-400 font-semibold">🚛 WB ({wbTrips.length})</span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">Коэф:</span>
            <input type="number" step="0.1" min="0" value={wbCoef} onChange={e => setWbCoef(Number(e.target.value) || 1)} className="w-16 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-center text-orange-400 font-semibold" />
            <span className="text-green-400 font-bold">{Math.round(wbTotals.driver_rate * wbCoef).toLocaleString("ru-RU")} ₽</span>
          </div>
        </div>
        {wbTrips.length === 0 ? (
          <div className="text-center text-slate-500 py-4">Нет рейсов</div>
        ) : (
          <div className="space-y-2">
            {wbTrips.map((t, i) => (
              <div key={i} className="flex items-center justify-between text-sm bg-slate-700/30 rounded p-2">
                <div>
                  <span className="text-slate-400">{shortDate(t.loading_date)}</span>
                  {t.unloading_date && t.unloading_date !== t.loading_date && <span className="text-slate-500"> → {shortDate(t.unloading_date)}</span>}
                  <span className="ml-2 text-white">{t.route_name}</span>
                </div>
                <span className="text-green-400">{Number(t.driver_rate || 0).toLocaleString("ru-RU")} ₽</span>
              </div>
            ))}
          </div>
        )}
        {wbDays > 0 && (
          <div className="mt-2 text-sm text-slate-400">
            GPS за {wbDays} дней: <span className="text-cyan-400">{wbGpsMileage.toLocaleString("ru-RU")} км</span>
          </div>
        )}
      </div>

      {/* РФ */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
        <div className="flex items-center justify-between mb-3">
          <span className="text-purple-400 font-semibold">📦 РФ ({rfContracts.length})</span>
          <span className="text-green-400 font-bold">{rfDriverPay.toLocaleString("ru-RU")} ₽</span>
        </div>
        {rfContracts.length === 0 ? (
          <div className="text-center text-slate-500 py-4">Нет заявок</div>
        ) : (
          <div className="space-y-2">
            {rfContracts.map((c, i) => (
              <div key={i} className="text-sm bg-slate-700/30 rounded p-2">
                <span className="text-slate-400">{c.number}</span>
                <span className="ml-2 text-white">{c.route}</span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 p-3 bg-slate-700/30 rounded-lg">
          <div className="text-sm text-slate-400 mb-2">📅 Период РФ:</div>
          <div className="flex items-center gap-2 flex-wrap">
            <input type="datetime-local" value={rfDateFrom} onChange={e => setRfDateFrom(e.target.value)} className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm flex-1" />
            <span className="text-slate-500">→</span>
            <input type="datetime-local" value={rfDateTo} onChange={e => setRfDateTo(e.target.value)} className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm flex-1" />
            <button onClick={loadRfGps} disabled={rfGpsLoading} className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 px-4 py-1.5 rounded text-sm flex items-center gap-1">
              {rfGpsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Загрузить GPS
            </button>
          </div>
        </div>
        {rfGpsMileage > 0 && (
          <div className="mt-2 flex items-center gap-4 text-sm">
            <span>GPS: <span className="text-cyan-400">{rfGpsMileage.toLocaleString("ru-RU")} км</span></span>
            <span>× <input type="number" value={rfRatePerKm} onChange={e => setRfRatePerKm(Number(e.target.value))} className="w-12 bg-slate-700 border border-slate-600 rounded px-1 text-center" /> ₽/км</span>
            <span>= <span className="text-green-400">{rfDriverPay.toLocaleString("ru-RU")} ₽</span></span>
          </div>
        )}
      </div>

      {/* Топливо */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
        <div className="flex items-center justify-between mb-3">
          <span className="text-yellow-400 font-semibold">⛽ Топливо</span>
          <button onClick={loadFuel} disabled={fuelLoading} className="bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 px-3 py-1 rounded text-sm flex items-center gap-1">
            {fuelLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Загрузить
          </button>
        </div>
        {fuelBySource.length === 0 && fuelTotal.liters === 0 ? (
          <div className="text-center text-slate-500 py-4">Нет данных о топливе</div>
        ) : (
          <div className="space-y-2">
            {fuelBySource.map((f, i) => (
              <div key={i} className="flex items-center justify-between text-sm bg-slate-700/30 rounded p-2">
                <span className="text-white">{f.source}</span>
                <span><span className="text-yellow-400">{Number(f.liters).toFixed(0)} л</span> / <span className="text-slate-400">{Number(f.amount).toLocaleString("ru-RU")} ₽</span></span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-slate-600 font-semibold">
              <span>Итого:</span>
              <span><span className="text-yellow-400">{Number(fuelTotal.liters).toFixed(0)} л</span> / <span className="text-white">{Number(fuelTotal.amount).toLocaleString("ru-RU")} ₽</span></span>
            </div>
            {fuelConsumption && gpsMileage > 0 && (
              <div className="mt-3 p-3 rounded-lg bg-slate-700/50">
                <div className="text-sm text-slate-400 mb-1">Расход топлива:</div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold">
                    <span className={fuelConsumption.status === "over" ? "text-red-400" : fuelConsumption.status === "under" ? "text-green-400" : "text-white"}>
                      {fuelConsumption.consumption} л/100км
                    </span>
                  </span>
                  <span className="text-slate-400">
                    норма: {fuelConsumption.norm} л/100км ({fuelConsumption.season === "winter" ? "❄️ зима" : fuelConsumption.season === "summer" ? "☀️ лето" : "🍂 осень"})
                  </span>
                </div>
                {fuelConsumption.diff !== 0 && (
                  <div className={"text-sm mt-1 " + (fuelConsumption.status === "over" ? "text-red-400" : "text-green-400")}>
                    {fuelConsumption.diff > 0 ? "⚠️ Перерасход" : "✅ Экономия"}: {Math.abs(fuelConsumption.diff)} л/100км ({fuelConsumption.diffPercent > 0 ? "+" : ""}{fuelConsumption.diffPercent}%)
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Расходы */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
        <div className="text-red-400 font-semibold mb-3">💸 Расходы</div>
        <div className="space-y-2">
          {expenses.map((e, i) => (
            <div key={i} className="flex items-center justify-between bg-slate-700/30 rounded p-2">
              <span className="text-white">{e.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-red-400">{e.amount.toLocaleString("ru-RU")} ₽</span>
                <button onClick={() => setExpenses(expenses.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-3">
          <input type="text" placeholder="Название" value={newExpenseName} onChange={e => setNewExpenseName(e.target.value)} className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2" />
          <input type="number" placeholder="₽" value={newExpenseAmount} onChange={e => setNewExpenseAmount(e.target.value ? Number(e.target.value) : "")} className="w-24 bg-slate-700 border border-slate-600 rounded px-3 py-2" />
          <button onClick={addExpense} className="bg-slate-600 hover:bg-slate-500 p-2 rounded"><Plus className="w-5 h-5" /></button>
        </div>
        {totalExpenses > 0 && (
          <div className="mt-2 text-right text-red-400 font-semibold">Итого расходов: {totalExpenses.toLocaleString("ru-RU")} ₽</div>
        )}
      </div>

      {/* Итого */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
        <div className="grid grid-cols-2 gap-4 text-center mb-4">
          <div>
            <div className="text-slate-400 text-sm">WB {wbCoef !== 1 && <span className="text-orange-400">×{wbCoef}</span>}</div>
            <div className="text-green-400 font-bold text-xl">{wbDriverPay.toLocaleString("ru-RU")} ₽</div>
          </div>
          <div>
            <div className="text-slate-400 text-sm">РФ ({rfGpsMileage}×{rfRatePerKm})</div>
            <div className="text-green-400 font-bold text-xl">{rfDriverPay.toLocaleString("ru-RU")} ₽</div>
          </div>
        </div>
        <div className="border-t border-slate-600 pt-4 text-center">
          <div className="text-slate-400 text-sm">К выплате</div>
          <div className="text-4xl font-bold text-white">{(totalDriverPay - totalExpenses).toLocaleString("ru-RU")} ₽</div>
        </div>
      </div>

      <button 
        onClick={handleSave} 
        disabled={loading}
        className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
        Сохранить
      </button>
    </div>
  );
}
