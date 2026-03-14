"use client";
import { useMemo } from "react";
import dynamic from "next/dynamic";
import type { YandexMapMarker, YandexMapPolyline } from "./YandexMap";

const YandexMap = dynamic(() => import("./YandexMap"), { ssr: false });

interface Point {
  lat: number;
  lon: number;
  speed?: number;
  timestamp?: string;
}

interface Props {
  track: Point[];
  events?: { lat: number; lon: number; type: string; label: string }[];
  height?: string;
}

export default function TripMap({ track, events = [], height = "100%" }: Props) {
  const polylines: YandexMapPolyline[] = useMemo(() => {
    if (!track?.length) return [];
    return [{
      coords: track.map(p => [p.lat, p.lon] as [number, number]),
      color: "#4488ff",
      width: 3,
    }];
  }, [track]);

  const markers: YandexMapMarker[] = useMemo(() => {
    const m: YandexMapMarker[] = [];
    if (track?.length > 0) {
      m.push({
        id: "start",
        lat: track[0].lat,
        lon: track[0].lon,
        preset: "islands#greenDotIcon",
        hint: "Старт",
        balloon: `Старт: ${track[0].timestamp ? new Date(track[0].timestamp).toLocaleString("ru-RU") : ""}`,
      });
      const last = track[track.length - 1];
      m.push({
        id: "end",
        lat: last.lat,
        lon: last.lon,
        preset: "islands#redDotIcon",
        hint: "Финиш",
        balloon: `Финиш: ${last.timestamp ? new Date(last.timestamp).toLocaleString("ru-RU") : ""}`,
      });
    }
    for (const ev of events) {
      const preset = ev.type === "stop" ? "islands#orangeCircleDotIcon"
        : ev.type === "fuel" ? "islands#darkGreenCircleDotIcon"
        : "islands#grayCircleDotIcon";
      m.push({
        id: `ev-${ev.lat}-${ev.lon}`,
        lat: ev.lat,
        lon: ev.lon,
        preset,
        hint: ev.label,
        balloon: ev.label,
      });
    }
    return m;
  }, [track, events]);

  return <YandexMap height={height} markers={markers} polylines={polylines} />;
}
