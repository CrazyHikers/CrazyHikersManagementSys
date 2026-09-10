import { describe, expect, it } from "vitest";
import { canEditActivityRecap, parseActivityRecap, readActivityRecap } from "./activity-recap";

const recap = { description: "A good hike", albumUrl: "https://photos.example/album", photoKeys: ["activity-recaps/hike/12345678-1234-1234-1234-123456789012.jpg"] };

describe("activity recap boundaries", () => {
  it("keeps the album URL out of public recap data", () => {
    expect(readActivityRecap({ recap }, "hike")).toEqual({ description: recap.description, photoKeys: recap.photoKeys });
  });
  it("accepts clearing all optional fields", () => {
    expect(parseActivityRecap({ description: "", albumUrl: "", photoKeys: [] }, "hike")).toBeTruthy();
  });
  it.each(["javascript:alert(1)", "http://photos.example", "https://user:password@photos.example", "not-a-url"])("rejects unsafe or invalid album URL %s", (albumUrl) => {
    expect(parseActivityRecap({ ...recap, albumUrl }, "hike")).toBeNull();
  });
  it("rejects photos belonging to another activity and excessive input", () => {
    expect(parseActivityRecap(recap, "other")).toBeNull();
    expect(parseActivityRecap({ ...recap, photoKeys: Array(13).fill(recap.photoKeys[0]) }, "hike")).toBeNull();
    expect(parseActivityRecap({ ...recap, description: "a".repeat(5001) }, "hike")).toBeNull();
  });
  it("allows only confirmed leaders or administrators to edit", () => {
    const managers = [{ userEmail: "guide@example.com", status: "confirmed", role: "comanager" }];
    expect(canEditActivityRecap({ email: "guide@example.com", role: "manager" }, managers)).toBe(true);
    expect(canEditActivityRecap({ email: "other@example.com", role: "manager" }, managers)).toBe(false);
    expect(canEditActivityRecap({ email: "guide@example.com", role: "member" }, managers)).toBe(false);
    expect(canEditActivityRecap({ email: "guide@example.com", role: "manager" }, [{ ...managers[0], status: "invited" }])).toBe(false);
    expect(canEditActivityRecap({ email: "admin@example.com", role: "admin" }, [])).toBe(true);
  });
});
