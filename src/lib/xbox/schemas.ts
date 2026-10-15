import { z } from "zod";

export const XboxImageSchema = z.object({
  ImagePurpose: z.string().optional(),
  Uri: z.string().optional(),
  Height: z.number().optional(),
  Width: z.number().optional(),
});

export const XboxVideoSchema = z.object({
  VideoPurpose: z.string().optional(),
  Uri: z.string().optional(),
  VideoTitle: z.string().optional(),
});

export const XboxLocalizedPropertySchema = z.object({
  ProductTitle: z.string().default("İsimsiz Oyun"),
  PublisherName: z.string().optional(),
  DeveloperName: z.string().optional(),
  ShortDescription: z.string().optional(),
  ProductDescription: z.string().optional(),
  Images: z.array(XboxImageSchema).optional(),
  Videos: z.array(XboxVideoSchema).optional(),
});

export const XboxPriceSchema = z.object({
  CurrencyCode: z.string().optional(),
  ListPrice: z.number().default(0),
  MSRP: z.number().optional(),
  WholesalePrice: z.number().optional(),
  WholesaleCurrencyCode: z.string().optional(),
});

export const XboxClientConditionsSchema = z.object({
  AllowedPlatforms: z.array(z.object({
    PlatformName: z.string(),
  })).optional(),
});

export const XboxConditionsSchema = z.object({
  ClientConditions: XboxClientConditionsSchema.optional(),
  StartDate: z.string().optional(),
  EndDate: z.string().optional(),
});

export const XboxAvailabilitySchema = z.object({
  AvailabilityId: z.string(),
  Actions: z.array(z.string()).optional(),
  Markets: z.array(z.string()).optional(),
  Conditions: XboxConditionsSchema.optional(),
  OrderManagementData: z.object({
    Price: XboxPriceSchema.optional(),
  }).optional(),
});

export const XboxBundledSkuItemSchema = z.object({
  BigId: z.string(),
  DisplayRank: z.number().optional(),
  IsPrimary: z.boolean().optional(),
});

export const XboxSkuPropertiesSchema = z.object({
  BundledSkus: z.array(XboxBundledSkuItemSchema).optional(),
  IsBundle: z.boolean().optional(),
  Packages: z.array(z.any()).optional(),
}).passthrough();

export const XboxDisplaySkuAvailabilitySchema = z.object({
  Sku: z.object({
    SkuId: z.string().optional(),
    SkuType: z.string().optional(),
    Properties: XboxSkuPropertiesSchema.optional(),
  }).optional(),
  Availabilities: z.array(XboxAvailabilitySchema).optional(),
  HistoricalBestAvailabilities: z.array(XboxAvailabilitySchema).optional(),
});

export const XboxRelatedProductSchema = z.object({
  RelatedProductId: z.string(),
  RelationshipType: z.string(),
});

export const XboxMarketPropertySchema = z.object({
  OriginalReleaseDate: z.string().optional(),
  ReleaseDate: z.string().optional(),
  RelatedProducts: z.array(XboxRelatedProductSchema).optional(),
  UsageData: z.array(z.any()).optional(),
}).passthrough();

export const XboxPropertiesSchema = z.object({
  Category: z.string().optional(),
  Categories: z.array(z.string()).optional(),
  Attributes: z.array(z.object({ Name: z.string() })).optional(),
  Capabilities: z.array(z.string()).optional(),
  OriginalReleaseDate: z.string().optional(),
  PackageFamilyName: z.string().optional(),
  ProductGroupId: z.string().optional(),
  ProductGroupName: z.string().optional(),
}).passthrough();

export const XboxProductRawSchema = z.object({
  ProductId: z.string(),
  ProductType: z.string().default("Game"),
  ProductFamily: z.string().optional(),
  LocalizedProperties: z.array(XboxLocalizedPropertySchema).optional(),
  MarketProperties: z.array(XboxMarketPropertySchema).optional(),
  Properties: XboxPropertiesSchema.optional(),
  DisplaySkuAvailabilities: z.array(XboxDisplaySkuAvailabilitySchema).optional(),
});

export const XboxCatalogResponseSchema = z.object({
  Products: z.array(XboxProductRawSchema).default([]),
});

export type XboxProductRaw = z.infer<typeof XboxProductRawSchema>;
export type XboxCatalogResponse = z.infer<typeof XboxCatalogResponseSchema>;
