import { canUseHostControls, isValidHostToken } from "@/lib/host/access";

describe("host access", () => {
  it("validates only matching non-empty host tokens", () => {
    expect(isValidHostToken({ providedToken: "demo-host", expectedToken: "demo-host" })).toBe(true);
    expect(isValidHostToken({ providedToken: "wrong", expectedToken: "demo-host" })).toBe(false);
    expect(isValidHostToken({ providedToken: "", expectedToken: "demo-host" })).toBe(false);
    expect(isValidHostToken({ providedToken: "demo-host", expectedToken: "" })).toBe(false);
  });

  it("enables host controls only when the route has already resolved host access", () => {
    expect(canUseHostControls({ hostAccessEnabled: true })).toBe(true);
    expect(canUseHostControls({ hostAccessEnabled: false })).toBe(false);
  });
});
