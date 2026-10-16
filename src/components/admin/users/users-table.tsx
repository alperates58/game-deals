"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Filter,
  Users,
  Shield,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Sparkles,
  Lock,
  Key,
  Gamepad2,
  Bell,
  Inbox,
  Clock,
  ArrowRight,
} from "lucide-react";
import { Role, AccountStatus, MembershipTier } from "@prisma/client";

interface UserItem {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: Role;
  accountStatus: AccountStatus;
  membershipTier: MembershipTier;
  emailVerifiedAt: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  hasPassword: boolean;
  isGoogle: boolean;
  gamesCount: number;
  alertsCount: number;
  notificationsCount: number;
}

interface UsersTableProps {
  initialUsers: UserItem[];
  initialPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function UsersTable({ initialUsers, initialPagination }: UsersTableProps) {
  const router = useRouter();
  const [users, setUsers] = useState<UserItem[]>(initialUsers);
  const [pagination, setPagination] = useState(initialPagination);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [authFilter, setAuthFilter] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState(false);

  const fetchUsers = async (page = 1) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(pagination.limit));
      if (search.trim()) params.set("q", search.trim());
      if (roleFilter !== "ALL") params.set("role", roleFilter);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (authFilter !== "ALL") params.set("authMethod", authFilter);

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users);
        setPagination(data.pagination);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-emerald-400" />
            <span>Kullanıcı Yönetimi</span>
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Sistemdeki tüm kayıtlı kullanıcıların rolleri, durumları, üyelikleri ve kütüphane aktiviteleri.
          </p>
        </div>

        <div className="text-xs font-semibold text-zinc-400">
          Toplam: <span className="text-white font-mono">{pagination.total}</span> kullanıcı
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="İsim veya e-posta ile ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
            }}
            className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-300 focus:border-emerald-500 focus:outline-none"
          >
            <option value="ALL">Rol: Tümü</option>
            <option value="USER">USER</option>
            <option value="OWNER">OWNER</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
            }}
            className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-300 focus:border-emerald-500 focus:outline-none"
          >
            <option value="ALL">Durum: Tümü</option>
            <option value="ACTIVE">Aktif (ACTIVE)</option>
            <option value="SUSPENDED">Askıda (SUSPENDED)</option>
          </select>

          {/* Auth Method */}
          <select
            value={authFilter}
            onChange={(e) => {
              setAuthFilter(e.target.value);
            }}
            className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-300 focus:border-emerald-500 focus:outline-none"
          >
            <option value="ALL">Giriş: Tümü</option>
            <option value="GOOGLE">Google OAuth</option>
            <option value="PASSWORD">Şifreli</option>
          </select>

          <button
            type="button"
            onClick={() => fetchUsers(1)}
            className="rounded-xl bg-zinc-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-zinc-700 transition-colors"
          >
            Filtrele
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/40">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-950/80 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
            <tr>
              <th className="p-4">Kullanıcı</th>
              <th className="p-4">Rol & Yetki</th>
              <th className="p-4">Hesap Durumu</th>
              <th className="p-4">Üyelik</th>
              <th className="p-4">Giriş Yolu</th>
              <th className="p-4 text-center">Oyun</th>
              <th className="p-4 text-center">Alarm</th>
              <th className="p-4">Kayıt / Son Giriş</th>
              <th className="p-4 text-right">Eylem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/20">
            {users.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-12 text-center text-zinc-500">
                  Kriterlere uygun kullanıcı bulunamadı.
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const isOwner = u.role === Role.OWNER;
                const isSuspended = u.accountStatus === AccountStatus.SUSPENDED;

                return (
                  <tr key={u.id} className="hover:bg-zinc-800/30 transition-colors">
                    {/* User Identity */}
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 font-bold text-xs shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/admin/users/${u.id}`}
                            className="font-bold text-white hover:text-emerald-400 transition-colors block truncate"
                          >
                            {u.name}
                          </Link>
                          <span className="text-[11px] text-zinc-400 block truncate">{u.email}</span>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold border ${
                          isOwner
                            ? "bg-amber-950/80 text-amber-300 border-amber-800/60"
                            : "bg-zinc-800 text-zinc-300 border-zinc-700"
                        }`}
                      >
                        {isOwner ? <ShieldAlert className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                        {u.role}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold border ${
                          isSuspended
                            ? "bg-rose-950/80 text-rose-300 border-rose-800/60"
                            : "bg-emerald-950/80 text-emerald-300 border-emerald-800/60"
                        }`}
                      >
                        {isSuspended ? <XCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                        {u.accountStatus}
                      </span>
                    </td>

                    {/* Membership Tier */}
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-300">
                        <Sparkles className="h-3 w-3 text-emerald-400" />
                        {u.membershipTier}
                      </span>
                    </td>

                    {/* Auth Methods */}
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        {u.isGoogle && (
                          <span className="h-5 px-1.5 flex items-center justify-center rounded bg-zinc-800 text-white font-bold text-[10px]" title="Google OAuth">
                            G
                          </span>
                        )}
                        {u.hasPassword && (
                          <span className="h-5 px-1.5 flex items-center justify-center rounded bg-zinc-800 text-zinc-300 text-[10px]" title="Parola">
                            <Lock className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Games */}
                    <td className="p-4 text-center font-mono text-zinc-300">{u.gamesCount}</td>

                    {/* Alerts */}
                    <td className="p-4 text-center font-mono text-zinc-300">{u.alertsCount}</td>

                    {/* Timestamps */}
                    <td className="p-4 text-[11px] text-zinc-400">
                      <div>Kayıt: {new Date(u.createdAt).toLocaleDateString("tr-TR")}</div>
                      <div className="text-zinc-500">
                        Giriş: {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString("tr-TR") : "-"}
                      </div>
                    </td>

                    {/* Action */}
                    <td className="p-4 text-right">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-zinc-800 px-2.5 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-emerald-600 hover:text-white transition-all"
                      >
                        <span>Detay</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 pt-2">
          <span className="text-xs text-zinc-400">
            Sayfa {pagination.page} / {pagination.totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1 || isLoading}
              onClick={() => fetchUsers(pagination.page - 1)}
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
            >
              Önceki
            </button>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages || isLoading}
              onClick={() => fetchUsers(pagination.page + 1)}
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
            >
              Sonraki
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
