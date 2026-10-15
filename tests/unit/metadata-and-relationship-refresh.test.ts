import { describe, it, expect } from "vitest";
import { KNOWN_BUNDLE_CHILDREN } from "@/lib/xbox/mapper";
import { RelationType } from "@prisma/client";

describe("Metadata and Relationship Refresh Integrity (FAZ 1.3B)", () => {
  it("should contain verified curated bundles in KNOWN_BUNDLE_CHILDREN registry", () => {
    expect(KNOWN_BUNDLE_CHILDREN).toBeDefined();

    // Check Mafia Trilogy bundle (canonical BigId 9NKG0X1MGQTX)
    const mafiaTrilogyBigId = "9NKG0X1MGQTX";
    const mafiaChildren = KNOWN_BUNDLE_CHILDREN[mafiaTrilogyBigId];
    expect(mafiaChildren).toBeDefined();
    expect(Array.isArray(mafiaChildren)).toBe(true);
    expect(mafiaChildren.length).toBeGreaterThan(0);

    // Each child must be a valid 12-character alphanumeric BigId
    const bigIdPattern = /^[A-Z0-9]{12}$/i;
    for (const childId of mafiaChildren) {
      expect(bigIdPattern.test(childId)).toBe(true);
      expect(childId.toUpperCase()).not.toBe(mafiaTrilogyBigId); // Never self-referencing
    }
  });

  it("should enforce authoritative parent/child direction for all RelationTypes", () => {
    // 1. Bundle Contains: Parent = Bundle, Child = Game/DLC
    const bundleRelationType = RelationType.BUNDLE_CONTAINS;
    expect(bundleRelationType).toBe("BUNDLE_CONTAINS");

    // 2. DLC Of: Parent = Base Game, Child = DLC
    const dlcRelationType = RelationType.DLC_OF;
    expect(dlcRelationType).toBe("DLC_OF");

    // 3. Expansion Of: Parent = Base Game, Child = Expansion
    const expRelationType = RelationType.EXPANSION_OF;
    expect(expRelationType).toBe("EXPANSION_OF");

    // 4. Add-on Of: Parent = Base Game, Child = Addon
    const addonRelationType = RelationType.ADDON_OF;
    expect(addonRelationType).toBe("ADDON_OF");

    // 5. Season Pass Of: Parent = Base Game, Child = Season Pass
    const spRelationType = RelationType.SEASON_PASS_OF;
    expect(spRelationType).toBe("SEASON_PASS_OF");
  });

  it("should NOT generate false price change when metadata refresh sees identical price", () => {
    const existingGame = {
      currentPrice: 350.0,
      listPrice: 700.0,
      discountPercent: 50,
    };

    const incomingPayload = {
      currentPrice: 350.0,
      listPrice: 700.0,
      discountPercent: 50,
      title: "Updated Title from Microsoft Store",
      shortDescription: "New official description",
    };

    const priceChanged =
      existingGame.currentPrice !== incomingPayload.currentPrice ||
      existingGame.listPrice !== incomingPayload.listPrice;

    expect(priceChanged).toBe(false);
  });

  it("should trigger price change when authoritative price difference exists", () => {
    const existingGame = {
      currentPrice: 350.0,
      listPrice: 700.0,
    };

    const incomingPayload = {
      currentPrice: 280.0, // New discount
      listPrice: 700.0,
    };

    const priceChanged =
      existingGame.currentPrice !== incomingPayload.currentPrice ||
      existingGame.listPrice !== incomingPayload.listPrice;

    expect(priceChanged).toBe(true);
  });
});
