"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";

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
  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 w-full flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 text-center text-zinc-400">
        <p className="text-sm font-medium text-zinc-300">Henüz Fiyat Geçmişi Oluşmadı</p>
        <p className="mt-1 text-xs text-zinc-400">
          Bu oyun yakın zamanda takibe alındı. Fiyat değiştikçe zaman serisi grafiği burada görüntülenecektir.
        </p>
      </div>
    );
  }

  // Format data for chart
  const chartData = data.map((d) => ({
    date: new Date(d.observedAt).toLocaleDateString("tr-TR", {
      month: "short",
      day: "numeric",
    }),
    fullDate: new Date(d.observedAt).toLocaleString("tr-TR"),
    currentPrice: d.currentPrice,
    listPrice: d.listPrice,
    isOnSale: d.isOnSale,
  }));

  // If there's only 1 point, duplicate it visually so the chart draws a clean flat baseline
  const displayData =
    chartData.length === 1
      ? [{ ...chartData[0], date: "Takip Başı" }, { ...chartData[0], date: "Bugün" }]
      : chartData;

  const minPrice = Math.min(...chartData.map((d) => d.currentPrice));
  const maxPrice = Math.max(...chartData.map((d) => d.listPrice));
  const yDomain = [Math.floor(minPrice * 0.8), Math.ceil(maxPrice * 1.1)];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-2 border-b border-zinc-800 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Gözlemlenen Fiyat Geçmişi</h3>
          <p className="text-xs text-zinc-400">
            Sistemimiz tarafından tespit edilen gerçek fiyat hareketleri
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
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={displayData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                        Fiyat: {p.currentPrice.toLocaleString("tr-TR")} {currency}
                      </p>
                      {p.listPrice > p.currentPrice && (
                        <p className="text-zinc-400 line-through">
                          Liste: {p.listPrice.toLocaleString("tr-TR")} {currency}
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
                value: `Dip: ${historicalLow} ₺`,
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
      </div>
    </div>
  );
}
