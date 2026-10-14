"use client";

import { useState } from "react";
import { PriceAlertType } from "@prisma/client";
import { Bell, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface PriceAlertDialogProps {
  gameId: string;
  gameTitle: string;
  currentPrice: number;
  existingAlert?: {
    type: PriceAlertType;
    targetPrice?: number | null;
    targetDiscount?: number | null;
    targetDealScore?: number | null;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function PriceAlertDialog({
  gameId,
  gameTitle,
  currentPrice,
  existingAlert,
  isOpen,
  onClose,
  onSaved,
}: PriceAlertDialogProps) {
  const [type, setType] = useState<PriceAlertType>(
    existingAlert?.type || PriceAlertType.PRICE_BELOW
  );
  const [targetPrice, setTargetPrice] = useState<string>(
    existingAlert?.targetPrice ? String(existingAlert.targetPrice) : String(Math.floor(currentPrice * 0.8))
  );
  const [targetDiscount, setTargetDiscount] = useState<string>(
    existingAlert?.targetDiscount ? String(existingAlert.targetDiscount) : "50"
  );
  const [targetDealScore, setTargetDealScore] = useState<string>(
    existingAlert?.targetDealScore ? String(existingAlert.targetDealScore) : "80"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload: any = { gameId, type };

      if (type === PriceAlertType.PRICE_BELOW) {
        const val = parseFloat(targetPrice);
        if (isNaN(val) || val <= 0) {
          setError("Geçerli bir hedef fiyat giriniz.");
          setLoading(false);
          return;
        }
        payload.targetPrice = val;
      } else if (type === PriceAlertType.DISCOUNT_AT_LEAST) {
        const val = parseInt(targetDiscount, 10);
        if (isNaN(val) || val < 1 || val > 100) {
          setError("İndirim oranı %1 ile %100 arasında olmalıdır.");
          setLoading(false);
          return;
        }
        payload.targetDiscount = val;
      } else if (type === PriceAlertType.DEAL_SCORE_AT_LEAST) {
        const val = parseInt(targetDealScore, 10);
        if (isNaN(val) || val < 1 || val > 100) {
          setError("Fırsat skoru 1 ile 100 arasında olmalıdır.");
          setLoading(false);
          return;
        }
        payload.targetDealScore = val;
      }

      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Alarm kaydedilemedi.");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        if (onSaved) onSaved();
        onClose();
      }, 1000);
    } catch {
      setError("Ağ hatası oluştu.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Fiyat Alarmı Kur</h3>
            <p className="text-xs text-zinc-400 truncate max-w-xs">{gameTitle}</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-3 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Alarmınız başarıyla kaydedildi!</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-zinc-300">
              Alarm Tetiklenme Kriteri
            </label>

            <div className="space-y-2">
              <label className="flex items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-xs cursor-pointer hover:border-zinc-700 transition-colors">
                <input
                  type="radio"
                  name="alertType"
                  checked={type === PriceAlertType.PRICE_BELOW}
                  onChange={() => setType(PriceAlertType.PRICE_BELOW)}
                  className="accent-emerald-500"
                />
                <div className="flex-1">
                  <span className="font-semibold text-white block">Belirli Fiyatın Altına Düşünce</span>
                  <span className="text-[11px] text-zinc-400">Şu anki fiyat: {currentPrice} TL</span>
                </div>
              </label>

              {type === PriceAlertType.PRICE_BELOW && (
                <div className="pl-6 pt-1">
                  <label className="block text-[11px] text-zinc-400 mb-1">Hedef Fiyat (TRY):</label>
                  <input
                    type="number"
                    step="0.5"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    placeholder="Örn: 200"
                  />
                </div>
              )}

              <label className="flex items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-xs cursor-pointer hover:border-zinc-700 transition-colors">
                <input
                  type="radio"
                  name="alertType"
                  checked={type === PriceAlertType.DISCOUNT_AT_LEAST}
                  onChange={() => setType(PriceAlertType.DISCOUNT_AT_LEAST)}
                  className="accent-emerald-500"
                />
                <div className="flex-1">
                  <span className="font-semibold text-white block">Belirli Bir İndirim Oranına Ulaşınca</span>
                  <span className="text-[11px] text-zinc-400">Örneğin en az %50 indirim olduğunda</span>
                </div>
              </label>

              {type === PriceAlertType.DISCOUNT_AT_LEAST && (
                <div className="pl-6 pt-1">
                  <label className="block text-[11px] text-zinc-400 mb-1">Hedef İndirim Oranı (%):</label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={targetDiscount}
                    onChange={(e) => setTargetDiscount(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    placeholder="Örn: 50"
                  />
                </div>
              )}

              <label className="flex items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-xs cursor-pointer hover:border-zinc-700 transition-colors">
                <input
                  type="radio"
                  name="alertType"
                  checked={type === PriceAlertType.OBSERVED_LOW}
                  onChange={() => setType(PriceAlertType.OBSERVED_LOW)}
                  className="accent-emerald-500"
                />
                <div className="flex-1">
                  <span className="font-semibold text-white block">Tarihi Dip Fiyata Ulaşınca</span>
                  <span className="text-[11px] text-zinc-400">Takip süresince gözlemlenen en ucuz seviyeye indiğinde</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-xs cursor-pointer hover:border-zinc-700 transition-colors">
                <input
                  type="radio"
                  name="alertType"
                  checked={type === PriceAlertType.DEAL_SCORE_AT_LEAST}
                  onChange={() => setType(PriceAlertType.DEAL_SCORE_AT_LEAST)}
                  className="accent-emerald-500"
                />
                <div className="flex-1">
                  <span className="font-semibold text-white block">Fırsat Skoru Eşiğini Aşınca</span>
                  <span className="text-[11px] text-zinc-400">Analiz puanı belirlediğiniz puanın üzerine çıkınca</span>
                </div>
              </label>

              {type === PriceAlertType.DEAL_SCORE_AT_LEAST && (
                <div className="pl-6 pt-1">
                  <label className="block text-[11px] text-zinc-400 mb-1">Minimum Fırsat Skoru (1-100):</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={targetDealScore}
                    onChange={(e) => setTargetDealScore(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    placeholder="Örn: 80"
                  />
                </div>
              )}

              <label className="flex items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-xs cursor-pointer hover:border-zinc-700 transition-colors">
                <input
                  type="radio"
                  name="alertType"
                  checked={type === PriceAlertType.ANY_DISCOUNT}
                  onChange={() => setType(PriceAlertType.ANY_DISCOUNT)}
                  className="accent-emerald-500"
                />
                <div className="flex-1">
                  <span className="font-semibold text-white block">Herhangi Bir İndirime Girince</span>
                  <span className="text-[11px] text-zinc-400">Orana bakılmaksızın ilk fiyat düşüşünde</span>
                </div>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={loading || success}
              className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Alarmı Kaydet</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
