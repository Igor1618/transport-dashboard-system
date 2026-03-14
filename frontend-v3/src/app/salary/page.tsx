"use client";
import { formatDate, formatDateTime, formatShortDate } from "@/lib/dates";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Upload, Trash2, FileText, Users, DollarSign, Calendar, Loader2, X, AlertTriangle, CheckCircle, XCircle, Filter, ChevronDown } from "lucide-react";

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

interface Deduction {
  id: number;
  driver_id: number;
  driver_name: string;
  organization: string;
  doc_number: string;
  doc_date: string;
  doc_end_date: string | null;
  recipient: string;
  amount: number;
  status: string;
}

interface PayrollEntry {
  driver_id: number;
  driver_name: string;
  organization: string;
  accrued: number;
  total_deductions: number;
  net_pay: number;
  deductions: {
    doc_number: string;
    amount: number;
    recipient: string;
  }[];
}

interface ImportResult {
  imported: number;
  updated: number;
  unmatched_drivers: string[];
}

type TabType = 'registers' | 'deductions' | 'payroll';

const ORGANIZATIONS = [
  "Все",
  "ГРУЗОВЫЕ ПЕРЕВОЗКИ ООО",
  "ТРАНСПОРТНАЯ ЛОГИСТИКА ООО",
  "ИП Лихачев С.Л."
];

function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function SalaryPage() {
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('registers');

  // === Registers tab state ===
  const [registers, setRegisters] = useState<Register[]>([]);
  const [selectedRegister, setSelectedRegister] = useState<Register | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // === Deductions tab state ===
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [deductionsLoading, setDeductionsLoading] = useState(false);
  const [deductionsPeriod, setDeductionsPeriod] = useState(getCurrentPeriod());
  const [deductionsOrg, setDeductionsOrg] = useState("Все");
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFiles, setImportFiles] = useState<File[]>([]);
  const [importUploading, setImportUploading] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [importError, setImportError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  // === Payroll tab state ===
  const [payroll, setPayroll] = useState<PayrollEntry[]>([]);
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [payrollPeriod, setPayrollPeriod] = useState(getCurrentPeriod());
  const [expandedPayrollRow, setExpandedPayrollRow] = useState<number | null>(null);

  // === Registers logic ===
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

  // === Deductions logic ===
  const loadDeductions = useCallback(async () => {
    setDeductionsLoading(true);
    try {
      const params = new URLSearchParams({ period: deductionsPeriod });
      if (deductionsOrg !== "Все") params.append("organization", deductionsOrg);
      const res = await fetch(`/api/salary/deductions?${params}`);
      const data = await res.json();
      setDeductions(Array.isArray(data) ? data : data.deductions || []);
    } catch (e) { console.error(e); }
    setDeductionsLoading(false);
  }, [deductionsPeriod, deductionsOrg]);

  useEffect(() => {
    if (activeTab === 'deductions') loadDeductions();
  }, [activeTab, loadDeductions]);

  const handleDeleteDeduction = async (id: number) => {
    if (!confirm("Удалить удержание?")) return;
    try {
      await fetch(`/api/salary/deductions/${id}`, { method: "DELETE" });
      loadDeductions();
    } catch (e) { console.error(e); }
  };

  const handleImportFiles = async () => {
    if (importFiles.length === 0) return;
    setImportUploading(true);
    setImportError("");
    setImportResults([]);

    const results: ImportResult[] = [];
    for (const file of importFiles) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch("/api/salary/deductions/import", { method: "POST", body: formData });
        const data = await res.json();
        if (data.error) {
          setImportError(prev => prev ? `${prev}\n${file.name}: ${data.error}` : `${file.name}: ${data.error}`);
        } else {
          results.push(data);
        }
      } catch (e) {
        setImportError(prev => prev ? `${prev}\n${file.name}: Ошибка загрузки` : `${file.name}: Ошибка загрузки`);
      }
    }
    setImportResults(results);
    setImportUploading(false);
    if (results.length > 0) loadDeductions();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) setImportFiles(prev => [...prev, ...files]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const isExpired = (dateStr: string | null) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  };

  // === Payroll logic ===
  const loadPayroll = useCallback(async () => {
    setPayrollLoading(true);
    try {
      const res = await fetch(`/api/salary/payroll?period=${payrollPeriod}`);
      const data = await res.json();
      setPayroll(Array.isArray(data) ? data : data.entries || data.payroll || []);
    } catch (e) { console.error(e); }
    setPayrollLoading(false);
  }, [payrollPeriod]);

  useEffect(() => {
    if (activeTab === 'payroll') loadPayroll();
  }, [activeTab, loadPayroll]);

  const payrollTotals = payroll.reduce(
    (acc, p) => ({
      accrued: acc.accrued + Number(p.accrued || 0),
      deductions: acc.deductions + Number(p.total_deductions || 0),
      net: acc.net + Number(p.net_pay || (Number(p.accrued || 0) - Number(p.total_deductions || 0))),
    }),
    { accrued: 0, deductions: 0, net: 0 }
  );

  // === Tabs config ===
  const tabs: { key: TabType; label: string; icon: React.ReactNode }[] = [
    { key: 'registers', label: 'Ведомости', icon: <FileText size={16} /> },
    { key: 'deductions', label: 'Исполнительные листы', icon: <AlertTriangle size={16} /> },
    { key: 'payroll', label: 'Сводка выплат', icon: <DollarSign size={16} /> },
  ];

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

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-slate-700">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors relative ${
                activeTab === tab.key
                  ? 'text-cyan-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.icon}
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-t" />
              )}
            </button>
          ))}
        </div>

        {/* ===================== TAB: REGISTERS ===================== */}
        {activeTab === 'registers' && (
          <>
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
          </>
        )}

        {/* ===================== TAB: DEDUCTIONS ===================== */}
        {activeTab === 'deductions' && (
          <>
            {/* Controls */}
            <div className="bg-slate-800 rounded-xl p-4 mb-6 border border-slate-700 flex flex-wrap items-center gap-4">
              <button
                onClick={() => { setShowImportModal(true); setImportFiles([]); setImportResults([]); setImportError(""); }}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 rounded-lg transition font-medium"
              >
                <Upload size={18} />
                Загрузить удержания (1С)
              </button>

              <div className="flex items-center gap-2">
                <Filter size={16} className="text-slate-400" />
                <select
                  value={deductionsOrg}
                  onChange={(e) => setDeductionsOrg(e.target.value)}
                  className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  {ORGANIZATIONS.map(org => (
                    <option key={org} value={org}>{org}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-slate-400" />
                <input
                  type="month"
                  value={deductionsPeriod}
                  onChange={(e) => setDeductionsPeriod(e.target.value)}
                  className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            {/* Deductions table */}
            <div className="bg-slate-800 rounded-xl border border-slate-700">
              <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                <h2 className="font-semibold flex items-center gap-2">
                  <AlertTriangle size={18} className="text-yellow-400" />
                  Исполнительные листы
                </h2>
                <span className="text-slate-400 text-sm">{deductions.length} записей</span>
              </div>
              <div className="overflow-x-auto">
                {deductionsLoading ? (
                  <div className="p-8 text-center text-slate-400 flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin" size={20} />
                    Загрузка...
                  </div>
                ) : deductions.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">Нет удержаний за выбранный период</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-700/50 sticky top-0">
                      <tr>
                        <th className="text-left p-3">ФИО</th>
                        <th className="text-left p-3">Орг-ция</th>
                        <th className="text-left p-3">Номер ИЛ</th>
                        <th className="text-left p-3">Дата</th>
                        <th className="text-left p-3">До</th>
                        <th className="text-left p-3">Получатель</th>
                        <th className="text-right p-3">Сумма</th>
                        <th className="text-center p-3">Статус</th>
                        <th className="text-center p-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {deductions.map(d => {
                        const expired = isExpired(d.doc_end_date);
                        return (
                          <tr
                            key={d.id}
                            className={`border-b border-slate-700 hover:bg-slate-700/30 ${expired ? 'opacity-50' : ''}`}
                          >
                            <td className="p-3 font-medium">{d.driver_name}</td>
                            <td className="p-3 text-slate-300 text-xs">{d.organization}</td>
                            <td className="p-3">{d.doc_number}</td>
                            <td className="p-3 text-slate-300">{d.doc_date ? formatDate(d.doc_date) : '—'}</td>
                            <td className="p-3 text-slate-300">{d.doc_end_date ? formatDate(d.doc_end_date) : '—'}</td>
                            <td className="p-3 text-slate-300 text-xs max-w-[200px] truncate">{d.recipient || '—'}</td>
                            <td className="p-3 text-right font-medium text-yellow-400">
                              {Number(d.amount).toLocaleString("ru-RU")} ₽
                            </td>
                            <td className="p-3 text-center">
                              {d.status === 'active' ? (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                                  активен
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                                  отменён
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => handleDeleteDeduction(d.id)}
                                className="text-red-400 hover:text-red-300 transition p-1 rounded hover:bg-red-500/10"
                                title="Удалить"
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Import Modal */}
            {showImportModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-lg mx-4 shadow-2xl">
                  <div className="flex items-center justify-between p-5 border-b border-slate-700">
                    <h3 className="text-lg font-semibold">Загрузка удержаний (1С)</h3>
                    <button onClick={() => setShowImportModal(false)} className="p-1 hover:bg-slate-700 rounded-lg transition">
                      <X size={20} />
                    </button>
                  </div>
                  <div className="p-5">
                    {/* Drop zone */}
                    <div
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onClick={() => importFileRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
                        dragOver
                          ? 'border-cyan-400 bg-cyan-500/10'
                          : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/30'
                      }`}
                    >
                      <Upload size={32} className="mx-auto mb-3 text-slate-400" />
                      <div className="text-slate-300 mb-1">Перетащите файлы сюда</div>
                      <div className="text-slate-500 text-sm">или нажмите для выбора</div>
                      <input
                        ref={importFileRef}
                        type="file"
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          if (files.length > 0) setImportFiles(prev => [...prev, ...files]);
                          if (importFileRef.current) importFileRef.current.value = "";
                        }}
                        className="hidden"
                      />
                    </div>

                    {/* File list */}
                    {importFiles.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {importFiles.map((f, i) => (
                          <div key={i} className="flex items-center justify-between bg-slate-700/50 rounded-lg px-3 py-2">
                            <span className="text-sm truncate flex items-center gap-2">
                              <FileText size={14} className="text-slate-400" />
                              {f.name}
                            </span>
                            <button
                              onClick={() => setImportFiles(prev => prev.filter((_, idx) => idx !== i))}
                              className="text-slate-400 hover:text-red-400 ml-2"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Import results */}
                    {importResults.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {importResults.map((r, i) => (
                          <div key={i} className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-sm">
                            <div className="flex items-center gap-2 text-green-400 font-medium mb-1">
                              <CheckCircle size={14} />
                              Файл загружен
                            </div>
                            <div className="text-slate-300">
                              Импортировано: <span className="text-green-400 font-medium">{r.imported}</span>,
                              обновлено: <span className="text-cyan-400 font-medium">{r.updated}</span>
                              {r.unmatched_drivers && r.unmatched_drivers.length > 0 && (
                                <div className="mt-1 text-yellow-400">
                                  ⚠ Не найдены водители: {r.unmatched_drivers.join(", ")}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {importError && (
                      <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400 whitespace-pre-wrap">
                        {importError}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-700">
                    <button
                      onClick={() => setShowImportModal(false)}
                      className="px-4 py-2 text-sm text-slate-400 hover:text-white transition"
                    >
                      Закрыть
                    </button>
                    <button
                      onClick={handleImportFiles}
                      disabled={importFiles.length === 0 || importUploading}
                      className={`flex items-center gap-2 px-5 py-2 rounded-lg font-medium text-sm transition ${
                        importFiles.length === 0 || importUploading
                          ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                          : 'bg-green-600 hover:bg-green-700 text-white'
                      }`}
                    >
                      {importUploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                      {importUploading ? 'Загрузка...' : `Загрузить (${importFiles.length})`}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ===================== TAB: PAYROLL ===================== */}
        {activeTab === 'payroll' && (
          <>
            {/* Controls */}
            <div className="bg-slate-800 rounded-xl p-4 mb-6 border border-slate-700 flex items-center gap-4">
              <Calendar size={16} className="text-slate-400" />
              <input
                type="month"
                value={payrollPeriod}
                onChange={(e) => setPayrollPeriod(e.target.value)}
                className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <div className="text-slate-400 text-sm flex items-center gap-2"><DollarSign size={16} /> Всего начислено</div>
                <div className="text-3xl font-bold text-cyan-400">
                  {payrollTotals.accrued.toLocaleString("ru-RU")} ₽
                </div>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <div className="text-slate-400 text-sm flex items-center gap-2"><AlertTriangle size={16} /> Всего удержаний</div>
                <div className="text-3xl font-bold text-red-400">
                  {payrollTotals.deductions.toLocaleString("ru-RU")} ₽
                </div>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <div className="text-slate-400 text-sm flex items-center gap-2"><CheckCircle size={16} /> К выплате</div>
                <div className="text-3xl font-bold text-green-400">
                  {payrollTotals.net.toLocaleString("ru-RU")} ₽
                </div>
              </div>
            </div>

            {/* Payroll table */}
            <div className="bg-slate-800 rounded-xl border border-slate-700">
              <div className="p-4 border-b border-slate-700">
                <h2 className="font-semibold flex items-center gap-2">
                  <DollarSign size={18} className="text-green-400" />
                  Сводка выплат за {payrollPeriod}
                </h2>
              </div>
              <div className="overflow-x-auto">
                {payrollLoading ? (
                  <div className="p-8 text-center text-slate-400 flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin" size={20} />
                    Загрузка...
                  </div>
                ) : payroll.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">Нет данных за выбранный период</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-700/50 sticky top-0">
                      <tr>
                        <th className="text-left p-3">Водитель</th>
                        <th className="text-left p-3">Организация</th>
                        <th className="text-right p-3">Начислено</th>
                        <th className="text-right p-3">Удержания ИЛ</th>
                        <th className="text-right p-3">К выплате</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payroll.map((p) => {
                        const netPay = Number(p.net_pay || (Number(p.accrued || 0) - Number(p.total_deductions || 0)));
                        const deductionRatio = Number(p.accrued) > 0 ? Number(p.total_deductions) / Number(p.accrued) : 0;
                        const isHighDeduction = deductionRatio > 0.5;
                        const hasDeductions = Number(p.total_deductions) > 0;
                        const isExpanded = expandedPayrollRow === p.driver_id;

                        return (
                          <tr
                            key={p.driver_id}
                            className={`border-b border-slate-700 hover:bg-slate-700/30 ${isHighDeduction ? 'bg-red-500/5' : ''}`}
                          >
                            <td className="p-3 font-medium">{p.driver_name}</td>
                            <td className="p-3 text-slate-300 text-xs">{p.organization}</td>
                            <td className="p-3 text-right text-cyan-400 font-medium">
                              {Number(p.accrued).toLocaleString("ru-RU")} ₽
                            </td>
                            <td className="p-3 text-right relative">
                              {hasDeductions ? (
                                <span>
                                  <button
                                    onClick={() => setExpandedPayrollRow(isExpanded ? null : p.driver_id)}
                                    className={`font-medium transition inline-flex items-center gap-1 ${
                                      isHighDeduction ? 'text-red-400' : 'text-yellow-400'
                                    } hover:underline cursor-pointer`}
                                  >
                                    {Number(p.total_deductions).toLocaleString("ru-RU")} ₽
                                    <ChevronDown size={12} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                  </button>
                                  {isExpanded && p.deductions && p.deductions.length > 0 && (
                                    <div className="absolute right-0 top-full mt-1 z-30 bg-slate-700 border border-slate-600 rounded-lg shadow-xl p-3 min-w-[280px] text-left">
                                      <div className="text-xs text-slate-400 mb-2">Детали удержаний:</div>
                                      {p.deductions.map((dd, i) => (
                                        <div key={i} className="flex justify-between text-xs py-1 border-b border-slate-600 last:border-0">
                                          <div>
                                            <span className="text-slate-300">{dd.doc_number}</span>
                                            <div className="text-slate-500 text-[10px]">{dd.recipient}</div>
                                          </div>
                                          <span className="text-yellow-400 font-medium ml-3 whitespace-nowrap">
                                            {Number(dd.amount).toLocaleString("ru-RU")} ₽
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </span>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </td>
                            <td className={`p-3 text-right font-medium ${isHighDeduction ? 'text-red-400' : 'text-green-400'}`}>
                              {netPay.toLocaleString("ru-RU")} ₽
                            </td>
                          </tr>
                        );
                      })}
                      {/* ИТОГО row */}
                      <tr className="bg-slate-700/50 font-bold">
                        <td className="p-3" colSpan={2}>ИТОГО</td>
                        <td className="p-3 text-right text-cyan-400">
                          {payrollTotals.accrued.toLocaleString("ru-RU")} ₽
                        </td>
                        <td className="p-3 text-right text-yellow-400">
                          {payrollTotals.deductions.toLocaleString("ru-RU")} ₽
                        </td>
                        <td className="p-3 text-right text-green-400">
                          {payrollTotals.net.toLocaleString("ru-RU")} ₽
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
