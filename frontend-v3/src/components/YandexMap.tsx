"use client";
import { useEffect, useRef, useState, useCallback } from "react";

const API_KEY = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY || "";

let ymapsPromise: Promise<any> | null = null;

function loadYmaps(): Promise<any> {
  if (ymapsPromise) return ymapsPromise;
  if ((window as any).ymaps) return Promise.resolve((window as any).ymaps);
  ymapsPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://api-maps.yandex.ru/2.1/?apikey=${API_KEY}&lang=ru_RU`;
    s.onload = () => {
      (window as any).ymaps.ready(() => resolve((window as any).ymaps));
    };
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return ymapsPromise;
}

export interface YandexMapMarker {
  id: string;
  lat: number;
  lon: number;
  color?: string;
  preset?: string;
  hint?: string;
  balloon?: string;
  iconContent?: string;
}

export interface YandexMapCircle {
  lat: number;
  lon: number;
  radius: number;
  color?: string;
  hint?: string;
}

export interface YandexMapPolyline {
  coords: [number, number][];
  color?: string;
  width?: number;
}

interface Props {
  height?: string;
  className?: string;
  center?: [number, number];
  zoom?: number;
  markers?: YandexMapMarker[];
  circles?: YandexMapCircle[];
  polylines?: YandexMapPolyline[];
  onMapClick?: (lat: number, lon: number) => void;
  fitBounds?: boolean;
}

export default function YandexMap({
  height = "400px",
  className = "",
  center = [56.5, 50],
  zoom = 6,
  markers = [],
  circles = [],
  polylines = [],
  onMapClick,
  fitBounds = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const objectsRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  // Init map
  useEffect(() => {
    let mounted = true;
    loadYmaps().then((ymaps) => {
      if (!mounted || !containerRef.current || mapRef.current) return;
      mapRef.current = new ymaps.Map(containerRef.current, {
        center,
        zoom,
        controls: ["zoomControl", "fullscreenControl"],
      });
      if (onMapClick) {
        mapRef.current.events.add("click", (e: any) => {
          const coords = e.get("coords");
          onMapClick(coords[0], coords[1]);
        });
      }
      setReady(true);
    });
    return () => { mounted = false; };
  }, []);

  // Update objects
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const ymaps = (window as any).ymaps;
    if (!ymaps) return;

    // Clear old
    if (objectsRef.current) {
      mapRef.current.geoObjects.remove(objectsRef.current);
    }
    const collection = new ymaps.GeoObjectCollection();

    // Markers
    for (const m of markers) {
      if (!m.lat || !m.lon) continue;
      const pm = new ymaps.Placemark(
        [m.lat, m.lon],
        {
          hintContent: m.hint || "",
          balloonContent: m.balloon || "",
          iconContent: m.iconContent || "",
        },
        {
          preset: m.preset || (m.color ? `islands#${m.color}DotIcon` : "islands#blueDotIcon"),
        }
      );
      collection.add(pm);
    }

    // Circles
    for (const c of circles) {
      if (!c.lat || !c.lon) continue;
      const circle = new ymaps.Circle(
        [[c.lat, c.lon], c.radius || 1000],
        { hintContent: c.hint || "" },
        {
          fillColor: (c.color || "#0066ff") + "33",
          strokeColor: c.color || "#0066ff",
          strokeWidth: 2,
        }
      );
      collection.add(circle);
    }

    // Polylines
    for (const p of polylines) {
      if (!p.coords?.length) continue;
      const line = new ymaps.Polyline(
        p.coords,
        {},
        {
          strokeColor: p.color || "#4488ff",
          strokeWidth: p.width || 3,
          strokeOpacity: 0.8,
        }
      );
      collection.add(line);
    }

    mapRef.current.geoObjects.add(collection);
    objectsRef.current = collection;

    // Fit bounds
    if (fitBounds && collection.getLength() > 0) {
      try {
        mapRef.current.setBounds(collection.getBounds(), { checkZoomRange: true, zoomMargin: 40 });
      } catch {}
    }
  }, [ready, markers, circles, polylines]);

  return (
    <div
      ref={containerRef}
      className={`rounded-lg overflow-hidden ${className}`}
      style={{ height, width: "100%" }}
    />
  );
}
