import type { Router as RouterType } from "express";
declare global {
    namespace Express {
        interface Request {
            session?: {
                user?: {
                    id: string;
                    email: string;
                    firstName: string | null;
                    lastName: string | null;
                    profilePictureUrl: string | null;
                };
                accessToken?: string;
                refreshToken?: string;
                sessionId?: string;
            };
        }
    }
}
export declare const authRouter: RouterType;
