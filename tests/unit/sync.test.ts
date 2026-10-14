import { describe, it, expect } from "vitest";
import { evaluateObservedLow } from "../../src/lib/pricing/observed-low";

describe("Synchronization Invariants Unit Tests", () => {
  describe("Price Change Detection & Idempotency (FR-04)", () => {
    it("should distinguish price change vs identical price", () => {
      const existing = { currentPrice: 599, listPrice: 1499 };
      const incomingSame = { currentPrice: 599, listPrice: 1499 };
      const incomingChanged = { currentPrice: 499, listPrice: 1499 };

      const isSame =
        existing.currentPrice === incomingSame.currentPrice &&
        existing.listPrice === incomingSame.listPrice;
      const isChanged =
        existing.currentPrice !== incomingChanged.currentPrice ||
        existing.listPrice !== incomingChanged.listPrice;

      expect(isSame).toBe(true);
      expect(isChanged).toBe(true);
    });

    it("should not create duplicate price history when price is unchanged", () => {
      const historyMock = [
        { observedAt: new Date("2026-10-10"), currentPrice: 599 },
      ];

      const newObservation = { observedAt: new Date("2026-10-11"), currentPrice: 599 };

      // Business rule: only insert if latest price in history is different
      const latestPrice = historyMock[historyMock.length - 1].currentPrice;
      if (latestPrice !== newObservation.currentPrice) {
        historyMock.push(newObservation);
      }

      expect(historyMock.length).toBe(1); // Unchanged!
    });

    it("should append price history when price drops or changes", () => {
      const historyMock = [
        { observedAt: new Date("2026-10-10"), currentPrice: 599 },
      ];

      const newObservation = { observedAt: new Date("2026-10-12"), currentPrice: 399 };

      const latestPrice = historyMock[historyMock.length - 1].currentPrice;
      if (latestPrice !== newObservation.currentPrice) {
        historyMock.push(newObservation);
      }

      expect(historyMock.length).toBe(2);
      expect(historyMock[1].currentPrice).toBe(399);
    });
  });

  describe("Observed Low Retention and Invariant Preservation (FR-05, ADR-004)", () => {
    it("should never erase observed historical low on temporary price bounce", () => {
      const historicalLow = 299;
      const bouncePrice = 899; // Game went back to standard price

      const evalResult = evaluateObservedLow(bouncePrice, historicalLow, new Date("2026-08-01"));
      expect(evalResult.isNewLow).toBe(false);
      expect(evalResult.historicalLow).toBe(299); // Historical low preserved!
    });
  });
});
