import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://workplix.app";

  return [
    { url: baseUrl, priority: 1 },
    { url: `${baseUrl}/signup`, priority: 0.8 },
    { url: `${baseUrl}/login`, priority: 0.5 },
  ];
}
