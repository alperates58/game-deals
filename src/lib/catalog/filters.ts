/**
 * Helper to build Prisma filters for release date (yapım yılı) and platforms.
 */

export interface ReleaseDateFilter {
  gte?: Date;
  lte?: Date;
  lt?: Date;
}

export function buildReleaseDateFilter(year?: string): ReleaseDateFilter | undefined {
  if (!year || year === "all") return undefined;

  // 2024 and newer
  if (year === "2024" || year === "2024+") {
    return { gte: new Date("2024-01-01T00:00:00.000Z") };
  }

  // 2022 - 2023
  if (year === "2022-2023") {
    return {
      gte: new Date("2022-01-01T00:00:00.000Z"),
      lte: new Date("2023-12-31T23:59:59.999Z"),
    };
  }

  // 2020 - 2021
  if (year === "2020-2021") {
    return {
      gte: new Date("2020-01-01T00:00:00.000Z"),
      lte: new Date("2021-12-31T23:59:59.999Z"),
    };
  }

  // Prior to 2020 (2019 and older)
  if (year === "pre2020" || year === "<2020" || year === "2019-pre") {
    return { lt: new Date("2020-01-01T00:00:00.000Z") };
  }

  // Exact 4-digit year query
  if (/^\d{4}$/.test(year)) {
    const y = parseInt(year, 10);
    return {
      gte: new Date(`${y}-01-01T00:00:00.000Z`),
      lte: new Date(`${y}-12-31T23:59:59.999Z`),
    };
  }

  return undefined;
}
