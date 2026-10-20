"use client";

import { useState } from "react";
import Link from "next/link";
import {
  HomepageConfig,
  HomepageSectionConfig,
  PlatformFilter,
  ProductClassFilter,
  SectionQueryType,
  SortByOption,
} from "@/lib/settings/homepage-config";
import {
  Save,
  RotateCcw,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Flame,
  TrendingDown,
  Sparkles,
  DollarSign,
  Package,
  Award,
  Gamepad2,
  Monitor,
  Tag,
  Gift,
  Eye,
  Sliders,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

interface HomepageConfigEditorProps {
  initialConfig: HomepageConfig;
}

const ICON_OPTIONS = [
  { value: "flame", label: "Alev (Mega İndirim)", icon: Flame },
  { value: "trending-down", label: "Düşüş (Tarihi Dip)", icon: TrendingDown },
  { value: "sparkles", label: "Işıltı (Yeni / Fırsat)", icon: Sparkles },
  { value: "dollar-sign", label: "Para (Bütçe Dostu)", icon: DollarSign },
  { value: "package", label: "Paket (Koleksiyonlar)", icon: Package },
  { value: "award", label: "Rozet (Popüler)", icon: Award },
  { value: "gamepad", label: "Konsol (Xbox)", icon: Gamepad2 },
  { value: "monitor", label: "Monitör (PC)", icon: Monitor },
  { value: "tag", label: "Etiket (Özel)", icon: Tag },
  { value: "gift", label: "Hediye (Ücretsiz)", icon: Gift },
];

const PLATFORM_OPTIONS: { value: PlatformFilter; label: string }[] = [
  { value: "ALL", label: "Tümü (Tüm Platformlar)" },
  { value: "PC", label: "Windows 10/11 PC" },
  { value: "XboxSeriesX", label: "Xbox Series X|S" },
  { value: "XboxOne", label: "Xbox One" },
  { value: "Xbox", label: "Xbox Konsol (Genel)" },
];

const PRODUCT_CLASS_OPTIONS: { value: ProductClassFilter; label: string }[] = [
  { value: "ALL", label: "Tümü (Ana Oyun + Paket + DLC)" },
  { value: "BASE_GAME", label: "Sadece Ana Oyunlar" },
  { value: "BUNDLE", label: "Sadece Paketler & Koleksiyonlar" },
  { value: "ADD_ON", label: "Sadece Eklentiler & DLC" },
];

const QUERY_TYPE_OPTIONS: { value: SectionQueryType; label: string }[] = [
  { value: "HISTORICAL_LOW", label: "🎯 Tarihi Dipte Olanlar" },
  { value: "DEEP_DISCOUNT", label: "💥 Dev İndirimler (%70+ vb.)" },
  { value: "DEAL_SCORE", label: "⚡ Yüksek Fırsat Skoru" },
  { value: "BUDGET", label: "💰 Bütçe Dostu (Maks Fiyat Tavanı)" },
  { value: "PRICE_DROPS", label: "📉 Son Fiyatı Düşenler" },
  { value: "BUNDLES", label: "📦 Paketler & Koleksiyonlar" },
  { value: "POPULAR", label: "⭐ Popüler Ana Oyunlar" },
  { value: "FREE", label: "🎁 Tamamen Ücretsiz Oyunlar" },
  { value: "CUSTOM", label: "🛠️ Özel Filtre Kombinasyonu" },
];

const SORT_OPTIONS: { value: SortByOption; label: string }[] = [
  { value: "DEAL_SCORE_DESC", label: "Fırsat Skoru (Yüksekten Düşüğe)" },
  { value: "DISCOUNT_DESC", label: "İndirim Oranı (% Yüksekten Düşüğe)" },
  { value: "HISTORICAL_LOW_DATE", label: "Tarihi Dibe Ulaşma Tarihi (En Yeni)" },
  { value: "PRICE_ASC", label: "Fiyat (En Ucuzdan Pahalıya)" },
  { value: "PRICE_DESC", label: "Fiyat (En Pahalıdan Ucuza)" },
  { value: "RECENT_DROPS", label: "Fiyatı En Son Düşenler" },
  { value: "POPULARITY_DESC", label: "Popülerlik & İlgi" },
  { value: "NEWEST_DISCOVERY", label: "Kataloğa Yeni Eklenenler" },
];

export function HomepageConfigEditor({ initialConfig }: HomepageConfigEditorProps) {
  const [config, setConfig] = useState<HomepageConfig>(initialConfig);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSliderChange = <K extends keyof HomepageConfig["heroSlider"]>(
    key: K,
    value: HomepageConfig["heroSlider"][K]
  ) => {
    setConfig((prev) => ({
      ...prev,
      heroSlider: {
        ...prev.heroSlider,
        [key]: value,
      },
    }));
  };

  const handleSectionChange = <K extends keyof HomepageSectionConfig>(
    sectionId: string,
    key: K,
    value: HomepageSectionConfig[K]
  ) => {
    setConfig((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => (s.id === sectionId ? { ...s, [key]: value } : s)),
    }));
  };

  const moveSection = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= config.sections.length) return;

    const newSections = [...config.sections];
    const [moved] = newSections.splice(index, 1);
    newSections.splice(targetIndex, 0, moved);

    // Reassign order
    const ordered = newSections.map((s, idx) => ({ ...s, order: idx + 1 }));
    setConfig((prev) => ({ ...prev, sections: ordered }));
  };

  const deleteSection = (sectionId: string) => {
    if (!confirm("Bu vitrin bölümünü kaldırmak istediğinize emin misiniz?")) return;
    setConfig((prev) => ({
      ...prev,
      sections: prev.sections.filter((s) => s.id !== sectionId).map((s, idx) => ({ ...s, order: idx + 1 })),
    }));
  };

  const addNewSection = () => {
    const newId = `custom-section-${Date.now()}`;
    const newSection: HomepageSectionConfig = {
      id: newId,
      enabled: true,
      order: config.sections.length + 1,
      title: "Yeni Vitrin Rafı",
      subtitle: "Bu vitrin için açıklama metni",
      badgeText: "Özel Fırsat",
      icon: "flame",
      queryType: "CUSTOM",
      platform: "ALL",
      productClass: "ALL",
      minDiscountPercent: 20,
      sortBy: "DISCOUNT_DESC",
      limit: 15,
      viewAllUrl: "/firsatlar",
    };

    setConfig((prev) => ({
      ...prev,
      sections: [...prev.sections, newSection],
    }));
  };

  const saveChanges = async () => {
    setSaving(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/admin/homepage-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Kaydetme başarısız oldu.");
      }

      setStatusMessage({ type: "success", text: "Anasayfa vitrin ayarları başarıyla güncellendi!" });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Kaydetme hatası." });
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = async () => {
    if (!confirm("Tüm anasayfa vitrin yapılandırmasını varsayılan fabrika ayarlarına sıfırlamak istediğinize emin misiniz?")) {
      return;
    }

    setSaving(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/admin/homepage-config", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Sıfırlama başarısız oldu.");
      }

      setConfig(data.config);
      setStatusMessage({ type: "success", text: "Yapılandırma varsayılana sıfırlandı!" });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Sıfırlama hatası." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/80 p-5 rounded-2xl border border-zinc-800 sticky top-2 z-20 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
            <Sliders className="h-4 w-4" />
            <span>Vitrin & CMS Yöneticisi</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Anasayfa Vitrin Yapılandırması</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Hero slider, vitrin rafları, platform filtreleri ve sıralama kurallarını canlı yönetin.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href="/"
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 transition-colors"
          >
            <Eye className="h-3.5 w-3.5 text-zinc-400" />
            <span>Anasayfada Gör</span>
            <ExternalLink className="h-3 w-3 text-zinc-400" />
          </Link>

          <button
            onClick={resetToDefaults}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-700 bg-zinc-950 hover:bg-zinc-800 text-xs font-medium text-zinc-300 transition-colors disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5 text-zinc-400" />
            <span>Varsayılana Dön</span>
          </button>

          <button
            onClick={saveChanges}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-emerald-900/30 transition-all disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}</span>
          </button>
        </div>
      </div>

      {/* Status Alert */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center gap-3 animate-in fade-in duration-200 ${
            statusMessage.type === "success"
              ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-200"
              : "bg-red-950/60 border-red-500/40 text-red-200"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* 1. HERO SLIDER SETTINGS */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-950 border border-emerald-500/40 text-emerald-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Hero Slider (Tepe Öne Çıkanlar)</h3>
              <p className="text-xs text-zinc-400">Anasayfanın en tepesinde yer alan büyük slayt vitrini.</p>
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <span className="text-xs font-medium text-zinc-300">
              {config.heroSlider.enabled ? "Aktif (Yayında)" : "Pasif (Gizli)"}
            </span>
            <input
              type="checkbox"
              checked={config.heroSlider.enabled}
              onChange={(e) => handleSliderChange("enabled", e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600 relative"></div>
          </label>
        </div>

        {config.heroSlider.enabled && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block text-zinc-400 mb-1 font-medium">Slider Başlığı</label>
              <input
                type="text"
                value={config.heroSlider.title}
                onChange={(e) => handleSliderChange("title", e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-zinc-400 mb-1 font-medium">Hedef Platform Filtresi</label>
              <select
                value={config.heroSlider.platform}
                onChange={(e) => handleSliderChange("platform", e.target.value as PlatformFilter)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              >
                {PLATFORM_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-zinc-400 mb-1 font-medium">Filtre Kriteri</label>
              <select
                value={config.heroSlider.filter}
                onChange={(e) => handleSliderChange("filter", e.target.value as any)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="DEAL_SCORE">En Yüksek Fırsat Skoru (Tavsiye Edilen)</option>
                <option value="DISCOUNT">En Yüksek İndirim Oranı (% İndirim)</option>
                <option value="HISTORICAL_LOW">Tarihi Dip Fiyata İnenler</option>
              </select>
            </div>

            <div>
              <label className="block text-zinc-400 mb-1 font-medium">Slayt Adedi & Süre</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={config.heroSlider.limit}
                  onChange={(e) => handleSliderChange("limit", parseInt(e.target.value, 10))}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value={5}>5 Slayt</option>
                  <option value={10}>10 Slayt</option>
                  <option value={15}>15 Slayt</option>
                  <option value={20}>20 Slayt</option>
                </select>

                <select
                  value={config.heroSlider.autoplaySeconds}
                  onChange={(e) => handleSliderChange("autoplaySeconds", parseInt(e.target.value, 10))}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value={3}>3 sn geçiş</option>
                  <option value={5}>5 sn geçiş</option>
                  <option value={7}>7 sn geçiş</option>
                  <option value={10}>10 sn geçiş</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. VITRIN CAROUSEL SECTIONS */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-white">Vitrin Rafları (Carouseller & Koleksiyonlar)</h3>
            <p className="text-xs text-zinc-400">
              Anasayfada sıralı gösterilecek vitrin bölümlerini düzenleyin, platform ve filtre parametrelerini ayarlayın.
            </p>
          </div>

          <button
            onClick={addNewSection}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white transition-colors"
          >
            <Plus className="h-4 w-4 text-emerald-400" />
            <span>Yeni Vitrin Rafı Ekle</span>
          </button>
        </div>

        <div className="space-y-4">
          {config.sections.map((section, index) => {
            const IconComponent =
              ICON_OPTIONS.find((opt) => opt.value === section.icon)?.icon || Flame;

            return (
              <div
                key={section.id}
                className={`rounded-2xl border transition-all ${
                  section.enabled
                    ? "bg-zinc-900/60 border-zinc-800"
                    : "bg-zinc-950/40 border-zinc-800/40 opacity-70"
                } p-5 space-y-5`}
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/60 pb-3.5">
                  <div className="flex items-center gap-3">
                    {/* Order controls */}
                    <div className="flex items-center gap-1 bg-zinc-950 rounded-lg p-1 border border-zinc-800">
                      <button
                        onClick={() => moveSection(index, "up")}
                        disabled={index === 0}
                        title="Yukarı Taşı"
                        className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-xs font-mono font-bold px-1 text-zinc-300">
                        #{index + 1}
                      </span>
                      <button
                        onClick={() => moveSection(index, "down")}
                        disabled={index === config.sections.length - 1}
                        title="Aşağı Taşı"
                        className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="p-2 rounded-lg bg-zinc-800 text-emerald-400">
                      <IconComponent className="h-4 w-4" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{section.title}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
                          {section.badgeText || "Rozet Yok"}
                        </span>
                        {section.platform !== "ALL" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                            {PLATFORM_OPTIONS.find((p) => p.value === section.platform)?.label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 line-clamp-1">{section.subtitle}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-xs text-zinc-400">
                        {section.enabled ? "Açık" : "Kapalı"}
                      </span>
                      <input
                        type="checkbox"
                        checked={section.enabled}
                        onChange={(e) => handleSectionChange(section.id, "enabled", e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 relative"></div>
                    </label>

                    <button
                      onClick={() => deleteSection(section.id)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800/80 rounded-lg transition-colors"
                      title="Bölümü Sil"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Configuration form grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  {/* Title */}
                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium">Bölüm Başlığı</label>
                    <input
                      type="text"
                      value={section.title}
                      onChange={(e) => handleSectionChange(section.id, "title", e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Subtitle */}
                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium">Alt Açıklama Metni</label>
                    <input
                      type="text"
                      value={section.subtitle}
                      onChange={(e) => handleSectionChange(section.id, "subtitle", e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Badge Text */}
                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium">Rozet / Tag Metni</label>
                    <input
                      type="text"
                      value={section.badgeText}
                      onChange={(e) => handleSectionChange(section.id, "badgeText", e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Icon Selector */}
                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium">İkon</label>
                    <select
                      value={section.icon}
                      onChange={(e) => handleSectionChange(section.id, "icon", e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    >
                      {ICON_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Platform Filter */}
                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium flex items-center gap-1">
                      <Gamepad2 className="h-3 w-3 text-emerald-400" />
                      <span>Platform Filtresi</span>
                    </label>
                    <select
                      value={section.platform}
                      onChange={(e) => handleSectionChange(section.id, "platform", e.target.value as PlatformFilter)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-medium"
                    >
                      {PLATFORM_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Product Class */}
                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium">Ürün Türü</label>
                    <select
                      value={section.productClass}
                      onChange={(e) => handleSectionChange(section.id, "productClass", e.target.value as ProductClassFilter)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    >
                      {PRODUCT_CLASS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Query Type */}
                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium">Vitrin Filtre Türü</label>
                    <select
                      value={section.queryType}
                      onChange={(e) => handleSectionChange(section.id, "queryType", e.target.value as SectionQueryType)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-medium"
                    >
                      {QUERY_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Sort By */}
                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium">Sıralama Ölçütü</label>
                    <select
                      value={section.sortBy}
                      onChange={(e) => handleSectionChange(section.id, "sortBy", e.target.value as SortByOption)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    >
                      {SORT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Extra Numeric Limits */}
                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium">Min. İndirim Oranı (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={section.minDiscountPercent ?? ""}
                      onChange={(e) =>
                        handleSectionChange(
                          section.id,
                          "minDiscountPercent",
                          e.target.value ? parseInt(e.target.value, 10) : undefined
                        )
                      }
                      placeholder="Örn: 50"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium">Maks. Fiyat Tavanı (TL)</label>
                    <input
                      type="number"
                      min={0}
                      value={section.maxPrice ?? ""}
                      onChange={(e) =>
                        handleSectionChange(
                          section.id,
                          "maxPrice",
                          e.target.value ? parseFloat(e.target.value) : undefined
                        )
                      }
                      placeholder="Örn: 150"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium">Maks. Gösterilecek Oyun</label>
                    <select
                      value={section.limit}
                      onChange={(e) => handleSectionChange(section.id, "limit", parseInt(e.target.value, 10))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value={8}>8 Oyun</option>
                      <option value={10}>10 Oyun</option>
                      <option value={15}>15 Oyun (Standart)</option>
                      <option value={20}>20 Oyun</option>
                      <option value={30}>30 Oyun (Geniş)</option>
                      <option value={50}>50 Oyun</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium">"Tümünü Gör" Linki</label>
                    <input
                      type="text"
                      value={section.viewAllUrl ?? ""}
                      onChange={(e) => handleSectionChange(section.id, "viewAllUrl", e.target.value)}
                      placeholder="/tarihi-dip veya /firsatlar"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
