import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Campusmarkt",
    short_name: "Campusmarkt",
    description: "Voorspellingsmarkt met speelpunten voor studenten",
    start_url: "/",
    display: "standalone",
    background_color: "#031b38",
    theme_color: "#031b38",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
