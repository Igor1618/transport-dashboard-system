"use client";
import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light") { setDark(false); document.documentElement.classList.remove("dark"); }
    else { document.documentElement.classList.add("dark"); }
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem("theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  };

  return (
    <button onClick={toggle} className="p-2 rounded-lg hover:bg-slate-700 transition-colors" title={dark ? "Светлая тема" : "Тёмная тема"}>
      {dark ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-slate-400" />}
    </button>
  );
}
