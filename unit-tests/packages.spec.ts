import { beforeAll, describe, expect, it } from "vitest";

process.env.POLAR_SERVER = "sandbox";
process.env.POLAR_ACCESS_TOKEN = "sandbox-token";
process.env.POLAR_STARTER_PRODUCT_ID = "starter-product";
process.env.POLAR_PLUS_PRODUCT_ID = "plus-product";
process.env.POLAR_PRO_PRODUCT_ID = "pro-product";

let packages: typeof import("../src/billing/packages.js");

beforeAll(async () => {
  packages = await import("../src/billing/packages.js");
});

describe("credit packages", () => {
  it("maps Polar product IDs to app credit amounts", () => {
    expect(
      packages.getCreditPackageByPolarProductId("plus-product"),
    ).toMatchObject({
      id: "plus",
      credits: 500,
    });
  });

  it("does not expose Polar product IDs to the frontend", () => {
    const publicPackages = packages.getPublicCreditPackages();

    expect(publicPackages).toHaveLength(3);
    expect(publicPackages[0]).not.toHaveProperty("polarProductId");
    expect(publicPackages.every((item) => item.checkoutAvailable)).toBe(true);
  });

  it("rejects unknown products", () => {
    expect(
      packages.getCreditPackageByPolarProductId("unknown-product"),
    ).toBeUndefined();
  });
});
