export type AuthPrincipal = {
  userId: string;
  sessionId: string;
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPrincipal;
    }
  }
}

