"use client";

import { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { Info, Clock } from "lucide-react";
import { formatDateTime, formatShortDate, formatPrice } from "@/lib/formatters";

interface PricePoint {
  observedAt: string;
  currentPrice: number;
  listPrice: number;
  isOnSale: boolean;
}

interface PriceHistoryChartProps {
  data: PricePoint[];
  historicalLow: number;
  currency: string;
}

export function PriceHistoryChart({ data, historicalLow, currency }: PriceHistoryChartProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 1. Durum: Hiç kayıt yok
  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 w-full flex-col items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-center text-zinc-400">
        <Info className="h-8 w-8 text-zinc-600 mb-2" />
        <p className="text-sm font-semibold text-zinc-300">Henüz Fiyat Geçmişi Bulunmuyor</p>
        <p className="mt-1 max-w-md text-xs text-zinc-400">
          Bu ürün yakın zamanda takibe alındı. Fiyat değiştikçe zaman serisi grafiği burada görüntülenecektir.
        </p>
      </div>
    );
  }

  // 2. Durum: Tek bir referans gözlem var (Doğruluk ilkesi: Yapay nokta eklenmez, grafik çizilmez)
  if (data.length === 1) {
    const single = data[0];
    const obsDate = formatDateTime(single.observedAt);

    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-800/80 gap-2">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-400" />
              Gözlemlenen Fiyat Geçmişi (Başlangıç Referansı)
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Tekil referans kaydı (Doğruluk ilkesi gereği yapay grafik verisi üretilmez)
            </p>
          </div>
          <span className="inline-flex items-center rounded-md bg-zinc-800/90 px-2.5 py-1 text-[11px] font-medium text-zinc-300 border border-zinc-700/60">
            1 Gözlem
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
            <span className="text-[11px] text-zinc-400 block mb-1">İlk Tespit Tarihi</span>
            <span className="text-sm font-semibold text-white font-mono" suppressHydrationWarning>{obsDate}</span>
          </div>
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
            <span className="text-[11px] text-zinc-400 block mb-1">Tespit Edilen Fiyat</span>
            <div className="flex items-baseline gap-2">
              <span className="text-base font-bold text-emerald-400">
                {formatPrice(single.currentPrice)} {currency}
              </span>
              {single.listPrice > single.currentPrice && (
                <span className="text-xs text-zinc-400 line-through">
                  {formatPrice(single.listPrice)} {currency}
                </span>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
            <span className="text-[11px] text-zinc-400 block mb-1">Gözlem Durumu</span>
            <span className="text-xs text-zinc-300">
              {single.isOnSale ? "İndirim Döneminde Tespit Edildi" : "Normal Fiyattan Tespit Edildi"}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-3.5 flex items-start gap-2.5 text-xs text-zinc-400">
          <Info className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          <p>
            Bu oyun için sistemimize henüz tek bir fiyat gözlemi kaydedildi. Trend ve dalgalanma grafiği, mağazada en az 2 farklı fiyat hareketi tespit edildiğinde otomatik olarak çizilecektir.
          </p>
        </div>
      </div>
    );
  }

  // 3. Durum: İki veya daha fazla gözlem (Zaman serisi grafiği)
  const chartData = data.map((d) => ({
    date: formatShortDate(d.observedAt),
    fullDate: formatDateTime(d.observedAt),
    currentPrice: d.currentPrice,
    listPrice: d.listPrice,
    isOnSale: d.isOnSale,
  }));

  const minPrice = Math.min(...chartData.map((d) => d.currentPrice));
  const maxPrice = Math.max(...chartData.map((d) => d.listPrice));
  const yDomain = [Math.floor(minPrice * 0.8), Math.ceil(maxPrice * 1.1)];

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-800/80 gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white">Gözlemlenen Fiyat Geçmişi</h3>
          <p className="text-xs text-zinc-400">
            Sistemimiz tarafından tespit edilen gerçek fiyat hareketleri ({data.length} gözlem)
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-zinc-300">Satış Fiyatı</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 bg-amber-500/80" />
            <span className="text-zinc-300">Gözlemlenen En Düşük</span>
          </div>
        </div>
      </div>

      <div className="h-64 sm:h-72 w-full">
        {!isMounted ? (
          <div className="h-full w-full flex items-center justify-center rounded-xl bg-zinc-950/40 border border-zinc-800/40 animate-pulse">
            <span className="text-xs text-zinc-500">Grafik yükleniyor...</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                stroke="#52525b"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: "#27272a" }}
              />
              <YAxis
                stroke="#52525b"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: "#27272a" }}
                domain={yDomain}
                tickFormatter={(val) => `${val} ₺`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const p = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-2.5 shadow-xl text-xs">
                        <p className="font-semibold text-zinc-300">{p.fullDate || p.date}</p>
                        <p className="mt-1 font-bold text-emerald-400">
                          Fiyat: {formatPrice(p.currentPrice)} {currency}
                        </p>
                        {p.listPrice > p.currentPrice && (
                          <p className="text-zinc-400 line-through">
                            Liste: {formatPrice(p.listPrice)} {currency}
                          </p>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine
                y={historicalLow}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                label={{
                  value: `Dip: ${formatPrice(historicalLow)} ₺`,
                  fill: "#f59e0b",
                  fontSize: 10,
                  position: "right",
                }}
              />
              <Area
                type="monotone"
                dataKey="currentPrice"
                stroke="#10b981"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#priceGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
