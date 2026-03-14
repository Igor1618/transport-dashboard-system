'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';

const n = (v: any) => Number(v) || 0;
const fmtNum = (v: number) => v.toLocaleString('ru-RU');
const fmtRate = (v: number) => v ? `${v} ₽/км` : '—';
const fmtMoney = (v: number) => v ? `${fmtNum(Math.round(v))} ₽` : '—';

function timeLeft(endTime: string) {
  const diff = new Date(endTime).getTime() - Date.now();
  if (diff <= 0) return { text: 'Завершён', urgent: false, expired: true };
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return { text: `${d}д ${h}ч`, urgent: false, expired: false };
  if (h > 0) return { text: `${h}ч ${m}м`, urgent: h < 2, expired: false };
  return { text: `${m}м`, urgent: true, expired: false };
}

function statusBadge(status: string | null) {
  if (!status) return { icon: '⚪', text: 'Не участвуем', color: 'text-gray-400' };
  if (status === 'BET_STATUS_LEADER') return { icon: '✅', text: 'Ставка принята', color: 'text-green-400' };
  if (status === 'BET_STATUS_REJECTED') return { icon: '❌', text: 'Отклонена', color: 'text-red-400' };
  return { icon: '🟡', text: 'Ожидание', color: 'text-yellow-400' };
}

function pcColor(count: number) {
  if (count <= 3) return 'text-green-400';
  if (count <= 7) return 'text-yellow-400';
  return 'text-red-400';
}

function cardBorder(m: any) {
  if (m.our_bet_status === 'BET_STATUS_LEADER') return 'border-green-500/60';
  if (m.our_bet_status === 'BET_STATUS_REJECTED') return 'border-red-500/60';
  const tl = timeLeft(m.end_time);
  if (tl.urgent && !tl.expired) return 'border-yellow-500/60';
  return 'border-gray-700/60';
}

interface MultilotTabProps {
  apiFetchJson: (url: string) => Promise<any>;
  tenders: any[];
}

export default function MultilotTab({ apiFetchJson, tenders }: MultilotTabProps) {
  const [subTab, setSubTab] = useState<'active' | 'finished' | 'analytics'>('active');
  const [multilots, setMultilots] = useState<any[]>([]);
  const [finished, setFinished] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [routeHistory, setRouteHistory] = useState<any[]>([]);
  const [tick, setTick] = useState(0);
  const [bidRate, setBidRate] = useState('');
  const [bidLoading, setBidLoading] = useState(false);
  const [bidResult, setBidResult] = useState<{type:'success'|'error',text:string}|null>(null);
  const [tonnageF, setTonnageF] = useState<string>('all');
  const [directionF, setDirectionF] = useState<string>('all');
  const [participatingF, setParticipatingF] = useState(false);
  const [searchFrom, setSearchFrom] = useState('');
  const [searchTo, setSearchTo] = useState('');
  const [distMin, setDistMin] = useState('');
  const [distMax, setDistMax] = useState('');
  const [rateMin, setRateMin] = useState('');
  const [rateMax, setRateMax] = useState('');
  const [sortBy, setSortBy] = useState<string>('time_left');
  const [mlSearch, setMlSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [fSearch, setFSearch] = useState('');
  const [fTonnage, setFTonnage] = useState('all');
  const [fResult, setFResult] = useState('all');

  useEffect(() => { const iv = setInterval(() => setTick(t => t + 1), 60000); return () => clearInterval(iv); }, []);

  const load = useCallback(async () => {
    try {
      const wbMultilots = tenders.filter((t: any) => t.is_multilot && t.status !== 'TENDER_STATUS_FINISHED' && t.status_label !== 'ЗАВЕРШЁН');
      const [sniperRes, fRes, aRes] = await Promise.all([
        apiFetchJson('/api/tenders/multilots').catch(() => ({ data: [] })),
        apiFetchJson('/api/tenders/multilots/finished').catch(() => ({ data: [] })),
        apiFetchJson('/api/tenders/multilots/analytics').catch(() => ({ data: null })),
      ]);
      const sniperData = sniperRes?.data || [];
      const sniperMap = new Map(sniperData.map((s: any) => [String(s.id), s]));
      const merged = wbMultilots.map((t: any) => {
        const s = sniperMap.get(String(t.id));
        return s ? { ...t, ...s, route_rate: s.route_rate || t.route_rate || t.current_rate } : t;
      });
      for (const s of sniperData) {
        if (!merged.find((m: any) => String(m.id) === String(s.id))) merged.push(s);
      }
      setMultilots(prev => {
        const changed = prev.length !== merged.length || merged.some((m: any, i: number) => {
          const p = prev[i];
          return !p || String(m.id) !== String(p.id) || n(m.route_rate) !== n(p.route_rate) || n(m.participants_count) !== n(p.participants_count) || m.our_bet_status !== p.our_bet_status;
        });
        return changed ? merged : prev;
      });
      setFinished(fRes?.data || []);
      setAnalytics(aRes?.data || null);
    } catch (e) { console.error('[MultilotTab]', e); }
    setLoading(false);
  }, [tenders, apiFetchJson]);

  useEffect(() => { load(); const iv = setInterval(load, 30000); return () => clearInterval(iv); }, [load]);

  useEffect(() => {
    if (!selected) { setRouteHistory([]); setBidRate(''); setBidResult(null); return; }
    const routeId = selected.route?.id || '';
    const s = selected.route?.start_point || selected.start_point || '';
    const e = selected.route?.end_point || selected.end_point || '';
    if (!routeId && !s) return;
    const params = routeId ? `route_id=${routeId}` : `start=${encodeURIComponent(s)}&end=${encodeURIComponent(e)}`;
    apiFetchJson(`/api/tenders/route-history?${params}&limit=10`)
      .then(d => setRouteHistory(d?.data || [])).catch(() => {});
  }, [selected?.id]);

  const getDistance = (m: any) => n(m.route?.distance_km || m.distance_km);
  const getStart = (m: any) => m.route?.start_point || m.start_point || '—';
  const getEnd = (m: any) => m.route?.end_point || m.end_point || '—';

  const filtered = useMemo(() => {
    let items = multilots.filter(m => !timeLeft(m.end_time).expired);
    if (tonnageF !== 'all') items = items.filter(m => n(m.tonnage) === n(tonnageF));
    if (directionF === 'round') items = items.filter(m => m.is_round_trip);
    if (directionF === 'one') items = items.filter(m => !m.is_round_trip);
    if (participatingF) items = items.filter(m => m.our_bet_status);
    if (mlSearch) { const q = mlSearch.toLowerCase(); items = items.filter(m => getStart(m).toLowerCase().includes(q) || getEnd(m).toLowerCase().includes(q) || String(m.id).includes(q)); }
    if (searchFrom) items = items.filter(m => getStart(m).toLowerCase().includes(searchFrom.toLowerCase()));
    if (searchTo) items = items.filter(m => getEnd(m).toLowerCase().includes(searchTo.toLowerCase()));
    if (distMin) items = items.filter(m => getDistance(m) >= n(distMin));
    if (distMax) items = items.filter(m => getDistance(m) <= n(distMax));
    if (rateMin) items = items.filter(m => n(m.route_rate) >= n(rateMin));
    if (rateMax) items = items.filter(m => n(m.route_rate) <= n(rateMax));
    items.sort((a, b) => {
      switch (sortBy) {
        case 'time_left': return new Date(a.end_time).getTime() - new Date(b.end_time).getTime();
        case 'rate': return n(b.route_rate) - n(a.route_rate);
        case 'rate_asc': return n(a.route_rate) - n(b.route_rate);
        case 'distance': return getDistance(b) - getDistance(a);
        case 'distance_asc': return getDistance(a) - getDistance(b);
        case 'participants': return n(b.participants_count) - n(a.participants_count);
        case 'participants_asc': return n(a.participants_count) - n(b.participants_count);
        case 'created': return new Date(b.start_time || b.end_time).getTime() - new Date(a.start_time || a.end_time).getTime();
        default: return 0;
      }
    });
    return items;
  }, [multilots, tonnageF, directionF, participatingF, mlSearch, searchFrom, searchTo, distMin, distMax, rateMin, rateMax, sortBy, tick]);

  const filteredFinished = useMemo(() => {
    let items = [...finished];
    if (fSearch) items = items.filter(m => (m.route_name || m.name || '').toLowerCase().includes(fSearch.toLowerCase()));
    if (fTonnage !== 'all') items = items.filter(m => n(m.tonnage) === n(fTonnage));
    if (fResult === 'won') items = items.filter(m => m.our_bet_status === 'BET_STATUS_LEADER');
    if (fResult === 'lost') items = items.filter(m => m.our_bet_status && m.our_bet_status !== 'BET_STATUS_LEADER');
    return items;
  }, [finished, fSearch, fTonnage, fResult]);

  const stats = useMemo(() => ({
    active: multilots.length,
    participating: multilots.filter(m => m.our_bet_status).length,
    avgRate: multilots.length > 0 ? Math.round(multilots.reduce((s, m) => s + n(m.route_rate), 0) / multilots.length) : 0,
    urgent: multilots.filter(m => { const tl = timeLeft(m.end_time); return tl.urgent && !tl.expired; }).length,
  }), [multilots, tick]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-gray-700 pb-2">
        {([
          { key: 'active', label: `Активные (${multilots.length})` },
          { key: 'finished', label: `Завершённые (${finished.length})` },
          { key: 'analytics', label: '📊 Аналитика' },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setSubTab(tab.key)}
            className={`px-4 py-2 rounded-t text-sm font-medium transition ${subTab === tab.key ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {subTab === 'active' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Активных', value: stats.active, icon: '📋' },
              { label: 'Мы ставили', value: stats.participating, icon: '✋' },
              { label: 'Средн. ориентир', value: fmtRate(stats.avgRate), icon: '💰' },
              { label: 'Скоро (<2ч)', value: stats.urgent, icon: '⏰', urgent: stats.urgent > 0 },
            ].map((s: any, i) => (
              <div key={i} className={`bg-gray-800/80 rounded-lg p-3 text-center ${s.urgent ? 'ring-1 ring-yellow-500' : ''}`}>
                <div className="text-xs text-gray-400">{s.icon} {s.label}</div>
                <div className="text-xl font-bold text-white mt-1">{typeof s.value === 'number' ? fmtNum(s.value) : s.value}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {[{ key: 'all', label: 'Все' }, { key: '5', label: '5т' }, { key: '20', label: '20т' }].map(f => (
              <button key={f.key} onClick={() => setTonnageF(f.key)}
                className={`px-3 py-1.5 rounded text-sm ${tonnageF === f.key ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{f.label}</button>
            ))}
            <span className="text-gray-600">|</span>
            {[{ key: 'all', label: 'Все' }, { key: 'round', label: '🔄 Т-О' }, { key: 'one', label: '➡️ Одна' }].map(f => (
              <button key={f.key} onClick={() => setDirectionF(f.key)}
                className={`px-3 py-1.5 rounded text-sm ${directionF === f.key ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>{f.label}</button>
            ))}
            <span className="text-gray-600">|</span>
            <button onClick={() => setParticipatingF(!participatingF)}
              className={`px-3 py-1.5 rounded text-sm ${participatingF ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>✋ Участвуем</button>
            <button onClick={() => setShowFilters(!showFilters)}
              className="px-3 py-1.5 rounded text-sm bg-gray-800 text-gray-300 hover:bg-gray-700">🔍 {showFilters ? 'Скрыть' : 'Фильтры'}</button>
            <input placeholder="🔍 Маршрут или #номер..." value={mlSearch} onChange={e => setMlSearch(e.target.value)}
              className="flex-1 min-w-[180px] max-w-xs px-3 py-1.5 rounded text-sm bg-gray-900 text-white border border-gray-700" />
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className="px-3 py-1.5 rounded text-sm bg-gray-800 text-gray-300 border border-gray-700">
              <option value="time_left">⏰ Время до закрытия</option>
              <option value="rate_asc">💰 Ставка ↑ (дешевле)</option>
              <option value="rate">💰 Ставка ↓ (дороже)</option>
              <option value="distance_asc">📏 Расст. ↑ (короткие)</option>
              <option value="distance">📏 Расст. ↓ (длинные)</option>
              <option value="participants">👥 Участники ↓ (горячие)</option>
              <option value="participants_asc">👥 Участники ↑ (лёгкие)</option>
              <option value="created">🆕 Новые</option>
            </select>
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-gray-800/50 rounded-lg p-3">
              <input placeholder="📍 Откуда" value={searchFrom} onChange={e => setSearchFrom(e.target.value)} className="px-3 py-1.5 rounded bg-gray-900 text-white text-sm border border-gray-700" />
              <input placeholder="📍 Куда" value={searchTo} onChange={e => setSearchTo(e.target.value)} className="px-3 py-1.5 rounded bg-gray-900 text-white text-sm border border-gray-700" />
              <div className="flex gap-1 items-center">
                <input placeholder="Км от" value={distMin} onChange={e => setDistMin(e.target.value)} type="number" className="w-20 px-2 py-1.5 rounded bg-gray-900 text-white text-sm border border-gray-700" />
                <span className="text-gray-500">—</span>
                <input placeholder="до" value={distMax} onChange={e => setDistMax(e.target.value)} type="number" className="w-20 px-2 py-1.5 rounded bg-gray-900 text-white text-sm border border-gray-700" />
              </div>
              <div className="flex gap-1 items-center">
                <input placeholder="₽/км" value={rateMin} onChange={e => setRateMin(e.target.value)} type="number" className="w-20 px-2 py-1.5 rounded bg-gray-900 text-white text-sm border border-gray-700" />
                <span className="text-gray-500">—</span>
                <input placeholder="до" value={rateMax} onChange={e => setRateMax(e.target.value)} type="number" className="w-20 px-2 py-1.5 rounded bg-gray-900 text-white text-sm border border-gray-700" />
              </div>
            </div>
          )}

          {loading ? <div className="text-center text-gray-400 py-8">Загрузка...</div> : filtered.length === 0 ? <div className="text-center text-gray-400 py-8">Нет мультилотов</div> : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((m: any) => {
                const tl = timeLeft(m.end_time);
                const dist = getDistance(m);
                const rate = n(m.route_rate);
                const perTrip = Math.round(rate * dist);
                const perDay = perTrip * n(m.number_trips);
                const st = statusBadge(m.our_bet_status);
                return (
                  <div key={m.id} onClick={() => setSelected(m)}
                    className={`bg-gray-800/90 rounded-lg p-4 border-2 ${cardBorder(m)} cursor-pointer hover:bg-gray-700/90 transition space-y-2`}>
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className="bg-purple-600/30 text-purple-300 text-xs font-bold px-2 py-0.5 rounded">📋 #{m.id}</span>
                        <span className="text-xs text-gray-400">{n(m.tonnage)}т</span>
                      </div>
                      <span className={`text-xs font-bold ${tl.urgent ? 'text-yellow-400 animate-pulse' : tl.expired ? 'text-gray-500' : 'text-gray-300'}`}>⏰ {tl.text}</span>
                    </div>
                    <div>
                      <div className="text-white font-medium text-sm">📍 {getStart(m)} → {getEnd(m)}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{m.is_round_trip ? '🔄 Туда-обратно' : '➡️ В одну сторону'} • {fmtNum(dist)} км</div>
                    </div>
                    <div className="text-xs text-gray-400 flex flex-wrap gap-x-3">
                      <span>🚛 {n(m.tonnage)}т • {m.body_type_label || 'Тент'}</span>
                      {m.loading_type_label && <span>• {m.loading_type_label}</span>}
                      {n(m.body_volume) > 0 && <span>📏 {m.body_volume}м³</span>}
                      {n(m.internal_body_height) > 0 && <span>↕{m.internal_body_height}м</span>}
                    </div>
                    <div className="text-xs space-y-0.5">
                      <div className="text-gray-400">📦 {n(m.number_trips)} рейс{m.is_round_trip ? ` + ${n(m.return_number_trips || m.number_trips)} обр.` : ''}/{m.period_label || 'сутки'} • {n(m.active_period)} дн</div>
                      <div className="text-white font-medium">💰 {fmtRate(rate)}</div>
                      {rate > 0 && dist > 0 && <div className="text-gray-300">💵 Маршрут: ~{fmtMoney(perTrip)} • Сутки: ~{fmtMoney(perDay)}</div>}
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-gray-700/50">
                      <span className={`text-xs font-bold ${pcColor(n(m.participants_count))}`}>👥 {n(m.participants_count)}</span>
                      <span className={`text-xs ${st.color}`}>{st.icon} {st.text}</span>
                    </div>
                    {m.additional_info && <div className="text-xs text-gray-500 italic">ℹ️ {m.additional_info}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {subTab === 'finished' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <input placeholder="🔍 Маршрут" value={fSearch} onChange={e => setFSearch(e.target.value)} className="px-3 py-1.5 rounded bg-gray-800 text-white text-sm border border-gray-700 w-48" />
            {['all', '5', '20'].map(t => (
              <button key={t} onClick={() => setFTonnage(t)} className={`px-3 py-1.5 rounded text-sm ${fTonnage === t ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-300'}`}>{t === 'all' ? 'Все' : `${t}т`}</button>
            ))}
            <span className="text-gray-600">|</span>
            {[{ key: 'all', label: 'Все' }, { key: 'won', label: '✅ Выиграли' }, { key: 'lost', label: '❌ Проиграли' }].map(f => (
              <button key={f.key} onClick={() => setFResult(f.key)} className={`px-3 py-1.5 rounded text-sm ${fResult === f.key ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-300'}`}>{f.label}</button>
            ))}
          </div>
          {filteredFinished.length === 0 ? <div className="text-center text-gray-400 py-8">Нет завершённых</div> : (
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-gray-400 border-b border-gray-700 text-xs">
              <th className="text-left p-2">№</th><th className="text-left p-2">Маршрут</th><th className="text-right p-2">Км</th>
              <th className="text-center p-2">Тн</th><th className="text-center p-2">↔</th><th className="text-right p-2">Ориент.</th>
              <th className="text-right p-2">Побед.</th><th className="text-right p-2">Δ</th><th className="text-left p-2">Победитель</th>
              <th className="text-center p-2">Уч.</th><th className="text-center p-2">⚡</th>
            </tr></thead><tbody>
              {filteredFinished.map((m: any) => {
                const rr = n(m.route_rate), wr = n(m.winning_rate || m.result_rate);
                const delta = rr > 0 ? Math.round((wr - rr) / rr * 100) : 0;
                const st = statusBadge(m.our_bet_status);
                return (<tr key={m.id} className="border-b border-gray-800 hover:bg-gray-800/50 text-gray-300">
                  <td className="p-2 text-purple-300">{m.id}</td>
                  <td className="p-2 max-w-[200px] truncate">{m.start_point}→{m.end_point}</td>
                  <td className="p-2 text-right">{fmtNum(n(m.distance_km))}</td>
                  <td className="p-2 text-center">{n(m.tonnage)}</td>
                  <td className="p-2 text-center">{m.is_round_trip ? '🔄' : '➡️'}</td>
                  <td className="p-2 text-right">{fmtRate(rr)}</td>
                  <td className="p-2 text-right font-medium text-white">{fmtRate(wr)}</td>
                  <td className={`p-2 text-right ${delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : ''}`}>{delta > 0 ? '+' : ''}{delta}%</td>
                  <td className="p-2 max-w-[150px] truncate">{m.winner_name || '—'}</td>
                  <td className="p-2 text-center">{n(m.participants_count)}</td>
                  <td className={`p-2 text-center ${st.color}`}>{st.icon}</td>
                </tr>);
              })}
            </tbody></table></div>
          )}
        </div>
      )}

      {subTab === 'analytics' && analytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Завершённых', value: n(analytics.total) },
              { label: 'Участвовали', value: n(analytics.participated) },
              { label: 'Побед', value: `${n(analytics.wins)} (${Math.round(n(analytics.win_rate))}%)` },
              { label: 'Средн. победная', value: fmtRate(n(analytics.avg_winning_rate)) },
              { label: 'Средн. участников', value: Math.round(n(analytics.avg_participants)) },
            ].map((s, i) => (
              <div key={i} className="bg-gray-800/80 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-400">{s.label}</div>
                <div className="text-lg font-bold text-white mt-1">{s.value}</div>
              </div>
            ))}
          </div>
          {analytics.by_route?.length > 0 && (
            <div><h3 className="text-sm font-medium text-gray-300 mb-2">📈 По направлениям</h3>
              <table className="w-full text-sm"><thead><tr className="text-gray-400 border-b border-gray-700 text-xs">
                <th className="text-left p-2">Маршрут</th><th className="text-right p-2">Кол-во</th><th className="text-right p-2">Ср.₽/км</th><th className="text-right p-2">Ср.уч.</th>
              </tr></thead><tbody>
                {analytics.by_route.map((r: any, i: number) => (
                  <tr key={i} className="border-b border-gray-800 text-gray-300">
                    <td className="p-2">{r.start_point}→{r.end_point}</td>
                    <td className="p-2 text-right">{n(r.cnt)}</td>
                    <td className="p-2 text-right">{fmtRate(n(r.avg_rate))}</td>
                    <td className="p-2 text-right">{Math.round(n(r.avg_pc))}</td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          )}
        </div>
      )}
      {subTab === 'analytics' && !analytics && <div className="text-center text-gray-400 py-8">Нет данных</div>}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setSelected(null)}>
          <div className="bg-gray-900 rounded-xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto p-6 space-y-5 border border-gray-700" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="bg-purple-600/30 text-purple-300 px-2 py-0.5 rounded text-sm">📋 #{selected.id}</span> Мультилот
                </h2>
                <div className="text-xs text-gray-400 mt-1">⏰ {timeLeft(selected.end_time).text} осталось</div>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>

            <div className="space-y-2">
              <div className="text-white font-medium">📍 {getStart(selected)} → {getEnd(selected)}</div>
              <div className="text-sm text-gray-400">{selected.is_round_trip ? '🔄 Туда-обратно' : '➡️ В одну сторону'} • {fmtNum(getDistance(selected))} км</div>
              {selected.is_round_trip && <div className="text-sm text-gray-500">📍 {getEnd(selected)} → {getStart(selected)} [обратно]</div>}
              <div className="flex flex-wrap gap-x-4 text-sm text-gray-400">
                <span>🚛 {n(selected.tonnage)}т • {selected.body_type_label || 'Тент'}</span>
                {selected.loading_type_label && <span>{selected.loading_type_label}</span>}
                {n(selected.body_volume) > 0 && <span>📏 {selected.body_volume}м³</span>}
                {n(selected.internal_body_height) > 0 && <span>↕{selected.internal_body_height}м</span>}
              </div>
              <div className="text-sm text-gray-400">📦 {n(selected.number_trips)} рейс{selected.is_round_trip ? ` + ${n(selected.return_number_trips || selected.number_trips)} обр.` : ''}/{selected.period_label || 'сутки'} • {n(selected.active_period)} дн</div>
              {selected.additional_info && <div className="text-sm text-gray-500 italic">ℹ️ {selected.additional_info}</div>}
              <div className="flex items-center gap-4 text-sm">
                <span className={`font-bold ${pcColor(n(selected.participants_count))}`}>👥 {n(selected.participants_count)}</span>
                {(() => { const s = statusBadge(selected.our_bet_status); return <span className={s.color}>{s.icon} {s.text}</span>; })()}
              </div>
            </div>

            <div className="bg-gray-800/80 rounded-lg p-4 space-y-1">
              <h3 className="text-sm font-bold text-white mb-2">💰 РАСЧЁТ</h3>
              {(() => {
                const rate = n(selected.route_rate), dist = getDistance(selected);
                const perTrip = Math.round(rate * dist), trips = n(selected.number_trips);
                const retTrips = n(selected.return_number_trips || (selected.is_round_trip ? trips : 0));
                const period = n(selected.active_period);
                if (selected.is_round_trip) {
                  const perDay = perTrip * trips + perTrip * retTrips;
                  return (<div className="text-sm space-y-0.5 text-gray-300">
                    <div>Ориентир: <span className="text-white font-medium">{fmtRate(rate)}</span></div>
                    <div>Туда: {fmtNum(dist)}км × {rate}₽ = {fmtMoney(perTrip)}</div>
                    <div>Обратно: {fmtNum(dist)}км × {rate}₽ = {fmtMoney(perTrip)}</div>
                    <div>За пару: <span className="text-white font-medium">{fmtMoney(perTrip * 2)}</span></div>
                    <div>Рейсов: {trips} + {retTrips} обратно</div>
                    <div>За сутки: <span className="text-white font-medium">{fmtMoney(perDay)}</span></div>
                    <div className="pt-1 border-t border-gray-700 text-white font-bold">За {period} дн: ~{fmtMoney(perDay * period)}</div>
                  </div>);
                }
                const perDay = perTrip * trips;
                return (<div className="text-sm space-y-0.5 text-gray-300">
                  <div>Ориентир: <span className="text-white font-medium">{fmtRate(rate)}</span></div>
                  <div>Расстояние: {fmtNum(dist)} км</div>
                  <div>За 1 рейс: {fmtMoney(perTrip)}</div>
                  <div>Рейсов/сутки: {trips}</div>
                  <div>За сутки: <span className="text-white font-medium">{fmtMoney(perDay)}</span></div>
                  <div className="pt-1 border-t border-gray-700 text-white font-bold">За {period} дн: ~{fmtMoney(perDay * period)}</div>
                </div>);
              })()}
            </div>

            {/* Bid section */}
            <div className="bg-gray-800/80 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-bold text-white">💰 НАША СТАВКА</h3>
              {selected.our_bet_status === 'BET_STATUS_LEADER' ? (
                <div className="text-green-400 font-bold">✅ Ставка принята: {n(selected.supplier_bet?.rate?.rate || selected.supplier_bet_rate)} ₽/км</div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <input type="number" step="0.1" placeholder="₽/км" value={bidRate}
                      onChange={e => { setBidRate(e.target.value); setBidResult(null); }}
                      className="w-32 px-3 py-2 rounded bg-gray-900 text-white border border-gray-700 text-sm" />
                    <button onClick={async () => {
                      const rate = parseFloat(bidRate);
                      if (!rate || rate <= 0) return;
                      setBidLoading(true); setBidResult(null);
                      try {
                        const res = await fetch(`/api/tenders/${selected.id}/bet`, {
                          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-role': 'director' },
                          body: JSON.stringify({ rate }),
                        });
                        const d = await res.json();
                        if (res.ok) { setBidResult({ type: 'success', text: `✅ Ставка ${rate} ₽/км принята!` }); }
                        else { setBidResult({ type: 'error', text: d.error || 'Ошибка' }); }
                      } catch (e: any) { setBidResult({ type: 'error', text: e.message }); }
                      setBidLoading(false);
                    }} disabled={bidLoading || !bidRate}
                      className="px-4 py-2 rounded bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 disabled:opacity-50">
                      {bidLoading ? '...' : 'Поставить'}
                    </button>
                  </div>
                  {bidResult && <div className={`text-sm ${bidResult.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>{bidResult.text}</div>}
                  {bidRate && parseFloat(bidRate) > 0 && (() => {
                    const br = parseFloat(bidRate), dist = getDistance(selected);
                    const perTrip = Math.round(br * dist), trips = n(selected.number_trips);
                    const retTrips = n(selected.return_number_trips || (selected.is_round_trip ? trips : 0));
                    const perDay = selected.is_round_trip ? perTrip * trips + perTrip * retTrips : perTrip * trips;
                    const period = n(selected.active_period);
                    return (<div className="text-xs text-gray-400 space-y-0.5 pt-1 border-t border-gray-700">
                      <div>📊 По вашей ставке ({br} ₽/км):</div>
                      <div>За рейс: {fmtMoney(perTrip)} {selected.is_round_trip ? `• За пару: ${fmtMoney(perTrip * 2)}` : ''}</div>
                      <div>За сутки: {fmtMoney(perDay)} • За {period} дн: ~{fmtMoney(perDay * period)}</div>
                    </div>);
                  })()}
                </>
              )}
            </div>

            {routeHistory.length > 0 && (
              <div className="bg-gray-800/80 rounded-lg p-4">
                <h3 className="text-sm font-bold text-white mb-2">📊 ИСТОРИЯ МАРШРУТА</h3>
                <table className="w-full text-xs"><thead><tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left p-1">Дата</th><th className="text-left p-1">Тип</th><th className="text-right p-1">Ставка</th><th className="text-right p-1">Уч.</th><th className="text-left p-1">Победитель</th>
                </tr></thead><tbody>
                  {routeHistory.map((h: any, i: number) => (
                    <tr key={i} className="border-b border-gray-800/50 text-gray-300">
                      <td className="p-1">{(h.finished_at || h.date) ? new Date(h.finished_at || h.date).toLocaleDateString('ru') : '—'}</td>
                      <td className="p-1">{h.type === 'multilot' ? '📋' : '📋'} {h.type === 'multilot' ? 'Мультилот' : 'Тендер'}</td>
                      <td className="p-1 text-right">{fmtRate(n(h.rate || h.winning_rate))}</td>
                      <td className="p-1 text-right">{n(h.participants_count)}</td>
                      <td className={`p-1 truncate max-w-[120px] ${h.winner_inn === '6679185730' || (h.winner_name || '').includes('ТРАНСПОРТНАЯ ЛОГИСТИКА') ? 'text-green-400 font-bold' : ''}`}>
                        {h.winner_inn === '6679185730' || (h.winner_name || '').includes('ТРАНСПОРТНАЯ ЛОГИСТИКА') ? '🟢 МЫ' : h.winner_name || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody></table>
                {(() => {
                  const rates = routeHistory.map((h: any) => n(h.rate || h.winning_rate)).filter((r: number) => r > 0);
                  if (!rates.length) return null;
                  const avg = Math.round(rates.reduce((s: number, r: number) => s + r, 0) / rates.length);
                  return <div className="text-xs text-gray-400 mt-2 pt-1 border-t border-gray-700">📈 Средняя: {avg}₽/км | Мин: {Math.min(...rates)} | Макс: {Math.max(...rates)}</div>;
                })()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
