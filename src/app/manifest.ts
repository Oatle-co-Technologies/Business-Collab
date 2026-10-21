import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
 return {
  id: "/", name: "Business Collab", short_name: "Business Collab",
  description: "Find local businesses and collaborate on client projects.",
  lang: "en-ZA", start_url: "/", scope: "/", display: "standalone",
  background_color: "#fafafa", theme_color: "#171717",
  icons: [
   { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
   { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
   { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
 };
}
