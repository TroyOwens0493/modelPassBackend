export const creditPackages = [
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
export function getCreditPackage(packageId) {
    return creditPackages.find((creditPackage) => creditPackage.id === packageId);
}
export function isSandboxCheckout() {
    return process.env.POLAR_SERVER !== "production";
}
export function isCheckoutConfigured(productId) {
    const hasCredentials = Boolean(process.env.POLAR_ACCESS_TOKEN && productId);
    const hasSafeFulfillment = isSandboxCheckout() || Boolean(process.env.POLAR_WEBHOOK_SECRET);
    return hasCredentials && hasSafeFulfillment;
}
export function getPublicCreditPackages() {
    return creditPackages.map(({ polarProductId, ...creditPackage }) => ({
        ...creditPackage,
        checkoutAvailable: isCheckoutConfigured(polarProductId),
    }));
}
