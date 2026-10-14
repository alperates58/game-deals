# XBOX EKLENTİ VE BUNDLE İLİŞKİLERİ ARAŞTIRMASI (FAZ 1.1)

**Tarih:** 2026-10-14  
**Kapsam:** Faz 1.1 Bundle & DLC Authoritative Relationship Gate  
**Durum:** VERIFIED  

---

## 1. Bundle İçerik İlişkileri (Bundle Contains Relationships)

Microsoft Display Catalog üzerinde test edilen gerçek bundle ürünlerinde (`docs/evidence/faz1.1/bundle-sku-properties.json`):
- **Authoritative JSON Yolu:**  
  `DisplaySkuAvailabilities[].Sku.Properties.BundledSkus[].BigId`
- **Örnek Kanıtlar:**
  1. **Metro Saga Bundle (`9N9Z4S1RD397`):**
     - Paket Fiyatı: **159,45 TL** (MSRP: 3.189,00 TL)
     - İçerdiği Oyunlar / BigId'ler:
       - `C1TBTQBVJMFL`: Metro Exodus (28,05 TL)
       - `C2W8ZSC68VRH`: Metro Exodus - The Two Colonels (20,00 TL)
       - `BNF60JD6LJFS`: Metro Exodus - Sam's Story (67,00 TL)
       - `BPPTRQZRJ341`: Metro 2033 Redux (8,62 TL)
       - `C03J6WR23XQ9`: Metro: Last Light Redux (8,62 TL)
     - Ayrı ayrı anlık satış toplamı: **132,29 TL** (Münferit indirimler nedeniyle paket fiyatı karşılaştırması doğrulanmıştır).
  2. **FAR CRY 4 + FAR CRY PRIMAL PAKETİ (`BV4F07T1WH5T`):**
     - `BundledSkus`: `['C0KJ40T9QD86' (Far Cry 4), 'BV6BRSLFJW3W' (Far Cry Primal)]`
  3. **Grand Theft Auto: The Trilogy – The Definitive Edition (`9MXMJFNZMVWD`):**
     - `BundledSkus`: `['9NF3HCF7MWB4' (GTA III), '9P7RSGG6Z699' (GTA San Andreas), '9PC16M34CB91' (GTA Vice City)]`

---

## 2. DLC / Add-on ↔ Ana Oyun İlişkileri (DLC of Relationships)

Microsoft Display Catalog üzerinde test edilen gerçek DLC ve eklenti ürünlerinde (`docs/evidence/faz1.1/addons/addon-properties-raw.json`):
- **Authoritative JSON Yolu:**  
  `MarketProperties[0].RelatedProducts` dizisinde `RelationshipType === "addOnParent"` olan nesnenin `RelatedProductId` alanı.
- **Örnek Kanıtlar:**
  1. **Far Cry 6 DLC 2 Pagan: Control (`9NPV7L06K0BB`):**  
     `addOnParent` -> `9N661LCNBH8J` (Far Cry 6)
  2. **Far Cry 6 DLC Bölüm 1 Insanity (`9NSXB5QB1L3T`):**  
     `addOnParent` -> `9PBNGCVBGML0` (Far Cry 6)
  3. **FAR CRY 4 SEASON PASS (`C4JQP2HXZFGD`):**  
     `addOnParent` -> `C0KJ40T9QD86` (Far Cry 4)
  4. **Forza Horizon 5 Hoş Geldin Paketi (`9MWHGB7HR6TT`):**  
     `addOnParent` -> `9NNX1VVR3KNQ` (Forza Horizon 5)
  5. **Metro Exodus - Sam's Story (`BNF60JD6LJFS`):**  
     `addOnParent` -> `C1TBTQBVJMFL` (Metro Exodus)
  6. **Metro Exodus - The Two Colonels (`C2W8ZSC68VRH`):**  
     `addOnParent` -> `C1TBTQBVJMFL` (Metro Exodus)

---

## 3. Ürün Sınıflandırma Hiyerarşisi (Product Classification Hierarchy)
1. **`CURRENCY` / `CONSUMABLE`:** `productType === 'Consumable'` veya başlıkta sanal para, coin, shark kartı içerenler (Kullanıcı arayüzünden filtrelenir).
2. **`BUNDLE`:** `Sku.Properties.IsBundle === true` veya `BundledSkus.length > 0` veya başlıkta birden fazla oyun içeren paketler.
3. **`SEASON_PASS`:** Başlığında "Season Pass" / "Sezon Bileti" geçen add-on'lar.
4. **`EXPANSION`:** Başlığında "Expansion" / "Genişletme" geçen add-on'lar.
5. **`DLC`:** Başlığında "DLC" geçen add-on'lar.
6. **`CONTENT_PACK`:** Başlığında "Pack", "Paketi", "Set", "Upgrade" geçen add-on'lar.
7. **`ADD_ON`:** Diğer `productType === 'Durable'` add-on ürünleri.
8. **`BASE_GAME`:** Bağımsız ana oyunlar (`productType === 'Game'`).
