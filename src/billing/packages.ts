export type CreditPackage = {
  id: string;
  name: string;
  credits: number;
  price: string;
  highlight: boolean;
  polarProductId?: string;
};

export const creditPackages: CreditPackage[] = [
  {
    id: "starter",
    name: "Starter",
    credits: 100,
    price: "$5.00",
    highlight: false,
    polarProductId: process.env.POLAR_STARTER_PRODUCT_ID,
  },
  {
    id: "plus",
    name: "Plus",
    credits: 500,
    price: "$20.00",
    highlight: true,
    polarProductId: process.env.POLAR_PLUS_PRODUCT_ID,
  },
  {
    id: "pro",
    name: "Pro",
    credits: 1_200,
    price: "$40.00",
    highlight: false,
    polarProductId: process.env.POLAR_PRO_PRODUCT_ID,
  },
];

export function getCreditPackage(packageId: string) {
  return creditPackages.find((creditPackage) => creditPackage.id === packageId);
}

export function getPublicCreditPackages() {
  const hasAccessToken = Boolean(process.env.POLAR_ACCESS_TOKEN);
  const checkoutEnabled = process.env.POLAR_CHECKOUT_ENABLED === "true";

  return creditPackages.map(({ polarProductId, ...creditPackage }) => ({
    ...creditPackage,
    checkoutAvailable:
      checkoutEnabled && hasAccessToken && Boolean(polarProductId),
  }));
}
