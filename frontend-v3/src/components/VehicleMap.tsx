"use client";
import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { apiFetchJson } from "@/shared/utils/apiFetch";
import type { YandexMapMarker } from "./YandexMap";

const YandexMap = dynamic(() => import("./YandexMap"), { ssr: false });

interface Vehicle {
  vehicle?: string;
  license_plate?: string;
  lat?: number;
  lon?: number;
  latitude?: number;
  longitude?: number;
  speed: number;
  gps_time?: string;
  updated_at?: string;
  gps_status?: string;
  direction?: number;
  heading?: number;
}

function getStatusColor(v: Vehicle): string {
  const t = v.gps_time || v.updated_at || "";
  if (!t) return "gray";
  const age = (Date.now() - new Date(t).getTime()) / 3600000;
  if (age > 72) return "gray";
  if (age > 24) return "red";
  if (v.speed > 5) return "green";
  if (v.gps_status === "idle_engine_on") return "orange";
  return "blue";
}

function getStatusLabel(v: Vehicle): string {
  const t = v.gps_time || v.updated_at || "";
  if (!t) return "Нет GPS";
  const age = (Date.now() - new Date(t).getTime()) / 3600000;
  if (age > 72) return "Нет связи >3д";
  if (age > 24) return "Нет связи >1д";
  if (v.speed > 5) return `В движении ${Math.round(v.speed)} км/ч`;
  if (v.gps_status === "idle_engine_on") return "Стоит, двигатель вкл";
  return "На стоянке";
}

export default function VehicleMap({ height = "400px", className = "" }: { height?: string; className?: string }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    const load = () => {
      apiFetchJson("/api/dispatch-wp/gps")
        .then((d: any) => { if (Array.isArray(d)) setVehicles(d); })
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, []);

  const markers: YandexMapMarker[] = useMemo(() =>
    vehicles
      .filter(v => (v.lat || v.latitude) && (v.lon || v.longitude))
      .map(v => {
        const name = v.vehicle || v.license_plate || "?";
        const t = v.gps_time || v.updated_at || "";
        return {
          id: name,
          lat: v.lat || v.latitude || 0,
          lon: v.lon || v.longitude || 0,
          color: getStatusColor(v),
          hint: name,
          balloon: `<b>${name}</b><br/>${getStatusLabel(v)}<br/>GPS: ${t ? new Date(t).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" }) : "—"}`,
        };
      }),
    [vehicles]
  );

  return <YandexMap height={height} className={className} markers={markers} />;
}
