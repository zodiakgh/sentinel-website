import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

type SoftwareRow = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  website_url: string;
  source_url: string;
  repository_host: string | null;
  license_name: string;
  spdx_id: string;
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim().slice(0, 100);
  const category = (searchParams.get("category") ?? "").trim().slice(0, 80);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 24), 1), 50);

  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = (env as { DB: D1Database }).DB;

    let sql = `
      SELECT s.id, s.slug, s.name, s.summary, s.website_url, s.source_url,
             s.repository_host, l.name AS license_name, l.spdx_id
      FROM software s
      INNER JOIN licenses l ON l.id = s.license_id
      WHERE s.verification_status = 'approved'
        AND s.free_to_use_verified = 1
        AND s.license_verified = 1
        AND s.archived = 0
    `;
    const values: string[] = [];

    if (query) {
      sql += " AND (s.name LIKE ? OR s.summary LIKE ? OR s.description LIKE ?)";
      const term = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
      values.push(term, term, term);
    }
    if (category) {
      sql += " AND EXISTS (SELECT 1 FROM software_categories sc JOIN categories c ON c.id = sc.category_id WHERE sc.software_id = s.id AND c.slug = ?)";
      values.push(category);
    }
    sql += " ORDER BY s.name COLLATE NOCASE LIMIT ?";
    const rows = await db.prepare(sql).bind(...values, limit).all<SoftwareRow>();

    return NextResponse.json({ items: rows.results ?? [], count: rows.results?.length ?? 0 });
  } catch {
    return NextResponse.json({ error: "Catalog temporarily unavailable." }, { status: 503 });
  }
}
