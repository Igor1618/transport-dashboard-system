"use client";
import { formatDate, formatDateTime, formatShortDate } from "@/lib/dates";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Upload, Trash2, FileText, Users, DollarSign, Calendar, Loader2 } from "lucide-react";

interface Register {
  id: number;
  register_number: string;
  register_date: string;
  organization: string;
  total_amount: number;
  employees_count: number;
  uploaded_at: string;
}

interface Payment {
  id: number;
  full_name: string;
  amount: number;
  bank_account: string;
  driver_id: string | null;
  driver_name: string | null;
}

export default function SalaryPage() {
  const [registers, setRegisters] = useState<Register[]>([]);
  const [selectedRegister, setSelectedRegister] = useState<Register | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadRegisters(); }, []);

  const loadRegisters = async () => {
    try {
      const res = await fetch("/api/salary/registers");
      const data = await res.json();
      setRegisters(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const loadRegisterDetails = async (reg: Register) => {
    setSelectedRegister(reg);
    try {
      const res = await fetch(`/api/salary/registers/${reg.id}`);
      const data = await res.json();
      setPayments(data.payments || []);
    } catch (e) { console.error(e); }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    setError("");
    
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await fetch("/api/salary/upload", { method: "POST", body: formData });
      const data = await res.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        loadRegisters();
        setError("");
      }
    } catch (e) {
      setError("Ошибка загрузки");
    }
    
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Удалить ведомость?")) return;
    await fetch(`/api/salary/registers/${id}`, { method: "DELETE" });
    loadRegisters();
    if (selectedRegister?.id === id) {
      setSelectedRegister(null);
      setPayments([]);
    }
  };

  const totalAll = registers.reduce((sum, r) => sum + Number(r.total_amount), 0);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/" className="p-2 hover:bg-slate-700 rounded-lg">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-2xl font-bold">💰 Зарплатные ведомости</h1>
        </div>

        {/* Upload */}
        <div className="bg-slate-800 rounded-xl p-4 mb-6 border border-slate-700">
          <div className="flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml"
              onChange={handleUpload}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className={`flex items-center gap-2 px-6 py-3 rounded-lg cursor-pointer transition ${
                uploading ? "bg-slate-600" : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {uploading ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
              {uploading ? "Загрузка..." : "Загрузить XML"}
            </label>
            <span className="text-slate-400 text-sm">Формат: XML из 1С (зарплатная ведомость)</span>
          </div>
          {error && <div className="mt-3 text-red-400">{error}</div>}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="text-slate-400 text-sm flex items-center gap-2"><FileText size={16} /> Ведомостей</div>
            <div className="text-3xl font-bold text-cyan-400">{registers.length}</div>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="text-slate-400 text-sm flex items-center gap-2"><Users size={16} /> Выплат</div>
            <div className="text-3xl font-bold text-green-400">
              {registers.reduce((sum, r) => sum + r.employees_count, 0)}
            </div>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="text-slate-400 text-sm flex items-center gap-2"><DollarSign size={16} /> Всего</div>
            <div className="text-3xl font-bold text-yellow-400">
              {totalAll.toLocaleString("ru-RU")} ₽
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Registers list */}
          <div className="bg-slate-800 rounded-xl border border-slate-700">
            <div className="p-4 border-b border-slate-700">
              <h2 className="font-semibold">Загруженные ведомости</h2>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-slate-400">Загрузка...</div>
              ) : registers.length === 0 ? (
                <div className="p-4 text-center text-slate-400">Нет загруженных ведомостей</div>
              ) : (
                registers.map(reg => (
                  <div
                    key={reg.id}
                    onClick={() => loadRegisterDetails(reg)}
                    className={`p-4 border-b border-slate-700 cursor-pointer hover:bg-slate-700/50 transition ${
                      selectedRegister?.id === reg.id ? "bg-slate-700" : ""
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">Реестр №{reg.register_number}</div>
                        <div className="text-sm text-slate-400 flex items-center gap-2">
                          <Calendar size={14} />
                          {formatDate(reg.register_date)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-green-400 font-semibold">
                          {Number(reg.total_amount).toLocaleString("ru-RU")} ₽
                        </div>
                        <div className="text-sm text-slate-400">{reg.employees_count} чел.</div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(reg.id); }}
                      className="mt-2 text-red-400 hover:text-red-300 text-sm flex items-center gap-1"
                    >
                      <Trash2 size={14} /> Удалить
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Payments details */}
          <div className="bg-slate-800 rounded-xl border border-slate-700">
            <div className="p-4 border-b border-slate-700">
              <h2 className="font-semibold">
                {selectedRegister ? `Выплаты по реестру №${selectedRegister.register_number}` : "Выберите ведомость"}
              </h2>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {!selectedRegister ? (
                <div className="p-4 text-center text-slate-400">← Выберите ведомость слева</div>
              ) : payments.length === 0 ? (
                <div className="p-4 text-center text-slate-400">Загрузка...</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-700/50 sticky top-0">
                    <tr>
                      <th className="text-left p-3">ФИО</th>
                      <th className="text-right p-3">Сумма</th>
                      <th className="text-center p-3">Связь</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map(p => (
                      <tr key={p.id} className="border-b border-slate-700 hover:bg-slate-700/30">
                        <td className="p-3">
                          <div>{p.full_name}</div>
                          <div className="text-slate-500 text-xs">{p.bank_account}</div>
                        </td>
                        <td className="p-3 text-right text-green-400 font-medium">
                          {Number(p.amount).toLocaleString("ru-RU")} ₽
                        </td>
                        <td className="p-3 text-center">
                          {p.driver_id ? (
                            <span className="text-green-400">✓</span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
