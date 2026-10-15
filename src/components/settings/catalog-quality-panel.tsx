"use client";

import { useState, useEffect } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Image as ImageIcon,
  DollarSign,
  Layers,
  Clock,
  RefreshCw,
  ChevronRight,
  ArrowLeft,
  Loader2,
  FileQuestion,
  ExternalLink,
  PackageCheck,
  PackageX,
  Sparkles,
} from "lucide-react";
import type {
  CatalogQualityReport,
  QualityIssueItem,
  QualityIssueType,
} from "@/lib/catalog/catalog-quality";

export function CatalogQualityPanel() {
  const [report, setReport] = useState<CatalogQualityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Drill-down state
  const [selectedIssue, setSelectedIssue] = useState<QualityIssueType | null>(null);
  const [drillDownLoading, setDrillDownLoading] = useState(false);
  const [drillDownItems, setDrillDownItems] = useState<QualityIssueItem[]>([]);
  const [drillDownTotal, setDrillDownTotal] = useState(0);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/catalog-quality");
      const data = await res.json();
      if (data.success && data.report) {
        setReport(data.report);
      } else {
        setError(data.error || "Rapor yüklenemedi.");
      }
    } catch (err: any) {
      setError(err.message || "Bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDrillDown = async (issueType: QualityIssueType) => {
    setSelectedIssue(issueType);
    setDrillDownLoading(true);
    try {
      const res = await fetch(`/api/settings/catalog-quality?issue=${issueType}&limit=50`);
      const data = await res.json();
      if (data.success) {
        setDrillDownItems(data.items || []);
        setDrillDownTotal(data.total || 0);
      }
    } catch (err) {
      console.error("[QualityDrillDown] Error:", err);
    } finally {
      setDrillDownLoading(false);
    }
  };

  const handleCloseDrillDown = () => {
    setSelectedIssue(null);
    setDrillDownItems([]);
    setDrillDownTotal(0);
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const getGradeBadge = (grade: string) => {
    switch (grade) {
      case "EXCELLENT":
        return {
          bg: "bg-emerald-950/80 border-emerald-800 text-emerald-400",
          label: "MÜKEMMEL (EXCELLENT)",
          desc: "Katalog veri kalitesi en üst standartta.",
        };
      case "HEALTHY":
        return {
          bg: "bg-teal-950/80 border-teal-800 text-teal-400",
          label: "SAĞLIKLI (HEALTHY)",
          desc: "Kritik veri anomalisi bulunmuyor.",
        };
      case "NEEDS_ATTENTION":
        return {
          bg: "bg-amber-950/80 border-amber-800 text-amber-400",
          label: "İNCELEME GEREKLİ (NEEDS ATTENTION)",
          desc: "Bazı kayıtlarda veri eksiklikleri tespit edildi.",
        };
      case "DEGRADED":
      default:
        return {
          bg: "bg-red-950/80 border-red-800 text-red-400",
          label: "BOZUK / RİSKLİ (DEGRADED)",
          desc: "Fiyat veya ilişki tutarsızlıkları mevcut.",
        };
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 rounded-xl border border-zinc-800 bg-zinc-900/40 text-center">
        <Loader2 className="h-8 w-8 text-emerald-400 animate-spin mb-3" />
        <p className="text-sm font-medium text-white">Katalog Sağlığı Analiz Ediliyor...</p>
        <p className="text-xs text-zinc-500 mt-1">
          Fiyat anomalileri, yetim ilişkiler ve veri bütünlüğü taranıyor.
        </p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="p-6 rounded-xl border border-red-800/80 bg-red-950/30 text-center">
        <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-2" />
        <h4 className="text-sm font-semibold text-white">Katalog Kalite Raporu Alınamadı</h4>
        <p className="text-xs text-red-300 mt-1">{error}</p>
        <button
          type="button"
          onClick={fetchReport}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-700"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Tekrar Dene
        </button>
      </div>
    );
  }

  const gradeInfo = getGradeBadge(report.grade);

  // Render Drill-Down view if an issue card was selected
  if (selectedIssue) {
    const selectedMetric = report.metrics[selectedIssue];
    return (
      <div className="space-y-4">
        {/* Back navigation */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <button
            type="button"
            onClick={handleCloseDrillDown}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Katalog Sağlığı Özetine Dön</span>
          </button>

          <span className="text-xs text-zinc-400 font-mono">
            {selectedMetric?.label} &bull; {drillDownTotal} Kayıt
          </span>
        </div>

        {/* Drill-down Header Card */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>{selectedMetric?.label}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-normal">
                  {selectedIssue}
                </span>
              </h3>
              <p className="text-xs text-zinc-400 mt-1">{selectedMetric?.description}</p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-2xl font-black text-amber-400 font-mono">{drillDownTotal}</div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Etkilenen Kayıt</div>
            </div>
          </div>
        </div>

        {/* Drill-down Items Table */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Teşhis Listesi (İlk 50 Kayıt - Yalnızca Teşhis Modu)</span>
            <span className="text-[11px] text-emerald-400 font-mono">
              Veritabanı Salt-Okunur İnceleme
            </span>
          </div>

          {drillDownLoading ? (
            <div className="py-12 text-center text-xs text-zinc-400">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-400" />
              Kayıtlar yükleniyor...
            </div>
          ) : drillDownItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">
              Bu kategoride incelenmesi gereken sorunlu kayıt bulunamadı.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-800/80">
              <table className="w-full text-left text-xs text-zinc-300 min-w-[700px]">
                <thead className="bg-zinc-950/80 text-[11px] uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Oyun / Ürün</th>
                    <th className="py-2.5 px-3 font-semibold">BigId</th>
                    <th className="py-2.5 px-2 font-semibold">Sınıf</th>
                    <th className="py-2.5 px-2 font-semibold">Platform</th>
                    <th className="py-2.5 px-2 font-semibold text-right">Fiyat</th>
                    <th className="py-2.5 px-3 font-semibold">Teşhis Nedeni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-sans text-xs">
                  {drillDownItems.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-white max-w-[240px] truncate">
                        {item.title}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-emerald-400">
                        {item.bigId}
                      </td>
                      <td className="py-2.5 px-2 text-[11px]">
                        <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                          {item.productClass}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-[11px] text-zinc-400 max-w-[120px] truncate">
                        {item.platform}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-semibold text-zinc-200">
                        {item.currentPrice > 0 ? `${item.currentPrice} TL` : "0 TL"}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-amber-300/90 leading-tight">
                        {item.issueReason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Summary View
  const cardsConfig: {
    key: QualityIssueType;
    icon: any;
    accentColor: string;
  }[] = [
    { key: "UNKNOWN_PRODUCT_CLASS", icon: FileQuestion, accentColor: "border-amber-500/40 text-amber-400" },
    { key: "MISSING_CURRENT_PRICE", icon: DollarSign, accentColor: "border-red-500/40 text-red-400" },
    { key: "MISSING_IMAGE", icon: ImageIcon, accentColor: "border-amber-500/40 text-amber-400" },
    { key: "MISSING_PLATFORM", icon: Layers, accentColor: "border-blue-500/40 text-blue-400" },
    { key: "BUNDLE_WITHOUT_CHILDREN", icon: PackageX, accentColor: "border-red-500/40 text-red-400" },
    { key: "ORPHAN_RELATION", icon: XCircle, accentColor: "border-red-500/40 text-red-400" },
    { key: "SUSPICIOUS_BUNDLE_RELATION", icon: AlertTriangle, accentColor: "border-amber-500/40 text-amber-400" },
    { key: "STALE_PRICE", icon: Clock, accentColor: "border-zinc-500/40 text-zinc-400" },
    { key: "STALE_METADATA", icon: Clock, accentColor: "border-zinc-500/40 text-zinc-400" },
    { key: "INVALID_DISCOUNT", icon: DollarSign, accentColor: "border-red-500/40 text-red-400" },
    { key: "PRICE_ABOVE_LIST_PRICE", icon: DollarSign, accentColor: "border-red-500/40 text-red-400" },
    { key: "HISTORICAL_LOW_ANOMALY", icon: DollarSign, accentColor: "border-red-500/40 text-red-400" },
    { key: "ZERO_PRICE_COMMERCIAL", icon: HelpCircle, accentColor: "border-amber-500/40 text-amber-400" },
    { key: "DISCOVERY_GAP", icon: Sparkles, accentColor: "border-emerald-500/40 text-emerald-400" },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Master Catalog Health Score Bento Hero */}
      <div className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900/90 via-zinc-900/60 to-zinc-950 p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            {/* Health Score Gauge / Badge */}
            <div className="flex flex-col items-center justify-center h-24 w-24 sm:h-28 sm:w-28 rounded-2xl bg-zinc-950 border-2 border-emerald-500/60 shadow-inner shrink-0">
              <span className="text-3xl sm:text-4xl font-black font-mono text-emerald-400">
                {report.healthScore}
              </span>
              <span className="text-[10px] uppercase font-bold text-zinc-400 mt-0.5">/ 100</span>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${gradeInfo.bg}`}>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {gradeInfo.label}
                </span>
                <span className="text-xs text-zinc-500">
                  Son Hesaplama: {new Date(report.timestamp).toLocaleTimeString("tr-TR")}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Katalog Veri Kalitesi & Sağlık Skoru
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-xl leading-relaxed">
                {gradeInfo.desc} Ağırlıklı anomali cezası, yetim ilişki kontrolü ve Microsoft mağaza tutarlılığı ile hesaplanmaktadır.
              </p>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3 shrink-0">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-center">
              <div className="text-lg sm:text-xl font-bold font-mono text-white">
                {report.totalProducts.toLocaleString("tr-TR")}
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5">Toplam Ürün</div>
            </div>

            <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/30 p-3 text-center">
              <div className="text-lg sm:text-xl font-bold font-mono text-emerald-400">
                {report.healthyProducts.toLocaleString("tr-TR")}
              </div>
              <div className="text-[11px] text-emerald-300 mt-0.5">Sağlıklı Ürün</div>
            </div>

            <div className="rounded-xl border border-amber-900/60 bg-amber-950/30 p-3 text-center">
              <div className="text-lg sm:text-xl font-bold font-mono text-amber-400">
                {report.needsReviewProducts.toLocaleString("tr-TR")}
              </div>
              <div className="text-[11px] text-amber-300 mt-0.5">İncelenmesi Gereken</div>
            </div>
          </div>
        </div>

        {/* Sanity Check Bar */}
        <div className="mt-5 pt-4 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-300">Zorunlu Referans Kontrolü (Sanity):</span>
            <span className="font-mono text-zinc-400">Black Myth: Wukong ({report.sanityChecks.wukongBigId})</span>
          </div>
          <div>
            {report.sanityChecks.status === "PASS" ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800 font-semibold text-[11px]">
                <CheckCircle2 className="h-3 w-3" />
                VERİTABANINDA MEVCUT (PASS)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-950/80 text-amber-400 border border-amber-800 font-semibold text-[11px]">
                <AlertTriangle className="h-3 w-3" />
                KEŞİF GAP (DISCOVERY_GAP)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Issue Cards Grid (Interactive Drill-Down) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Kalite & Anomali Teşhis Kartları</h3>
            <p className="text-xs text-zinc-400">
              Kayıtları incelemek ve teşhis listesini açmak için ilgili kartın üzerine tıklayın.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchReport}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Yeniden Tara</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cardsConfig.map((card) => {
            const metric = report.metrics[card.key];
            const Icon = card.icon;
            const count = metric?.count || 0;
            const hasIssues = count > 0;

            return (
              <button
                key={card.key}
                type="button"
                onClick={() => handleOpenDrillDown(card.key)}
                className={`group flex items-start justify-between rounded-xl border p-4 text-left transition-all hover:bg-zinc-800/40 active:scale-[0.99] ${
                  hasIssues
                    ? "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700"
                    : "border-zinc-800/40 bg-zinc-950/30 opacity-70 hover:opacity-100"
                }`}
              >
                <div className="space-y-1.5 min-w-0 pr-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg border bg-zinc-950 ${card.accentColor}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors truncate">
                      {metric?.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                    {metric?.description}
                  </p>
                </div>

                <div className="flex flex-col items-end shrink-0">
                  <span
                    className={`font-mono font-bold text-sm sm:text-base ${
                      hasIssues
                        ? metric?.severity === "CRITICAL"
                          ? "text-red-400"
                          : "text-amber-400"
                        : "text-emerald-400"
                    }`}
                  >
                    {count}
                  </span>
                  <div className="flex items-center text-[10px] text-zinc-500 group-hover:text-zinc-300 mt-2">
                    <span>Detay</span>
                    <ChevronRight className="h-3 w-3 ml-0.5" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
