"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Truck, MapPin, Gauge, Clock, Search, Signal, SignalZero } from "lucide-react";

declare global { interface Window { ymaps: any; } }

function loadYmaps(): Promise<void> {
  if ((window as any).__ymapsPromise) return (window as any).__ymapsPromise;
  (window as any).__ymapsPromise = new Promise<void>((resolve) => {
    if (window.ymaps?.ready) { window.ymaps.ready(resolve); return; }
    const s = document.createElement("script");
    s.src = "https://api-maps.yandex.ru/2.1/?apikey=62e1137c-2502-43bf-8986-55c56e740837&lang=ru_RU";
    s.onload = () => window.ymaps.ready(resolve);
    document.head.appendChild(s);
  });
  return (window as any).__ymapsPromise;
}

function getStatus(v: any) {
  const age = (Date.now() - new Date(v.gps_time || 0).getTime()) / 3600000;
  if (age > 72) return { label: "Офлайн", color: "text-gray-400", dot: "bg-gray-400", mapColor: "#9ca3af" };
  if (age > 24) return { label: "Нет связи", color: "text-red-400", dot: "bg-red-400", mapColor: "#f87171" };
  if ((v.speed || 0) > 5) return { label: `${Math.min(v.speed,150)} км/ч`, color: "text-green-400", dot: "bg-green-400", mapColor: "#4ade80" };
  return { label: "Стоит", color: "text-blue-400", dot: "bg-blue-400", mapColor: "#60a5fa" };
}

export default function DispatchPage() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all"|"moving"|"stopped"|"offline">("all");
  const mapRef = useRef<any>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const markersRef = useRef<any[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/dispatch-wp/gps");
      if (res.ok) setVehicles(await res.json());
    } catch {}
  }, []);

  useEffect(() => { fetchData(); const t = setInterval(fetchData, 30000); return () => clearInterval(t); }, [fetchData]);

  useEffect(() => {
    if (!vehicles.length || !mapContainer.current) return;
    loadYmaps().then(() => {
      if (!mapRef.current) {
        mapRef.current = new window.ymaps.Map(mapContainer.current, {
          center: [55.75, 49.13], zoom: 6,
          controls: ["zoomControl", "fullscreenControl"]
        });
      }
      const map = mapRef.current;
      markersRef.current.forEach((m: any) => map.geoObjects.remove(m));
      markersRef.current = [];
      vehicles.filter(v => v.lat && v.lon).forEach(v => {
        const s = getStatus(v);
        const pm = new window.ymaps.Placemark([v.lat, v.lon], {
          balloonContentHeader: v.license_plate,
          balloonContentBody: `${s.label}<br/>Водитель: ${v.current_driver || "—"}`,
          hintContent: v.license_plate,
        }, {
          preset: "islands#circleDotIcon",
          iconColor: s.mapColor,
        });
        map.geoObjects.add(pm);
        markersRef.current.push(pm);
      });
    });
  }, [vehicles]);

  const filtered = vehicles.filter(v => {
    if (search && !v.license_plate?.toLowerCase().includes(search.toLowerCase()) && 
        !(v.current_driver||"").toLowerCase().includes(search.toLowerCase())) return false;
    const s = getStatus(v);
    if (filter === "moving" && !s.label.includes("км/ч")) return false;
    if (filter === "stopped" && s.label !== "Стоит") return false;
    if (filter === "offline" && !["Офлайн","Нет связи"].includes(s.label)) return false;
    return true;
  });

  const moving = vehicles.filter(v => (v.speed||0) > 5).length;
  const stopped = vehicles.filter(v => { const age = (Date.now() - new Date(v.gps_time||0).getTime())/3600000; return age <= 24 && (v.speed||0) <= 5; }).length;
  const offline = vehicles.filter(v => (Date.now() - new Date(v.gps_time||0).getTime())/3600000 > 24).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-white">Диспетчерская — GPS мониторинг</h1>
        <div className="flex gap-2">
          <Link href="/dispatch/wb" className="px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg">ВБ рейсы</Link>
          <Link href="/command" className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-lg">Командный центр</Link>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-slate-800 rounded-xl p-3 border border-slate-700 text-center">
          <div className="text-2xl font-bold text-white">{vehicles.length}</div>
          <div className="text-slate-400 text-xs">Всего</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-3 border border-green-500/30 text-center cursor-pointer hover:border-green-500/60" onClick={() => setFilter(f => f === "moving" ? "all" : "moving")}>
          <div className="text-2xl font-bold text-green-400">{moving}</div>
          <div className="text-slate-400 text-xs">В движении</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-3 border border-blue-500/30 text-center cursor-pointer hover:border-blue-500/60" onClick={() => setFilter(f => f === "stopped" ? "all" : "stopped")}>
          <div className="text-2xl font-bold text-blue-400">{stopped}</div>
          <div className="text-slate-400 text-xs">Стоят</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-3 border border-red-500/30 text-center cursor-pointer hover:border-red-500/60" onClick={() => setFilter(f => f === "offline" ? "all" : "offline")}>
          <div className="text-2xl font-bold text-red-400">{offline}</div>
          <div className="text-slate-400 text-xs">Офлайн</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden" style={{height: 500}}>
          <div ref={mapContainer} style={{width: "100%", height: "100%"}} />
        </div>
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-3" style={{maxHeight: 500, overflowY: "auto"}}>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по номеру или водителю..."
              className="w-full bg-slate-900 text-white pl-9 pr-3 py-2 rounded-lg border border-slate-700 text-sm"
            />
          </div>
          <div className="space-y-1">
            {filtered.map(v => {
              const s = getStatus(v);
              return (
                <Link key={v.id || v.license_plate} href={`/vehicles/${v.id}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-700/50 transition">
                  <div className={`w-2 h-2 rounded-full ${s.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium">{v.license_plate}</div>
                    <div className="text-slate-500 text-xs truncate">{v.current_driver || "—"}</div>
                  </div>
                  <div className={`text-xs ${s.color}`}>{s.label}</div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
