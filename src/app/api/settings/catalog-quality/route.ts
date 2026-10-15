import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/session";
import { getCatalogQualityReport, getQualityIssueItems, QualityIssueType } from "@/lib/catalog/catalog-quality";

export async function GET(req: Request) {
  try {
    await requireOwner();
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Giriş yapmanız gerekmektedir." }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Bu endpoint yalnızca sistem yöneticisi (OWNER) tarafından görüntülenebilir." },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const issue = searchParams.get("issue") as QualityIssueType | null;
    const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 200);
    const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

    if (issue) {
      const drillDown = await getQualityIssueItems(issue, limit, offset);
      return NextResponse.json({
        success: true,
        issue,
        total: drillDown.total,
        limit,
        offset,
        items: drillDown.items,
      });
    }

    const report = await getCatalogQualityReport();
    return NextResponse.json({
      success: true,
      report,
    });
  } catch (err: any) {
    console.error("[CatalogQuality API Error]", err);
    return NextResponse.json({ error: "Katalog kalite raporu hesaplanamadı." }, { status: 500 });
  }
}
