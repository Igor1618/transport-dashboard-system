'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';

interface User {
  id: number;
  email: string;
  full_name: string;
  role: string;
  role_display: string;
  role_id: number;
  is_active: boolean;
}

interface Role {
  id: number;
  name: string;
  display_name: string;
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role_id: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { loadUsers(); loadRoles(); }, []);

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/users', {
        headers: { 'x-user-id': String(currentUser?.id || ''), 'x-user-role': currentUser?.role || '' }
      });
      if (res.ok) setUsers(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const loadRoles = async () => {
    try {
      const res = await fetch('/api/users/roles');
      if (res.ok) setRoles(await res.json());
    } catch (e) { console.error(e); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    const url = editingUser ? '/api/users/' + editingUser.id : '/api/users';
    const method = editingUser ? 'PUT' : 'POST';
    
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(currentUser?.id || ''), 'x-user-role': currentUser?.role || '' },
        body: JSON.stringify({ ...form, role_id: Number(form.role_id) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setSuccess(editingUser ? 'Обновлено' : 'Создано');
      setShowForm(false); setEditingUser(null);
      setForm({ email: '', password: '', full_name: '', role_id: '' });
      loadUsers();
    } catch (err: any) { setError(err.message); }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setForm({ email: user.email, password: '', full_name: user.full_name, role_id: String(user.role_id) });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Деактивировать?')) return;
    await fetch('/api/users/' + id, { method: 'DELETE', headers: { 'x-user-id': String(currentUser?.id || ''), 'x-user-role': currentUser?.role || '' } });
    loadUsers();
  };

  if (currentUser?.role !== 'director') return <div className="p-6 text-red-400">Доступ запрещён</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Пользователи</h1>
        <button onClick={() => { setShowForm(true); setEditingUser(null); setForm({ email: '', password: '', full_name: '', role_id: '' }); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg">+ Добавить</button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-300">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-900/50 border border-green-500 rounded text-green-300">{success}</div>}

      {showForm && (
        <div className="mb-6 p-4 bg-gray-800 rounded-lg">
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <input type="email" placeholder="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="p-2 bg-gray-700 rounded text-white" required />
            <input type="password" placeholder="Пароль" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="p-2 bg-gray-700 rounded text-white" required={!editingUser} />
            <input type="text" placeholder="ФИО" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} className="p-2 bg-gray-700 rounded text-white" required />
            <select value={form.role_id} onChange={e => setForm({...form, role_id: e.target.value})} className="p-2 bg-gray-700 rounded text-white" required>
              <option value="">Роль</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.display_name}</option>)}
            </select>
            <div className="col-span-2 flex gap-2">
              <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded">{editingUser ? 'Сохранить' : 'Создать'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-600 text-white rounded">Отмена</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-700"><tr><th className="p-3 text-left text-gray-300">ФИО</th><th className="p-3 text-left text-gray-300">Email</th><th className="p-3 text-left text-gray-300">Роль</th><th className="p-3 text-left text-gray-300">Статус</th><th className="p-3">Действия</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-t border-gray-700">
                <td className="p-3 text-white">{u.full_name}</td>
                <td className="p-3 text-gray-300">{u.email}</td>
                <td className="p-3 text-gray-300">{u.role_display}</td>
                <td className="p-3"><span className={u.is_active ? 'text-green-400' : 'text-red-400'}>{u.is_active ? 'Активен' : 'Неактивен'}</span></td>
                <td className="p-3"><button onClick={() => handleEdit(u)} className="text-blue-400 mr-2">✏️</button>{u.is_active && <button onClick={() => handleDelete(u.id)} className="text-red-400">🗑️</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
