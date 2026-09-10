import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));
vi.mock("@/lib/r2", () => ({ getPublicUrl: (key: string) => `https://images.example/${key}` }));
import { ActivityRecapSection } from "./activity-recap";
import { readPublicActivityRecap } from "@/lib/activity-recap";

it("renders public photos and escaped text, never a private album", async () => {
  const recap = readPublicActivityRecap({
    description: "A great hike <script>alert(1)</script>", albumUrl: "https://private.example/album",
    photoKeys: ["activity-recaps/hike/12345678-1234-1234-1234-123456789012.jpg"],
  }, "hike");
  const html = renderToStaticMarkup(await ActivityRecapSection({ recap }));
  expect(html).toContain("A great hike");
  expect(html).toContain("https://images.example/activity-recaps/");
  expect(html).not.toContain("<script>");
  expect(html).not.toContain("private.example");
});

it("omits an empty public recap", async () => {
  expect(await ActivityRecapSection({ recap: { description: "", photoKeys: [] } })).toBeNull();
});
