import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
 return { rules: [{ userAgent: "*", allow: ["/", "/privacy", "/terms", "/mentions-legales"], disallow: ["/dashboard", "/dashboard/", "/login", "/signup"] }], sitemap: "https://sentineldashboard.site/sitemap.xml", host: "https://sentineldashboard.site" };
}