"use client";
import dynamic from "next/dynamic";
import type { YandexMapCircle } from "./YandexMap";

const YandexMap = dynamic(() => import("./YandexMap"), { ssr: false });

interface Zone {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_m: number;
}

interface Props {
  zones: Zone[];
  onMapClick?: (lat: number, lon: number) => void;
  selectedZone?: Zone | null;
}

export default function GeofenceMap({ zones, onMapClick, selectedZone }: Props) {
  const circles: YandexMapCircle[] = zones.map(z => ({
    lat: z.latitude,
    lon: z.longitude,
    radius: z.radius_m,
    color: selectedZone?.id === z.id ? "#ff4444" : "#4488ff",
    hint: z.name,
  }));

  const center: [number, number] = selectedZone
    ? [selectedZone.latitude, selectedZone.longitude]
    : zones.length > 0
    ? [zones[0].latitude, zones[0].longitude]
    : [56.5, 50];

  return (
    <YandexMap
      height="100%"
      center={center}
      zoom={selectedZone ? 12 : 6}
      circles={circles}
      onMapClick={onMapClick ? (lat, lon) => onMapClick(lat, lon) : undefined}
    />
  );
}
