import { z } from "zod";

export const XboxImageSchema = z.object({
  ImagePurpose: z.string().optional(),
  Uri: z.string().optional(),
  Height: z.number().optional(),
  Width: z.number().optional(),
});

export const XboxLocalizedPropertySchema = z.object({
  ProductTitle: z.string().default("İsimsiz Oyun"),
  PublisherName: z.string().optional(),
  DeveloperName: z.string().optional(),
  ShortDescription: z.string().optional(),
  Images: z.array(XboxImageSchema).optional(),
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

export const XboxDisplaySkuAvailabilitySchema = z.object({
  Sku: z.object({
    SkuId: z.string().optional(),
    SkuType: z.string().optional(),
  }).optional(),
  Availabilities: z.array(XboxAvailabilitySchema).optional(),
});

export const XboxProductRawSchema = z.object({
  ProductId: z.string(),
  ProductType: z.string().default("Game"),
  LocalizedProperties: z.array(XboxLocalizedPropertySchema).optional(),
  DisplaySkuAvailabilities: z.array(XboxDisplaySkuAvailabilitySchema).optional(),
});

export const XboxCatalogResponseSchema = z.object({
  Products: z.array(XboxProductRawSchema).default([]),
});

export type XboxProductRaw = z.infer<typeof XboxProductRawSchema>;
export type XboxCatalogResponse = z.infer<typeof XboxCatalogResponseSchema>;
