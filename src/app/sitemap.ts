import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
 const base = "https://sentineldashboard.site";
 return [{url:base,changeFrequency:"weekly",priority:1},{url:base+"/privacy",changeFrequency:"monthly",priority:.5},{url:base+"/terms",changeFrequency:"monthly",priority:.5}];
}