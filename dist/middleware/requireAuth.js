export function requireAuth(req, res, next) {
    const sessionCookie = req.signedCookies.workos_session;
    if (!sessionCookie) {
        res.status(401).json({ error: "Not authenticated" });
        return;
    }
    try {
        const session = JSON.parse(sessionCookie);
        if (!session.user?.id) {
            res.status(401).json({ error: "Invalid session" });
            return;
        }
        req.session = session;
        next();
    }
    catch {
        res.status(401).json({ error: "Invalid session" });
    }
}
