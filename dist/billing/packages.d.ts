export type CreditPackage = {
    id: string;
    name: string;
    credits: number;
    price: string;
    highlight: boolean;
    polarProductId?: string;
};
export declare const creditPackages: CreditPackage[];
export declare function getCreditPackage(packageId: string): CreditPackage | undefined;
export declare function isSandboxCheckout(): boolean;
export declare function isCheckoutConfigured(productId?: string): boolean;
export declare function getPublicCreditPackages(): {
    checkoutAvailable: boolean;
    id: string;
    name: string;
    credits: number;
    price: string;
    highlight: boolean;
}[];
