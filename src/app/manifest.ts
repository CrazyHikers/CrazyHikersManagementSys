import type { MetadataRoute } from "next";

// Web App Manifest — required so that browsers (especially iOS Safari) treat
// the site as installable. Web Push on iOS only works once the user has
// installed the site to their home screen via Share → Add to Home Screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Crazy Hikers",
    short_name: "Crazy Hikers",
    description: "Crazy Hikers club activity management",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#16a34a",
    icons: [
      {
        src: "/icon.png",
        sizes: "any",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
