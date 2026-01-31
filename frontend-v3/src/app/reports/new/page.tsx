"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Truck, User, Save, Loader2, Zap, Plus, Trash2, RefreshCw, Fuel } from "lucide-react";

interface Driver { name: string; }
interface Vehicle { number: string; trips?: number; }
interface WbTrip { loading_date: string; unloading_date?: string; route_name: string; driver_rate: number; }
interface RfContract { number: string; date: string; route: string; }
interface FuelBySource { source: string; liters: number; amount: number; count: number; }
interface Expense { name: string; amount: number; }

export default function NewReportPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [allVehicles, setAllVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  
  const [driverSearch, setDriverSearch] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [showDriverList, setShowDriverList] = useState(false);
  const [showVehicleList, setShowVehicleList] = useState(false);
  const [driverVehicles, setDriverVehicles] = useState<Vehicle[]>([]);
  
  const [driverName, setDriverName] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  
  const [wbTrips, setWbTrips] = useState<WbTrip[]>([]);
  const [wbTotals, setWbTotals] = useState({count: 0, driver_rate: 0});
  const [wbGpsMileage, setWbGpsMileage] = useState(0);
  const [wbDays, setWbDays] = useState(0);
  
  const [rfContracts, setRfContracts] = useState<RfContract[]>([]);
  const [rfDateFrom, setRfDateFrom] = useState("");
  const [rfDateTo, setRfDateTo] = useState("");
  const [rfGpsMileage, setRfGpsMileage] = useState(0);
  const [rfGpsLoading, setRfGpsLoading] = useState(false);
  const [rfRatePerKm, setRfRatePerKm] = useState(6);
  
  const [gpsMileage, setGpsMileage] = useState(0);
  
  // Топливо
  const [fuelBySource, setFuelBySource] = useState<FuelBySource[]>([]);
  const [fuelTotal, setFuelTotal] = useState({ liters: 0, amount: 0, count: 0 });
  const [fuelLoading, setFuelLoading] = useState(false);
  
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [newExpenseName, setNewExpenseName] = useState("");
  const [newExpenseAmount, setNewExpenseAmount] = useState<number | "">("");

  useEffect(() => {
    fetch("/api/reports/drivers").then(r => r.json()).then(setDrivers).catch(() => {});
    fetch("/api/reports/vehicles").then(r => r.json()).then(setAllVehicles).catch(() => {});
  }, []);

  const filteredDrivers = drivers.filter(d => d.name.toLowerCase().includes(driverSearch.toLowerCase())).slice(0, 15);
  const filteredVehicles = allVehicles.filter(v => v.number.toLowerCase().replace(/\s/g,'').includes(vehicleSearch.toLowerCase().replace(/\s/g,''))).slice(0, 15);

  const selectDriver = (name: string) => { setDriverName(name); setDriverSearch(name); setShowDriverList(false); };
  const selectVehicle = (number: string) => { setVehicleNumber(number); setVehicleSearch(number); setShowVehicleList(false); };

  useEffect(() => {
    if (!driverName) { setDriverVehicles([]); return; }
    const fetchVehicles = async () => {
      try {
        const params = new URLSearchParams({ driver: driverName });
        if (dateFrom) params.append("from", dateFrom);
        if (dateTo) params.append("to", dateTo);
        const res = await fetch(`/api/reports/driver-vehicles?${params}`);
        const data = await res.json();
        setDriverVehicles(Array.isArray(data) ? data : []);
        if (data.length === 1) { setVehicleNumber(data[0].number); setVehicleSearch(data[0].number); }
        else if (data.length > 1 && !vehicleNumber) {
          const best = data.reduce((a: Vehicle, b: Vehicle) => (b.trips || 0) > (a.trips || 0) ? b : a);
          setVehicleNumber(best.number); setVehicleSearch(best.number);
        }
      } catch (e) { setDriverVehicles([]); }
    };
    fetchVehicles();
  }, [driverName, dateFrom, dateTo]);

  const shortDate = (d: string) => { const p = d.slice(5,10).split('-'); return `${p[1]}.${p[0]}`; };

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
    if (!vehicleNumber || !rfDateFrom || !rfDateTo) return;
    setRfGpsLoading(true);
    try {
      const res = await fetch(`/api/reports/telematics/mileage?vehicle=${encodeURIComponent(vehicleNumber)}&from=${rfDateFrom}&to=${rfDateTo}`);
      const data = await res.json();
      setRfGpsMileage(data.mileage || 0);
    } catch (e) { setRfGpsMileage(0); }
    setRfGpsLoading(false);
  };

  const loadFuel = async () => {
    if (!vehicleNumber || !dateFrom || !dateTo) return;
    setFuelLoading(true);
    try {
      const res = await fetch(`/api/reports/fuel/detail?vehicle=${encodeURIComponent(vehicleNumber)}&from=${dateFrom}&to=${dateTo}`);
      const data = await res.json();
      setFuelBySource(data.by_source || []);
      setFuelTotal(data.total || { liters: 0, amount: 0, count: 0 });
    } catch (e) { 
      setFuelBySource([]); 
      setFuelTotal({ liters: 0, amount: 0, count: 0 }); 
    }
    setFuelLoading(false);
  };

  const handleAutoFill = async () => {
    if (!driverName || !dateFrom || !dateTo) { alert("Выберите водителя и даты"); return; }
    
    setAutoLoading(true);
    setWbTrips([]); setWbTotals({count: 0, driver_rate: 0}); setWbGpsMileage(0); setWbDays(0);
    setRfContracts([]); setRfGpsMileage(0); setRfDateFrom(""); setRfDateTo("");
    setGpsMileage(0);
    setFuelBySource([]); setFuelTotal({ liters: 0, amount: 0, count: 0 });
    
    try {
      const baseParams = new URLSearchParams({ driver: driverName, from: dateFrom, to: dateTo });
      if (vehicleNumber) baseParams.append("vehicle", vehicleNumber);
      
      // WB
      const wbRes = await fetch(`/api/reports/trips-detail-v2?${baseParams}`);
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
      const rfRes = await fetch(`/api/reports/contracts-rf-v2?${baseParams}`);
      const rfData = await rfRes.json();
      if (rfData.contracts && rfData.contracts.length > 0) {
        setRfContracts(rfData.contracts);
      }
      
      if (vehicleNumber) {
        // Общий GPS
        const mileageRes = await fetch(`/api/reports/telematics/mileage?vehicle=${encodeURIComponent(vehicleNumber)}&from=${dateFrom}&to=${dateTo}`);
        const mileageData = await mileageRes.json();
        if (mileageData.mileage) setGpsMileage(mileageData.mileage);
        
        // Топливо
        const fuelRes = await fetch(`/api/reports/fuel/detail?vehicle=${encodeURIComponent(vehicleNumber)}&from=${dateFrom}&to=${dateTo}`);
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
  const rfDriverPay = Math.round(rfGpsMileage * rfRatePerKm);
  const totalDriverPay = wbTotals.driver_rate + rfDriverPay;

  const handleSave = async () => {
    if (!driverName || !dateFrom || !dateTo) { alert("Заполните поля"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/reports/save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driver_name: driverName, vehicle_number: vehicleNumber,
          date_from: dateFrom, date_to: dateTo, mileage: gpsMileage,
          fuel_quantity: fuelTotal.liters || 0, fuel_amount: fuelTotal.amount || 0,
          total_expenses: totalExpenses, driver_accruals: totalDriverPay
        })
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true); setTimeout(() => setSaved(false), 3000);
        setDriverName(""); setDriverSearch(""); setVehicleNumber(""); setVehicleSearch("");
        setDateFrom(""); setDateTo(""); setDriverVehicles([]);
        setWbTrips([]); setWbTotals({count: 0, driver_rate: 0}); setWbGpsMileage(0); setWbDays(0);
        setRfContracts([]); setRfGpsMileage(0); setRfDateFrom(""); setRfDateTo("");
        setGpsMileage(0); setFuelBySource([]); setFuelTotal({ liters: 0, amount: 0, count: 0 }); setExpenses([]);
      } else { alert("Ошибка: " + data.error); }
    } catch (err) { alert("Ошибка"); }
    setLoading(false);
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <Link href="/reports" className="flex items-center gap-2 text-slate-400 hover:text-white"><ArrowLeft className="w-4 h-4" /> Назад</Link>
      </div>

      <h1 className="text-2xl font-bold text-white mb-6">Новый отчёт</h1>
      {saved && <div className="bg-green-500/20 border border-green-500 rounded-lg p-4 mb-6 text-green-400">✅ Сохранено!</div>}

      <div className="space-y-6">
        {/* Форма */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-4">
          <div className="relative">
            <label className="block text-slate-400 text-sm mb-1"><User className="w-4 h-4 inline mr-1" /> Водитель</label>
            <input type="text" value={driverSearch}
              onChange={e => { setDriverSearch(e.target.value); setShowDriverList(true); if (!e.target.value) { setDriverName(""); setDriverVehicles([]); } }}
              onFocus={() => setShowDriverList(true)} onBlur={() => setTimeout(() => setShowDriverList(false), 200)}
              placeholder="Имя..." className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 border border-slate-600" />
            {showDriverList && driverSearch && filteredDrivers.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-slate-700 border border-slate-600 rounded-lg max-h-48 overflow-y-auto">
                {filteredDrivers.map(d => <button key={d.name} onClick={() => selectDriver(d.name)} className="w-full text-left px-3 py-2 hover:bg-slate-600 text-white text-sm">{d.name}</button>)}
              </div>
            )}
          </div>

          {driverName && driverVehicles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {driverVehicles.map(v => (
                <button key={v.number} onClick={() => selectVehicle(v.number)}
                  className={`px-2 py-1 rounded text-xs ${v.number === vehicleNumber ? 'bg-blue-600 text-white' : 'bg-slate-600 text-slate-300'}`}>
                  {v.number}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-slate-700 text-white rounded-lg px-3 py-2 border border-slate-600 text-sm" />
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-slate-700 text-white rounded-lg px-3 py-2 border border-slate-600 text-sm" />
          </div>

          <div className="relative">
            <input type="text" value={vehicleSearch}
              onChange={e => { setVehicleSearch(e.target.value); setShowVehicleList(true); if (!e.target.value) setVehicleNumber(""); }}
              onFocus={() => setShowVehicleList(true)} onBlur={() => setTimeout(() => setShowVehicleList(false), 200)}
              placeholder="Номер машины..." className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 border border-slate-600" />
            {showVehicleList && vehicleSearch && filteredVehicles.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-slate-700 border border-slate-600 rounded-lg max-h-48 overflow-y-auto">
                {filteredVehicles.map(v => <button key={v.number} onClick={() => selectVehicle(v.number)} className="w-full text-left px-3 py-2 hover:bg-slate-600 text-white text-sm">{v.number}</button>)}
              </div>
            )}
          </div>

          <button onClick={handleAutoFill} disabled={autoLoading || !driverName || !dateFrom || !dateTo}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white px-4 py-2 rounded-lg w-full justify-center">
            {autoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} Загрузить
          </button>
        </div>

        {/* Сводка GPS */}
        {gpsMileage > 0 && (
          <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-xl p-4 border border-blue-500/30">
            <div className="text-center mb-3">
              <span className="text-slate-400 text-sm">Общий GPS за период</span>
              <div className="text-3xl font-bold text-white">{gpsMileage.toLocaleString()} км</div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div><span className="text-purple-400 font-bold">{wbGpsMileage.toLocaleString()}</span><div className="text-slate-500 text-xs">WB</div></div>
              <div><span className="text-orange-400 font-bold">{rfGpsMileage.toLocaleString()}</span><div className="text-slate-500 text-xs">РФ</div></div>
              <div><span className="text-slate-400">{Math.max(0, gpsMileage - wbGpsMileage - rfGpsMileage).toLocaleString()}</span><div className="text-slate-500 text-xs">Прочее</div></div>
            </div>
          </div>
        )}

        {/* WB */}
        <div className="bg-slate-800 rounded-xl p-4 border border-purple-500/30">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-purple-400">🚛 WB ({wbTotals.count})</h2>
            {wbGpsMileage > 0 && <span className="text-purple-400 font-bold">{wbGpsMileage.toLocaleString()} км</span>}
          </div>
          {wbTrips.length > 0 ? (
            <>
              <div className="space-y-1 mb-3 max-h-40 overflow-y-auto text-sm">
                {wbTrips.map((t, i) => (
                  <div key={i} className="flex justify-between bg-slate-700/50 rounded px-2 py-1">
                    <span className="text-slate-400 text-xs w-20">{shortDate(t.loading_date)}{t.unloading_date && t.unloading_date !== t.loading_date && `→${shortDate(t.unloading_date)}`}</span>
                    <span className="flex-1 truncate text-slate-300 text-xs mx-2">{t.route_name}</span>
                    <span className="text-green-400">{Number(t.driver_rate).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between border-t border-slate-700 pt-2 font-bold">
                <span className="text-purple-400">{wbDays} дн. → {wbGpsMileage.toLocaleString()} км</span>
                <span className="text-green-400">{wbTotals.driver_rate.toLocaleString()} ₽</span>
              </div>
            </>
          ) : <div className="text-slate-500 text-center py-4">Нет рейсов</div>}
        </div>

        {/* РФ */}
        <div className="bg-slate-800 rounded-xl p-4 border border-orange-500/30">
          <h2 className="text-lg font-semibold text-orange-400 mb-3">📋 РФ ({rfContracts.length})</h2>
          {rfContracts.length > 0 ? (
            <>
              <div className="space-y-1 mb-3 max-h-24 overflow-y-auto text-xs">
                {rfContracts.map((c, i) => (
                  <div key={i} className="bg-slate-700/50 rounded px-2 py-1">
                    <span className="text-slate-400">{c.date?.slice(0,10)}</span>
                    <span className="text-slate-300 ml-2">{c.route}</span>
                  </div>
                ))}
              </div>
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 mb-3">
                <div className="text-orange-400 text-sm mb-2">📅 Период РФ:</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <input type="date" value={rfDateFrom} onChange={e => { setRfDateFrom(e.target.value); setRfGpsMileage(0); }}
                    className="bg-slate-600 text-white rounded px-2 py-1 text-sm border border-slate-500 flex-1 min-w-[110px]" />
                  <span className="text-slate-400">→</span>
                  <input type="date" value={rfDateTo} onChange={e => { setRfDateTo(e.target.value); setRfGpsMileage(0); }}
                    className="bg-slate-600 text-white rounded px-2 py-1 text-sm border border-slate-500 flex-1 min-w-[110px]" />
                  <button onClick={loadRfGps} disabled={!rfDateFrom || !rfDateTo || rfGpsLoading || !vehicleNumber}
                    className="bg-orange-600 hover:bg-orange-700 disabled:bg-slate-600 text-white px-3 py-1 rounded flex items-center gap-1">
                    {rfGpsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  </button>
                </div>
                {rfGpsMileage > 0 && <div className="text-center mt-2 text-orange-400 font-bold text-xl">{rfGpsMileage.toLocaleString()} км</div>}
              </div>
              <div className="border-t border-slate-700 pt-2 space-y-1 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Ставка:</span>
                  <div className="flex items-center gap-1">
                    <input type="number" value={rfRatePerKm} onChange={e => setRfRatePerKm(Number(e.target.value) || 0)}
                      className="w-12 bg-slate-700 text-white text-right rounded px-1 py-0.5 text-xs border border-slate-600" /> ₽/км
                  </div>
                </div>
                <div className="flex justify-between"><span className="text-slate-400">Начисления:</span><span className="text-green-400 font-bold">{rfDriverPay.toLocaleString()} ₽</span></div>
              </div>
            </>
          ) : <div className="text-slate-500 text-center py-4">Нет заявок</div>}
        </div>

        {/* Топливо */}
        <div className="bg-slate-800 rounded-xl p-4 border border-cyan-500/30">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-cyan-400">⛽ Топливо</h2>
            <button onClick={loadFuel} disabled={fuelLoading || !vehicleNumber || !dateFrom || !dateTo}
              className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1">
              {fuelLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Загрузить
            </button>
          </div>
          {fuelBySource.length > 0 ? (
            <>
              <div className="space-y-2 mb-3">
                {fuelBySource.map((f, i) => (
                  <div key={i} className="flex justify-between bg-slate-700/50 rounded px-3 py-2">
                    <span className="text-slate-300">{f.source || "Неизвестно"}</span>
                    <div className="text-right">
                      <div className="text-cyan-400 font-bold">{Number(f.liters).toLocaleString()} л</div>
                      <div className="text-slate-400 text-xs">{Number(f.amount).toLocaleString()} ₽</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between border-t border-slate-700 pt-2 font-bold">
                <span className="text-cyan-400">{Number(fuelTotal.liters).toLocaleString()} л</span>
                <span className="text-slate-300">{Number(fuelTotal.amount).toLocaleString()} ₽</span>
              </div>
            </>
          ) : (
            <div className="text-slate-500 text-center py-4">
              {fuelTotal.count === 0 ? "Нет данных о топливе" : "Загрузите данные"}
            </div>
          )}
        </div>

        {/* Расходы */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <h2 className="font-semibold text-white mb-3">💸 Расходы</h2>
          {expenses.map((e, i) => (
            <div key={i} className="flex justify-between bg-slate-700/50 rounded px-3 py-1 mb-1 text-sm">
              <span>{e.name}</span>
              <div className="flex gap-2">
                <span className="text-red-400">{e.amount.toLocaleString()} ₽</span>
                <button onClick={() => setExpenses(expenses.filter((_, j) => j !== i))} className="text-slate-500"><Trash2 className="w-3 h-3" /></button>
              </div>
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <input placeholder="Название" value={newExpenseName} onChange={e => setNewExpenseName(e.target.value)} className="flex-1 bg-slate-700 text-white rounded px-3 py-1 border border-slate-600 text-sm" />
            <input type="number" placeholder="₽" value={newExpenseAmount} onChange={e => setNewExpenseAmount(e.target.value ? Number(e.target.value) : "")} className="w-20 bg-slate-700 text-white rounded px-3 py-1 border border-slate-600 text-sm" />
            <button onClick={addExpense} className="bg-slate-600 text-white px-3 py-1 rounded"><Plus className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Итого */}
        <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 rounded-xl p-4 border border-green-500/30">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="text-center">
              <div className="text-slate-400 text-xs">WB</div>
              <div className="text-xl font-bold text-purple-400">{wbTotals.driver_rate.toLocaleString()} ₽</div>
            </div>
            <div className="text-center">
              <div className="text-slate-400 text-xs">РФ ({rfGpsMileage}×{rfRatePerKm})</div>
              <div className="text-xl font-bold text-orange-400">{rfDriverPay.toLocaleString()} ₽</div>
            </div>
          </div>
          {totalExpenses > 0 && (
            <div className="text-center mb-3">
              <div className="text-slate-400 text-xs">Расходы</div>
              <div className="text-lg font-bold text-red-400">−{totalExpenses.toLocaleString()} ₽</div>
            </div>
          )}
          <div className="text-center border-t border-slate-700 pt-3 mb-3">
            <div className="text-slate-400 text-xs">К выплате</div>
            <div className="text-3xl font-bold text-green-400">{(totalDriverPay - totalExpenses).toLocaleString()} ₽</div>
          </div>
          <button onClick={handleSave} disabled={loading} className="bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white px-6 py-3 rounded-lg w-full flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
