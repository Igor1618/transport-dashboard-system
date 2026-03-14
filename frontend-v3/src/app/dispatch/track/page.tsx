"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Search, Play, Pause, Maximize, Minimize, Activity, Navigation, Fuel, Gauge, Clock } from "lucide-react";

interface TrackPoint { t: string; lat: number; lon: number; speed: number; maxSpeed: number; fuel: number; dist: number; }
interface TrackEvent { type: string; from?: string; to?: string; time?: string; duration?: string; durationMin?: number; lat: number; lon: number; amount?: number; maxSpeed?: number; }
interface VehicleOption { vehicle: string; imei: string; vehicle_type: string; model: string; movement_status: string; }

function speedColor(speed: number): string {
  if (speed <= 0) return "#6b7280";
  if (speed < 60) return "#22c55e";
  if (speed < 80) return "#3b82f6";
  if (speed < 90) return "#eab308";
  return "#ef4444";
}

function sliderSegmentColor(speed: number): string {
  if (speed <= 1) return "#6b7280"; // gray — stopped
  if (speed > 90) return "#ef4444"; // red — overspeed
  return "#22c55e"; // green — moving
}

const fmt = (n: number) => new Intl.NumberFormat("ru-RU").format(n);
const fmtTime = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });
};
const fmtDateTime = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "Europe/Moscow" }) + " " +
    d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });
};

export default function TrackPage() {
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString().slice(0, 16); });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 16));
  const [track, setTrack] = useState<TrackPoint[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [events, setEvents] = useState<TrackEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("summary");

  // Slider / animation state
  const [sliderIndex, setSliderIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(10);
  const playIntervalRef = useRef<any>(null);

  // Vehicle search dropdown
  const [vehDropdownOpen, setVehDropdownOpen] = useState(false);
  const [vehSearch, setVehSearch] = useState("");
  const vehDropdownRef = useRef<HTMLDivElement>(null);

  // Fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Map refs
  const mapRef = useRef<any>(null);
  const mapInstance = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const animMarkerRef = useRef<any>(null);

  // Load vehicles list
  useEffect(() => {
    fetch("/api/dispatch/track/vehicles").then(r => r.json()).then(setVehicles).catch(() => {});
  }, []);

  // Close vehicle dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (vehDropdownRef.current && !vehDropdownRef.current.contains(e.target as Node)) setVehDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Init map
  useEffect(() => {
    if (typeof window === "undefined") return;
    const initMap = () => {
      const ymaps = (window as any).ymaps;
      if (!ymaps) return;
      ymaps.ready(() => {
        if (mapInstance.current) return;
        mapInstance.current = new ymaps.Map(mapRef.current, {
          center: [56.5, 53.0], zoom: 6,
          controls: ["zoomControl"],
        });
      });
    };
    if (document.querySelector('script[src*="api-maps.yandex"]')) { initMap(); return; }
    const s = document.createElement("script");
    s.src = "https://api-maps.yandex.ru/2.1/?apikey=62e1137c-2502-43bf-8986-55c56e740837&lang=ru_RU";
    s.onload = initMap;
    document.head.appendChild(s);
  }, []);

  // Fetch track
  const fetchTrack = useCallback(async () => {
    if (!selectedVehicle) return;
    setLoading(true);
    try {
      const url = `/api/dispatch/track?vehicle=${encodeURIComponent(selectedVehicle)}&from=${new Date(dateFrom).toISOString()}&to=${new Date(dateTo).toISOString()}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) { alert(data.error); setLoading(false); return; }
      setTrack(data.track || []);
      setSummary(data.summary || null);
      setEvents(data.events || []);
      setSliderIndex(0);
      setPlaying(false);
    } catch (e: any) { alert("Ошибка: " + e.message); }
    setLoading(false);
  }, [selectedVehicle, dateFrom, dateTo]);

  // Draw track on map
  useEffect(() => {
    if (!mapInstance.current || !track.length) return;
    const ymaps = (window as any).ymaps;
    if (!ymaps) return;

    // Clear old
    if (polylineRef.current) { mapInstance.current.geoObjects.remove(polylineRef.current); polylineRef.current = null; }
    markersRef.current.forEach(m => mapInstance.current.geoObjects.remove(m));
    markersRef.current = [];
    if (animMarkerRef.current) { mapInstance.current.geoObjects.remove(animMarkerRef.current); animMarkerRef.current = null; }

    // Build colored segments
    const collection = new ymaps.GeoObjectCollection();
    for (let i = 0; i < track.length - 1; i++) {
      const seg = new ymaps.Polyline(
        [[track[i].lat, track[i].lon], [track[i + 1].lat, track[i + 1].lon]],
        {},
        { strokeColor: speedColor(track[i].speed), strokeWidth: 4, strokeOpacity: 0.85 }
      );
      collection.add(seg);
    }
    mapInstance.current.geoObjects.add(collection);
    polylineRef.current = collection;

    // Start marker
    const startM = new ymaps.Placemark([track[0].lat, track[0].lon], {
      hintContent: `🟢 Старт: ${fmtTime(track[0].t)}`,
      balloonContent: `<b>🟢 Начало маршрута</b><br/>${fmtDateTime(track[0].t)}<br/>⛽ ${track[0].fuel} л`,
    }, { preset: "islands#greenCircleDotIcon" });
    mapInstance.current.geoObjects.add(startM);
    markersRef.current.push(startM);

    // End marker
    const last = track[track.length - 1];
    const endM = new ymaps.Placemark([last.lat, last.lon], {
      hintContent: `🔴 Финиш: ${fmtTime(last.t)}`,
      balloonContent: `<b>🔴 Конец маршрута</b><br/>${fmtDateTime(last.t)}<br/>⛽ ${last.fuel} л`,
    }, { preset: "islands#redCircleDotIcon" });
    mapInstance.current.geoObjects.add(endM);
    markersRef.current.push(endM);

    // Event markers
    for (const ev of events) {
      if (!ev.lat || !ev.lon) continue;
      let preset = "islands#blueCircleDotIcon";
      let hint = "";
      let balloon = "";
      if (ev.type === "stop") {
        preset = "islands#grayCircleDotIcon";
        hint = `🅿️ Остановка ${ev.duration || ""}`;
        balloon = `<b>🅿️ Остановка</b><br/>📍 ${ev.lat.toFixed(4)}, ${ev.lon.toFixed(4)}<br/>🕐 ${fmtTime(ev.from || "")} — ${fmtTime(ev.to || "")} (${ev.duration})`;
      }
      if (ev.type === "refuel") {
        preset = "islands#greenDotIcon";
        hint = `⛽ Заправка +${ev.amount} л`;
        balloon = `<b>⛽ Заправка</b><br/>+${ev.amount} л<br/>🕐 ${fmtTime(ev.time || "")}`;
      }
      if (ev.type === "drain") {
        preset = "islands#redDotIcon";
        hint = `⚠️ Слив ${ev.amount} л`;
        balloon = `<b>⚠️ Слив топлива</b><br/>${ev.amount} л<br/>🕐 ${fmtTime(ev.time || "")}`;
      }
      if (ev.type === "overspeed") {
        preset = "islands#redCircleDotIcon";
        hint = `🚨 ${ev.maxSpeed} км/ч`;
        balloon = `<b>🚨 Превышение</b><br/>${ev.maxSpeed} км/ч<br/>🕐 ${fmtTime(ev.time || "")}`;
      }
      const m = new ymaps.Placemark([ev.lat, ev.lon], { hintContent: hint, balloonContent: balloon }, { preset });
      mapInstance.current.geoObjects.add(m);
      markersRef.current.push(m);
    }

    // Fit bounds
    mapInstance.current.setBounds(collection.getBounds(), { checkZoomRange: true, zoomMargin: 50 });
  }, [track, events]);

  // Update animation marker when sliderIndex changes
  useEffect(() => {
    if (!mapInstance.current || !track.length) return;
    const ymaps = (window as any).ymaps;
    if (!ymaps) return;

    const pt = track[sliderIndex];
    if (!pt) return;

    if (animMarkerRef.current) mapInstance.current.geoObjects.remove(animMarkerRef.current);
    animMarkerRef.current = new ymaps.Placemark(
      [pt.lat, pt.lon],
      {
        hintContent: `${fmtTime(pt.t)} | ${pt.speed} км/ч | ⛽ ${pt.fuel} л`,
      },
      {
        preset: "islands#blueAutoIcon",
        zIndex: 9999,
      }
    );
    mapInstance.current.geoObjects.add(animMarkerRef.current);
    // Follow marker
    mapInstance.current.panTo([pt.lat, pt.lon], { flying: false, duration: 200 });
  }, [sliderIndex, track]);

  // Auto-play
  useEffect(() => {
    if (playing && track.length > 1) {
      playIntervalRef.current = setInterval(() => {
        setSliderIndex(prev => {
          if (prev >= track.length - 1) { setPlaying(false); return prev; }
          return prev + 1;
        });
      }, 1000 / playSpeed);
    }
    return () => { if (playIntervalRef.current) clearInterval(playIntervalRef.current); };
  }, [playing, playSpeed, track]);

  // Fullscreen: middle click on map container
  const handleMiddleClick = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) { // middle button
      e.preventDefault();
      toggleFullscreen();
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
    // Give map time to resize
    setTimeout(() => {
      if (mapInstance.current) mapInstance.current.container.fitToViewport();
    }, 100);
  }, []);

  // ESC to exit fullscreen
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) setIsFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFullscreen]);

  // Resize map when fullscreen toggles
  useEffect(() => {
    setTimeout(() => {
      if (mapInstance.current) mapInstance.current.container.fitToViewport();
    }, 200);
  }, [isFullscreen]);

  // Quick period helpers
  const quickPeriod = (hours: number) => {
    const to = new Date();
    const from = new Date(to.getTime() - hours * 3600000);
    setDateFrom(from.toISOString().slice(0, 16));
    setDateTo(to.toISOString().slice(0, 16));
  };
  const setToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); setDateFrom(d.toISOString().slice(0, 16)); setDateTo(new Date().toISOString().slice(0, 16)); };
  const setYesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(0, 0, 0, 0); const d2 = new Date(d); d2.setHours(23, 59, 59); setDateFrom(d.toISOString().slice(0, 16)); setDateTo(d2.toISOString().slice(0, 16)); };

  const currentPoint = track[sliderIndex] || null;
  const stops = events.filter(e => e.type === "stop");
  const refuels = events.filter(e => e.type === "refuel");
  const drains = events.filter(e => e.type === "drain");
  const overspeeds = events.filter(e => e.type === "overspeed");

  // Compute cumulative distance for each point
  const cumDist = useMemo(() => {
    const arr = [0];
    for (let i = 1; i < track.length; i++) arr.push(arr[i - 1] + (+track[i].dist || 0));
    return arr;
  }, [track]);

  // Build slider gradient (colored segments)
  const sliderGradient = useMemo(() => {
    if (track.length < 2) return "linear-gradient(to right, #6b7280, #6b7280)";
    const stops: string[] = [];
    for (let i = 0; i < track.length; i++) {
      const pct = (i / (track.length - 1)) * 100;
      stops.push(`${sliderSegmentColor(track[i].speed)} ${pct.toFixed(1)}%`);
    }
    return `linear-gradient(to right, ${stops.join(", ")})`;
  }, [track]);

  return (
    <div className={`bg-slate-900 text-white ${isFullscreen ? "fixed inset-0 z-[9999] flex flex-col" : "min-h-screen"}`}>
      {/* Toolbar */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-2 flex flex-wrap items-center gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <Navigation className="w-5 h-5 text-blue-400" />
          <span className="font-bold text-sm">Треки</span>
        </div>

        {/* Searchable vehicle dropdown */}
        <div className="relative" ref={vehDropdownRef}>
          <button onClick={() => setVehDropdownOpen(!vehDropdownOpen)}
            className="bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm min-w-[220px] text-left flex items-center justify-between gap-2 hover:border-slate-500 transition">
            <span className={selectedVehicle ? "text-white" : "text-slate-400"}>
              {selectedVehicle ? `${selectedVehicle.toUpperCase()} — ${vehicles.find(v => v.vehicle === selectedVehicle)?.vehicle_type || ""}` : "Выберите машину"}
            </span>
            <svg className={`w-3 h-3 text-slate-400 transition ${vehDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
          </button>
          {vehDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-[280px] bg-slate-900 border border-slate-600 rounded-lg shadow-xl z-50 max-h-[400px] flex flex-col">
              <div className="p-2 border-b border-slate-700">
                <input
                  type="text" value={vehSearch} onChange={e => setVehSearch(e.target.value)}
                  placeholder="Поиск по номеру или типу..."
                  autoFocus
                  className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="overflow-y-auto flex-1">
                {vehicles
                  .filter(v => !vehSearch || v.vehicle.toLowerCase().includes(vehSearch.toLowerCase()) || (v.vehicle_type || "").toLowerCase().includes(vehSearch.toLowerCase()) || (v.model || "").toLowerCase().includes(vehSearch.toLowerCase()))
                  .map(v => (
                    <button key={v.vehicle} onClick={() => { setSelectedVehicle(v.vehicle); setVehDropdownOpen(false); setVehSearch(""); }}
                      className={`w-full text-left px-3 py-1.5 text-sm hover:bg-slate-800 flex items-center gap-2 transition ${v.vehicle === selectedVehicle ? "bg-blue-600/20 text-blue-400" : ""}`}>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${v.movement_status === "moving" ? "bg-green-500" : "bg-slate-500"}`} />
                      <span className="font-mono">{v.vehicle.toUpperCase()}</span>
                      <span className="text-slate-400 text-xs">— {v.vehicle_type || v.model || ""}</span>
                    </button>
                  ))}
                {vehicles.filter(v => !vehSearch || v.vehicle.toLowerCase().includes(vehSearch.toLowerCase()) || (v.vehicle_type || "").toLowerCase().includes(vehSearch.toLowerCase())).length === 0 && (
                  <div className="px-3 py-4 text-center text-slate-500 text-sm">Не найдено</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-1">
          {[["Сегодня", setToday], ["Вчера", setYesterday], ["3 дня", () => quickPeriod(72)], ["Неделя", () => quickPeriod(168)]].map(([label, fn]) => (
            <button key={label as string} onClick={fn as any}
              className="px-2 py-1 rounded text-xs bg-slate-700 hover:bg-slate-600 transition">{label as string}</button>
          ))}
        </div>

        <input type="datetime-local" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs" />
        <span className="text-slate-500 text-xs">→</span>
        <input type="datetime-local" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs" />

        <button onClick={fetchTrack} disabled={loading || !selectedVehicle}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-1 rounded text-sm font-medium flex items-center gap-1">
          {loading ? <Activity className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Загрузить
        </button>
      </div>

      {/* Map container */}
      <div className={`relative ${isFullscreen ? "flex-1" : ""}`}
        ref={containerRef}
        onMouseDown={handleMiddleClick}
        onAuxClick={e => e.preventDefault()}
      >
        <div ref={mapRef} style={{ width: "100%", height: isFullscreen ? "100%" : "50vh", minHeight: 350 }} className="bg-slate-800" />
        
        {/* Fullscreen toggle button */}
        <button onClick={toggleFullscreen}
          className="absolute top-3 right-3 bg-slate-800/80 hover:bg-slate-700 p-2 rounded-lg border border-slate-600/50 z-10 transition"
          title="Полный экран (или средняя кнопка мыши)">
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>

        {/* Speed legend */}
        {track.length > 0 && (
          <div className="absolute bottom-2 left-2 bg-slate-900/80 rounded-lg px-3 py-1.5 text-[10px] flex gap-2 z-10 items-center">
            <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded bg-[#22c55e] inline-block" /> &lt;60</span>
            <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded bg-[#3b82f6] inline-block" /> 60-80</span>
            <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded bg-[#eab308] inline-block" /> 80-90</span>
            <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded bg-[#ef4444] inline-block" /> &gt;90</span>
            <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded bg-[#6b7280] inline-block" /> стоит</span>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TIMELINE SLIDER — big, full width, main control element      */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {track.length > 0 && (
        <div className="bg-slate-800 border-t border-slate-700 px-4 py-3 shrink-0">
          {/* Current point indicators */}
          <div className="flex items-center justify-between mb-2 text-sm">
            {/* Left: time + status */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="font-mono font-bold text-lg">{currentPoint ? fmtTime(currentPoint.t) : "—"}</span>
              </div>
              <div className={`px-2 py-0.5 rounded-full text-xs font-bold ${currentPoint && currentPoint.speed > 1 ? "bg-green-600/30 text-green-400" : "bg-slate-600/30 text-slate-400"}`}>
                {currentPoint && currentPoint.speed > 1 ? "В движении" : "Стоит"}
              </div>
            </div>

            {/* Center: speed */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-slate-400" />
                <span className="font-mono text-lg" style={{ color: currentPoint ? speedColor(currentPoint.speed) : "#fff" }}>
                  {currentPoint ? Math.round(currentPoint.speed) : 0}
                </span>
                <span className="text-slate-400 text-xs">км/ч</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Fuel className="w-4 h-4 text-slate-400" />
                <span className="font-mono text-lg">{currentPoint ? Math.round(currentPoint.fuel) : 0}</span>
                <span className="text-slate-400 text-xs">л</span>
              </div>
              <div className="text-slate-400 text-xs">
                {cumDist[sliderIndex] !== undefined ? `${Math.round(cumDist[sliderIndex])} км` : ""}
              </div>
            </div>

            {/* Right: play controls */}
            <div className="flex items-center gap-2">
              <button onClick={() => { setSliderIndex(0); }} className="px-2 py-1 rounded text-xs bg-slate-700 hover:bg-slate-600" title="В начало">⏮</button>
              <button onClick={() => setPlaying(!playing)} className="p-1.5 rounded bg-slate-700 hover:bg-slate-600">
                {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <select value={playSpeed} onChange={e => setPlaySpeed(+e.target.value)}
                className="bg-slate-900 border border-slate-600 rounded px-1 py-0.5 text-xs">
                {[1, 5, 10, 50, 100].map(s => <option key={s} value={s}>×{s}</option>)}
              </select>
            </div>
          </div>

          {/* THE SLIDER */}
          <div className="relative">
            {/* Colored background strip */}
            <div className="h-4 rounded-full overflow-hidden" style={{ background: sliderGradient }}>
              {/* Transparent overlay for played portion */}
              <div className="h-full bg-black/30 rounded-full transition-none"
                style={{ width: `${((track.length - 1 - sliderIndex) / Math.max(track.length - 1, 1)) * 100}%`, marginLeft: "auto" }} />
            </div>
            {/* Actual range input overlaid */}
            <input
              type="range"
              min={0}
              max={track.length - 1}
              value={sliderIndex}
              onChange={e => { setSliderIndex(+e.target.value); setPlaying(false); }}
              className="absolute inset-0 w-full h-4 opacity-0 cursor-pointer"
              style={{ WebkitAppearance: "none", zIndex: 5 }}
            />
            {/* Thumb indicator */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-full shadow-lg border-2 border-blue-500 pointer-events-none transition-none"
              style={{ left: `calc(${(sliderIndex / Math.max(track.length - 1, 1)) * 100}% - 10px)`, zIndex: 4 }}
            />
          </div>

          {/* Time labels */}
          <div className="flex justify-between mt-1 text-[10px] text-slate-500">
            <span>{fmtTime(track[0]?.t || "")}</span>
            {track.length > 10 && <span>{fmtTime(track[Math.floor(track.length / 4)]?.t || "")}</span>}
            {track.length > 10 && <span>{fmtTime(track[Math.floor(track.length / 2)]?.t || "")}</span>}
            {track.length > 10 && <span>{fmtTime(track[Math.floor(track.length * 3 / 4)]?.t || "")}</span>}
            <span>{fmtTime(track[track.length - 1]?.t || "")}</span>
          </div>
        </div>
      )}

      {/* Bottom panel — Tabs (hidden in fullscreen) */}
      {summary && !isFullscreen && (
        <div className="border-t border-slate-700">
          <div className="bg-slate-800 px-4 flex gap-1 border-b border-slate-700 overflow-x-auto">
            {[
              ["summary", "📊 Сводка"],
              ["stops", `🅿️ Остановки (${stops.length})`],
              ["fuel", `⛽ Топливо`],
              ["speed", `🏎 Скорость`],
              ["events", `📜 События (${events.length})`],
            ].map(([key, label]) => (
              <button key={key} onClick={() => setActiveTab(key)}
                className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 transition ${activeTab === key ? "border-blue-500 text-white" : "border-transparent text-slate-400 hover:text-white"}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="p-4 max-h-[30vh] overflow-y-auto">
            {/* Summary tab */}
            {activeTab === "summary" && (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                {[
                  ["📏 Пробег", `${fmt(Math.round(summary.totalDistance))} км`, ""],
                  ["⛽ Расход", `${fmt(Math.round(summary.totalFuel))} л`, ""],
                  ["📊 л/100км", `${summary.consumption}`, summary.consumption > 30 ? "text-red-400" : summary.consumption > 25 ? "text-amber-400" : "text-green-400"],
                  ["🏎 Ср. скорость", `${summary.avgSpeed} км/ч`, ""],
                  ["🚨 Макс.", `${summary.maxSpeed} км/ч`, summary.maxSpeed > 90 ? "text-red-400" : ""],
                  ["⏱ Вождение", summary.driveTime, ""],
                  ["🅿️ Остановки", `${summary.stopsCount}`, ""],
                  ["⛽ Заправки", `${summary.refuelsCount}`, ""],
                  ["🚨 Превыш.", `${summary.overspeedCount}`, summary.overspeedCount > 0 ? "text-red-400" : ""],
                  ["📍 Точек", `${summary.points}`, ""],
                ].map(([label, value, cls]) => (
                  <div key={label as string} className="bg-slate-800 rounded-lg p-3 border border-slate-700/50">
                    <div className="text-xs text-slate-400 mb-1">{label}</div>
                    <div className={`text-lg font-bold ${cls || "text-white"}`}>{value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Stops tab */}
            {activeTab === "stops" && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-700">
                    <th className="text-left py-1">#</th><th className="text-left">Начало</th>
                    <th className="text-left">Конец</th><th className="text-left">Длительность</th>
                    <th className="text-left">Координаты</th>
                  </tr>
                </thead>
                <tbody>
                  {stops.map((s, i) => (
                    <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-800/50 cursor-pointer"
                      onClick={() => { if (mapInstance.current) mapInstance.current.setCenter([s.lat, s.lon], 14, { duration: 300 }); }}>
                      <td className="py-1">{i + 1}</td>
                      <td>{fmtTime(s.from || "")}</td>
                      <td>{fmtTime(s.to || "")}</td>
                      <td className="font-medium">{s.duration}</td>
                      <td className="text-slate-400 font-mono text-xs">{s.lat.toFixed(4)}, {s.lon.toFixed(4)}</td>
                    </tr>
                  ))}
                  {stops.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-slate-500">Нет остановок</td></tr>}
                </tbody>
              </table>
            )}

            {/* Fuel tab */}
            {activeTab === "fuel" && (
              <div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <div className="bg-slate-800 rounded p-3 border border-slate-700/50">
                    <div className="text-xs text-slate-400">Начало</div>
                    <div className="text-lg font-bold">{track[0]?.fuel || 0} л</div>
                  </div>
                  <div className="bg-slate-800 rounded p-3 border border-slate-700/50">
                    <div className="text-xs text-slate-400">Конец</div>
                    <div className="text-lg font-bold">{track[track.length - 1]?.fuel || 0} л</div>
                  </div>
                  <div className="bg-green-900/30 rounded p-3 border border-green-800/50">
                    <div className="text-xs text-green-400">Заправки</div>
                    <div className="text-lg font-bold text-green-400">
                      {refuels.length > 0 ? `+${refuels.reduce((s, r) => s + (r.amount || 0), 0)} л` : "нет"}
                    </div>
                  </div>
                  <div className={`rounded p-3 border ${drains.length > 0 ? "bg-red-900/30 border-red-800/50" : "bg-slate-800 border-slate-700/50"}`}>
                    <div className={`text-xs ${drains.length > 0 ? "text-red-400" : "text-slate-400"}`}>Сливы</div>
                    <div className={`text-lg font-bold ${drains.length > 0 ? "text-red-400" : ""}`}>
                      {drains.length > 0 ? `-${drains.reduce((s, r) => s + (r.amount || 0), 0)} л` : "нет"}
                    </div>
                  </div>
                </div>
                {/* Fuel chart bars */}
                <div className="bg-slate-800 rounded p-3 border border-slate-700/50 h-32 flex items-end gap-[1px]">
                  {track.filter((_, i) => i % Math.max(1, Math.floor(track.length / 200)) === 0).map((p, i) => {
                    const maxFuel = Math.max(...track.map(t => t.fuel || 0), 1);
                    const h = ((p.fuel || 0) / maxFuel) * 100;
                    return <div key={i} className="flex-1 min-w-[1px] bg-cyan-500/60 rounded-t" style={{ height: `${h}%` }}
                      title={`${fmtTime(p.t)}: ${p.fuel} л`} />;
                  })}
                </div>
              </div>
            )}

            {/* Speed tab */}
            {activeTab === "speed" && (
              <div>
                <div className="bg-slate-800 rounded p-3 border border-slate-700/50 h-32 flex items-end gap-[1px] relative">
                  <div className="absolute left-0 right-0 border-t border-dashed border-red-500/50"
                    style={{ bottom: `${(90 / Math.max(summary.maxSpeed, 100)) * 100}%` }}>
                    <span className="text-[10px] text-red-400 absolute -top-3 right-1">90 км/ч</span>
                  </div>
                  {track.filter((_, i) => i % Math.max(1, Math.floor(track.length / 300)) === 0).map((p, i) => {
                    const maxS = Math.max(summary.maxSpeed, 100);
                    const h = (p.speed / maxS) * 100;
                    return <div key={i} className="flex-1 min-w-[1px] rounded-t"
                      style={{ height: `${h}%`, backgroundColor: speedColor(p.speed) }}
                      title={`${fmtTime(p.t)}: ${p.speed} км/ч`} />;
                  })}
                </div>
                {overspeeds.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-sm font-medium mb-2 text-red-400">🚨 Превышения ({overspeeds.length})</h4>
                    {overspeeds.map((e, i) => (
                      <div key={i} className="text-sm text-slate-300 mb-1 cursor-pointer hover:text-white"
                        onClick={() => { if (mapInstance.current) mapInstance.current.setCenter([e.lat, e.lon], 14); }}>
                        {fmtTime(e.time || "")} — {e.maxSpeed} км/ч
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Events tab */}
            {activeTab === "events" && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-700">
                    <th className="text-left py-1">Время</th><th className="text-left">Тип</th>
                    <th className="text-left">Детали</th><th className="text-left">Координаты</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e, i) => {
                    const labels: Record<string, string> = { stop: "🅿️ Остановка", refuel: "⛽ Заправка", drain: "⚠️ Слив", overspeed: "🚨 Скорость" };
                    return (
                      <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-800/50 cursor-pointer"
                        onClick={() => { if (mapInstance.current) mapInstance.current.setCenter([e.lat, e.lon], 14); }}>
                        <td className="py-1">{fmtTime(e.from || e.time || "")}</td>
                        <td>{labels[e.type] || e.type}</td>
                        <td>{e.type === "stop" ? e.duration : e.type === "refuel" ? `+${e.amount} л` : e.type === "drain" ? `-${e.amount} л` : e.type === "overspeed" ? `${e.maxSpeed} км/ч` : ""}</td>
                        <td className="text-slate-400 font-mono text-xs">{e.lat?.toFixed(4)}, {e.lon?.toFixed(4)}</td>
                      </tr>
                    );
                  })}
                  {events.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-slate-500">Нет событий</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
