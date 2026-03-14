"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Truck, Clock, Package, ChevronRight, AlertTriangle, FileText, DollarSign, History, Plus, Trash2, Check, X, Upload, Download, Save, Loader2 } from "lucide-react";
import Link from "next/link";

const STATUS_COLORS: Record<string,string> = {
  PLANNING:"bg-slate-600",SEARCHING:"bg-purple-600",FOUND:"bg-indigo-600",APPROVED:"bg-blue-600",DOCS:"bg-cyan-600",ASSIGNED:"bg-teal-600",
  EN_ROUTE_PICKUP:"bg-amber-600",LOADING:"bg-orange-600",EN_ROUTE_DELIVERY:"bg-green-600",UNLOADING:"bg-lime-600",
  COMPLETED:"bg-emerald-700",CLOSED:"bg-slate-700",CANCELLED:"bg-red-700",
};
const STATUS_LABELS: Record<string,string> = {
  PLANNING:"📋 Планирование",SEARCHING:"🔍 Поиск",FOUND:"✅ Найден",APPROVED:"👍 Утверждён",DOCS:"📄 Документы",
  ASSIGNED:"🚛 Назначен",EN_ROUTE_PICKUP:"🛣 На погрузку",LOADING:"📦 Погрузка",EN_ROUTE_DELIVERY:"🛣 В пути",
  UNLOADING:"📤 Выгрузка",COMPLETED:"✔️ Выполнен",CLOSED:"🔒 Закрыт",CANCELLED:"❌ Отменён",
};

const DOC_TYPE_LABELS: Record<string,string> = {
  contract:"📃 Договор", waybill:"🧾 Накладная", invoice:"📄 Счёт", act:"📋 Акт",
  tn:"🚛 ТН", ttн:"🚛 ТТН", cmr:"🌍 CMR", photo:"📸 Фото", other:"📎 Другое",
};

const PAYMENT_STATUS_LABELS: Record<string,string> = {
  pending:"⏳ Ожидает", invoiced:"📄 Выставлен", partially_paid:"💰 Частично", paid:"✅ Оплачен", overdue:"🔴 Просрочен",
};

const fmt = (n:number)=>n?new Intl.NumberFormat("ru-RU").format(n):"—";
const fmtDT = (iso:string)=>iso?new Date(iso).toLocaleString("ru-RU",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",timeZone:"Europe/Moscow"}):"—";
const fmtSize = (b:number)=>b>1048576?(b/1048576).toFixed(1)+"МБ":(b/1024).toFixed(0)+"КБ";

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("main");
  const [statusComment, setStatusComment] = useState("");
  
  // Documents state
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadDocType, setUploadDocType] = useState("other");
  const [uploadDesc, setUploadDesc] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Finance state
  const [finance, setFinance] = useState<any>(null);
  const [financeForm, setFinanceForm] = useState<any>({});
  const [savingFinance, setSavingFinance] = useState(false);

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/logistics/orders/${id}`);
      const data = await res.json();
      if (data.error) { alert(data.error); return; }
      setOrder(data);
      setDocuments(data.documents || []);
      if (data.finance) { setFinance(data.finance); setFinanceForm(data.finance); }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [id]);

  useEffect(() => { if (id) fetchOrder(); }, [id, fetchOrder]);

  const changeStatus = async (newStatus: string) => {
    const role = localStorage.getItem("user") ? JSON.parse(localStorage.getItem("user")!).role : "director";
    try {
      const res = await fetch(`/api/logistics/orders/${id}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, role, comment: statusComment || undefined }),
      });
      const data = await res.json();
      if (data.error) { alert(data.error); return; }
      setStatusComment("");
      fetchOrder();
    } catch (e: any) { alert(e.message); }
  };

  // Document handlers
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("doc_type", uploadDocType);
    formData.append("description", uploadDesc);
    try {
      const res = await fetch(`/api/logistics/docs/orders/${id}/documents`, {
        method: "POST", body: formData,
      });
      const data = await res.json();
      if (data.success) { setDocuments(prev => [data.document, ...prev]); setUploadDesc(""); }
      else alert("Ошибка: " + data.error);
    } catch (err) { alert("Ошибка загрузки"); }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDownload = async (docId: number) => {
    try {
      const res = await fetch(`/api/logistics/docs/documents/${docId}/download`);
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await res.json();
        if (data.url) window.open(data.url, "_blank");
      } else {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
      }
    } catch (err) { alert("Ошибка скачивания"); }
  };

  const handleDeleteDoc = async (docId: number) => {
    if (!confirm("Удалить документ?")) return;
    try {
      await fetch(`/api/logistics/docs/documents/${docId}`, { method: "DELETE" });
      setDocuments(prev => prev.filter(d => d.id !== docId));
    } catch (err) { alert("Ошибка удаления"); }
  };

  // Finance handlers
  const updateFinanceField = (field: string, value: any) => {
    setFinanceForm((prev: any) => ({ ...prev, [field]: value }));
  };

  const saveFinance = async () => {
    setSavingFinance(true);
    try {
      const res = await fetch(`/api/logistics/docs/orders/${id}/finance`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(financeForm),
      });
      const data = await res.json();
      if (data.success) { setFinance(data.finance); setFinanceForm(data.finance); }
      else alert("Ошибка: " + data.error);
    } catch (err) { alert("Ошибка сохранения"); }
    setSavingFinance(false);
  };

  if (loading) return <div className="p-6 text-center text-slate-500">Загрузка...</div>;
  if (!order) return <div className="p-6 text-center text-red-400">Заявка не найдена</div>;

  const tabs = [
    { key: "main", label: "Основное", icon: Package },
    { key: "waypoints", label: `Маршрут (${order.waypoints?.length || 0})`, icon: MapPin },
    { key: "documents", label: `Документы (${documents.length})`, icon: FileText },
    { key: "finance", label: "Финансы", icon: DollarSign },
    { key: "proposals", label: `Предложения (${order.proposals?.length || 0})`, icon: FileText },
    { key: "history", label: "История", icon: History },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <Link href="/logistics/orders" className="p-2 rounded bg-slate-700 hover:bg-slate-600 mt-1"><ArrowLeft className="w-4 h-4" /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-lg font-bold text-white">{order.order_number}</span>
            <span className={`px-2 py-0.5 rounded text-xs font-bold text-white ${STATUS_COLORS[order.status]}`}>{STATUS_LABELS[order.status]}</span>
            {order.has_problem && <span className="text-red-400 flex items-center gap-1 text-xs"><AlertTriangle className="w-3 h-3" /> Проблема</span>}
            {order.source !== "manual" && <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${order.source==="wb"?"bg-purple-600/30 text-purple-300":"bg-blue-600/30 text-blue-300"}`}>{order.source.toUpperCase()}</span>}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400 mt-1">
            <MapPin className="w-3 h-3 text-green-400" />{order.origin_city || "?"}
            <ChevronRight className="w-3 h-3" />{order.destination_city || "?"}
            {order.vehicle_number && <><Truck className="w-3 h-3 ml-2" />{order.vehicle_number.toUpperCase()}</>}
            {order.rate_amount > 0 && <span className="text-green-400 ml-2">{fmt(order.rate_amount)} ₽</span>}
          </div>
        </div>
      </div>

      {/* Status transitions */}
      {order.allowedTransitions?.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-3 mb-4 border border-slate-700/50">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400">Перевести в:</span>
            {order.allowedTransitions.map((s: string) => (
              <button key={s} onClick={() => changeStatus(s)}
                className={`px-3 py-1 rounded text-xs font-medium transition ${s === "CANCELLED" ? "bg-red-600/20 text-red-400 hover:bg-red-600/40" : "bg-blue-600/20 text-blue-400 hover:bg-blue-600/40"}`}>
                {STATUS_LABELS[s] || s}
              </button>
            ))}
            <input placeholder="Комментарий..." value={statusComment} onChange={e => setStatusComment(e.target.value)}
              className="flex-1 min-w-[150px] bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white" />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-slate-700 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-3 py-2 text-sm flex items-center gap-1 whitespace-nowrap border-b-2 transition ${activeTab === t.key ? "border-blue-500 text-white" : "border-transparent text-slate-400 hover:text-white"}`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Main */}
      {activeTab === "main" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700/50">
            <h3 className="text-sm font-medium text-slate-400 mb-2">Маршрут</h3>
            <div className="space-y-1 text-sm">
              <div><span className="text-slate-500">Откуда:</span> <span className="text-white">{order.origin_city} {order.origin_address && `— ${order.origin_address}`}</span></div>
              <div><span className="text-slate-500">Куда:</span> <span className="text-white">{order.destination_city} {order.destination_address && `— ${order.destination_address}`}</span></div>
              {order.planned_distance_km > 0 && <div><span className="text-slate-500">Расстояние:</span> <span className="text-white">{fmt(order.planned_distance_km)} км</span></div>}
              <div><span className="text-slate-500">Погрузка:</span> <span className="text-white">{fmtDT(order.planned_pickup_date)}</span></div>
              <div><span className="text-slate-500">Выгрузка:</span> <span className="text-white">{fmtDT(order.planned_delivery_date)}</span></div>
            </div>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700/50">
            <h3 className="text-sm font-medium text-slate-400 mb-2">Груз</h3>
            <div className="space-y-1 text-sm">
              <div><span className="text-slate-500">Тип:</span> <span className="text-white">{order.cargo_type || "—"}</span></div>
              {order.cargo_weight_tons > 0 && <div><span className="text-slate-500">Вес:</span> <span className="text-white">{order.cargo_weight_tons} т</span></div>}
              {order.cargo_volume_m3 > 0 && <div><span className="text-slate-500">Объём:</span> <span className="text-white">{order.cargo_volume_m3} м³</span></div>}
              {order.cargo_description && <div><span className="text-slate-500">Описание:</span> <span className="text-white">{order.cargo_description}</span></div>}
            </div>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700/50">
            <h3 className="text-sm font-medium text-slate-400 mb-2">Заказчик</h3>
            <div className="space-y-1 text-sm">
              <div><span className="text-slate-500">Название:</span> <span className="text-white">{order.customer_name || "—"}</span></div>
              {order.customer_inn && <div><span className="text-slate-500">ИНН:</span> <span className="text-white">{order.customer_inn}</span></div>}
              {order.customer_contact_phone && <div><span className="text-slate-500">Телефон:</span> <span className="text-white">{order.customer_contact_phone}</span></div>}
            </div>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700/50">
            <h3 className="text-sm font-medium text-slate-400 mb-2">Финансы (сводка)</h3>
            <div className="space-y-1 text-sm">
              <div><span className="text-slate-500">Ставка:</span> <span className="text-green-400 font-bold">{order.rate_amount > 0 ? `${fmt(order.rate_amount)} ₽` : "—"}</span></div>
              {order.rate_per_km > 0 && <div><span className="text-slate-500">₽/км:</span> <span className="text-white">{order.rate_per_km}</span></div>}
              {finance && <div><span className="text-slate-500">Прибыль:</span> <span className={`font-bold ${Number(finance.profit)>=0?"text-green-400":"text-red-400"}`}>{fmt(Number(finance.profit))} ₽</span></div>}
            </div>
          </div>
          {order.notes && (
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700/50 md:col-span-2">
              <h3 className="text-sm font-medium text-slate-400 mb-1">Примечания</h3>
              <p className="text-sm text-white whitespace-pre-wrap">{order.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Documents */}
      {activeTab === "documents" && (
        <div className="space-y-4">
          {/* Upload form */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700/50">
            <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2"><Upload className="w-4 h-4" /> Загрузить документ</h3>
            <div className="flex flex-col sm:flex-row gap-2">
              <select value={uploadDocType} onChange={e => setUploadDocType(e.target.value)}
                className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white">
                {Object.entries(DOC_TYPE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input placeholder="Описание..." value={uploadDesc} onChange={e => setUploadDesc(e.target.value)}
                className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white" />
              <label className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 cursor-pointer ${uploading ? "bg-slate-600 text-slate-400" : "bg-blue-600 hover:bg-blue-700 text-white"}`}>
                {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Загрузка...</> : <><Plus className="w-4 h-4" /> Выбрать файл</>}
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} disabled={uploading}
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" />
              </label>
            </div>
            <p className="text-xs text-slate-500 mt-2">PDF, JPG, PNG, DOC, XLS — до 20МБ</p>
          </div>

          {/* Documents list */}
          {documents.length === 0 ? (
            <div className="text-center py-8 text-slate-500">Нет документов</div>
          ) : (
            <div className="space-y-2">
              {documents.map(doc => (
                <div key={doc.id} className="bg-slate-800 rounded-lg p-3 border border-slate-700/50 flex items-center gap-3">
                  <div className="text-2xl">{DOC_TYPE_LABELS[doc.doc_type]?.slice(0,2) || "📎"}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{doc.file_name}</div>
                    <div className="text-xs text-slate-400">
                      {DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}
                      {doc.description && ` — ${doc.description}`}
                      {" • "}{fmtSize(doc.file_size)}
                      {" • "}{fmtDT(doc.uploaded_at)}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => handleDownload(doc.id)} className="p-2 rounded bg-slate-700 hover:bg-slate-600 text-blue-400" title="Скачать">
                      <Download className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteDoc(doc.id)} className="p-2 rounded bg-slate-700 hover:bg-red-600/30 text-red-400" title="Удалить">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Finance */}
      {activeTab === "finance" && (
        <div className="space-y-4">
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700/50">
            <h3 className="text-sm font-medium text-green-400 mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4" /> Доходы и расходы</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-500">Ставка заказчика (₽)</label>
                <input type="number" value={financeForm.revenue_amount||""} onChange={e => updateFinanceField("revenue_amount", e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white mt-1" />
              </div>
              <div>
                <label className="text-xs text-slate-500">С НДС</label>
                <select value={financeForm.revenue_with_vat===false?"false":"true"} onChange={e => updateFinanceField("revenue_with_vat", e.target.value==="true")}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white mt-1">
                  <option value="true">Да</option>
                  <option value="false">Нет</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Топливо (₽)</label>
                <input type="number" value={financeForm.fuel_cost||""} onChange={e => updateFinanceField("fuel_cost", e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white mt-1" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Платон / Toll (₽)</label>
                <input type="number" value={financeForm.toll_cost||""} onChange={e => updateFinanceField("toll_cost", e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white mt-1" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Оплата водителю (₽)</label>
                <input type="number" value={financeForm.driver_payment||""} onChange={e => updateFinanceField("driver_payment", e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white mt-1" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Прочие расходы (₽)</label>
                <input type="number" value={financeForm.other_costs||""} onChange={e => updateFinanceField("other_costs", e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white mt-1" />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="text-xs text-slate-500">Описание прочих</label>
                <input value={financeForm.other_costs_description||""} onChange={e => updateFinanceField("other_costs_description", e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white mt-1" />
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700/50">
            <h3 className="text-sm font-medium text-blue-400 mb-3">Оплата от заказчика</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-500">Статус оплаты</label>
                <select value={financeForm.payment_status||"pending"} onChange={e => updateFinanceField("payment_status", e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white mt-1">
                  {Object.entries(PAYMENT_STATUS_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Номер счёта</label>
                <input value={financeForm.invoice_number||""} onChange={e => updateFinanceField("invoice_number", e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white mt-1" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Дата счёта</label>
                <input type="date" value={financeForm.invoice_date||""} onChange={e => updateFinanceField("invoice_date", e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white mt-1" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Сумма счёта</label>
                <input type="number" value={financeForm.invoice_amount||""} onChange={e => updateFinanceField("invoice_amount", e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white mt-1" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Срок оплаты</label>
                <input type="date" value={financeForm.payment_due_date||""} onChange={e => updateFinanceField("payment_due_date", e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white mt-1" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Дата получения</label>
                <input type="date" value={financeForm.payment_received_date||""} onChange={e => updateFinanceField("payment_received_date", e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white mt-1" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Получено (₽)</label>
                <input type="number" value={financeForm.payment_received_amount||""} onChange={e => updateFinanceField("payment_received_amount", e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white mt-1" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Договор 1С</label>
                <input value={financeForm.contract_1c_number||""} onChange={e => updateFinanceField("contract_1c_number", e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white mt-1" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Примечание</label>
                <input value={financeForm.notes||""} onChange={e => updateFinanceField("notes", e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white mt-1" />
              </div>
            </div>
          </div>

          {/* Summary */}
          {finance && (
            <div className="bg-gradient-to-r from-green-900/20 to-emerald-900/20 rounded-lg p-4 border border-green-500/30">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div><div className="text-xs text-slate-400">Доход</div><div className="text-lg font-bold text-green-400">{fmt(Number(finance.revenue_amount))} ₽</div></div>
                <div><div className="text-xs text-slate-400">Расходы</div><div className="text-lg font-bold text-red-400">{fmt(Number(finance.fuel_cost||0)+Number(finance.toll_cost||0)+Number(finance.driver_payment||0)+Number(finance.other_costs||0))} ₽</div></div>
                <div><div className="text-xs text-slate-400">Прибыль</div><div className={`text-lg font-bold ${Number(finance.profit)>=0?"text-green-400":"text-red-400"}`}>{fmt(Number(finance.profit))} ₽</div></div>
                <div><div className="text-xs text-slate-400">Маржа</div><div className="text-lg font-bold text-blue-400">{finance.margin_percent||0}%</div></div>
              </div>
            </div>
          )}

          <button onClick={saveFinance} disabled={savingFinance}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white py-3 rounded-lg flex items-center justify-center gap-2 text-sm font-medium">
            {savingFinance ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Сохранить финансы
          </button>
        </div>
      )}

      {/* Tab: Waypoints */}
      {activeTab === "waypoints" && (
        <div className="space-y-2">
          {(order.waypoints || []).map((wp: any, i: number) => (
            <div key={wp.id} className="bg-slate-800 rounded-lg p-3 border-l-4 flex items-start gap-3"
              style={{ borderLeftColor: wp.point_type === "pickup" ? "#22c55e" : wp.point_type === "delivery" ? "#ef4444" : "#3b82f6" }}>
              <div className="text-2xl">{wp.point_type === "pickup" ? "📦" : wp.point_type === "delivery" ? "📤" : "📍"}</div>
              <div className="flex-1">
                <div className="font-medium text-white">{wp.city} {wp.address && `— ${wp.address}`}</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {wp.planned_arrival && <span>План: {fmtDT(wp.planned_arrival)}</span>}
                  {wp.actual_arrival && <span className="ml-2 text-green-400">Факт: {fmtDT(wp.actual_arrival)}</span>}
                </div>
                {wp.contact_name && <div className="text-xs text-slate-400 mt-0.5">👤 {wp.contact_name} {wp.contact_phone}</div>}
              </div>
              <span className="text-xs text-slate-500">#{wp.sequence_number}</span>
            </div>
          ))}
          {(order.waypoints || []).length === 0 && <div className="text-center py-6 text-slate-500">Нет точек маршрута</div>}
        </div>
      )}

      {/* Tab: Proposals */}
      {activeTab === "proposals" && (
        <div className="space-y-3">
          {(order.proposals || []).map((p: any) => (
            <div key={p.id} className={`bg-slate-800 rounded-lg p-4 border ${p.status === "approved" ? "border-green-500/50" : p.status === "rejected" ? "border-red-500/30" : "border-slate-700/50"}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{p.origin_city} → {p.destination_city}</span>
                    {p.distance_km > 0 && <span className="text-xs text-slate-400">{fmt(p.distance_km)} км</span>}
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${p.status === "approved" ? "bg-green-600/30 text-green-400" : p.status === "rejected" ? "bg-red-600/30 text-red-400" : "bg-amber-600/30 text-amber-400"}`}>
                      {p.status === "approved" ? "✅ Утверждено" : p.status === "rejected" ? "❌ Отклонено" : "⏳ На рассмотрении"}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {p.customer_name && <span>{p.customer_name}</span>}
                    {p.customer_rating > 0 && <span className="ml-1">⭐ {p.customer_rating}</span>}
                    {p.cargo_description && <span className="ml-2">{p.cargo_description}</span>}
                  </div>
                </div>
                <div className="text-right">
                  {p.rate_amount > 0 && <div className="text-green-400 font-bold">{fmt(p.rate_amount)} ₽</div>}
                  {p.rate_per_km > 0 && <div className="text-xs text-slate-400">{p.rate_per_km} ₽/км</div>}
                </div>
              </div>
              {p.status === "pending" && (
                <div className="flex gap-2 mt-2">
                  <button onClick={async () => {
                    await fetch(`/api/logistics/proposals/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "approved", reviewed_by: 1 }) });
                    fetchOrder();
                  }} className="px-3 py-1 bg-green-600/20 text-green-400 hover:bg-green-600/40 rounded text-xs flex items-center gap-1"><Check className="w-3 h-3" /> Утвердить</button>
                  <button onClick={async () => {
                    await fetch(`/api/logistics/proposals/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "rejected", reviewed_by: 1, reject_reason: "Не подходит" }) });
                    fetchOrder();
                  }} className="px-3 py-1 bg-red-600/20 text-red-400 hover:bg-red-600/40 rounded text-xs flex items-center gap-1"><X className="w-3 h-3" /> Отклонить</button>
                </div>
              )}
            </div>
          ))}
          {(order.proposals || []).length === 0 && <div className="text-center py-6 text-slate-500">Нет предложений</div>}
        </div>
      )}

      {/* Tab: History */}
      {activeTab === "history" && (
        <div className="space-y-1">
          {(order.statusLog || []).map((log: any) => (
            <div key={log.id} className="flex items-center gap-3 py-2 border-b border-slate-700/50 text-sm">
              <span className="text-xs text-slate-500 w-[100px] shrink-0">{fmtDT(log.created_at)}</span>
              <div className="flex items-center gap-1">
                {log.from_status && <span className={`px-1.5 py-0.5 rounded text-[10px] ${STATUS_COLORS[log.from_status]} text-white`}>{log.from_status}</span>}
                {log.from_status && <ChevronRight className="w-3 h-3 text-slate-500" />}
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${STATUS_COLORS[log.to_status]} text-white`}>{log.to_status}</span>
              </div>
              <span className="text-slate-400 text-xs">{log.change_source}</span>
              {log.comment && <span className="text-slate-300 text-xs truncate">{log.comment}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
