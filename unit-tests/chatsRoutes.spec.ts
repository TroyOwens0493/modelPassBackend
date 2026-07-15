import { createHmac } from "node:crypto";
import cookieParser from "cookie-parser";
import express from "express";
import { ObjectId } from "mongodb";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/modelpass-test";
process.env.OPEN_ROUTER_API_KEY ??= "test-openrouter-key";

const mocks = vi.hoisted(() => ({
    insertOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    find: vi.fn(),
    project: vi.fn(),
    sort: vi.fn(),
    toArray: vi.fn(),
}));

vi.mock("../src/routes/chats/model.js", () => ({
    chatsCollection: () => ({
        insertOne: mocks.insertOne,
        findOneAndUpdate: mocks.findOneAndUpdate,
        find: mocks.find,
    }),
}));

const cookieSecret = "test_cookie_password_at_least_32_characters";
const chatId = new ObjectId("507f1f77bcf86cd799439011");
let app: express.Express;

beforeAll(async () => {
    const [{ chatsRouter }, { requireAuth }] = await Promise.all([
        import("../src/routes/chats/chats.js"),
        import("../src/middleware/requireAuth.js"),
    ]);

    app = express();
    app.use(express.json());
    app.use(cookieParser(cookieSecret));
    app.use("/chats", requireAuth, chatsRouter);
});

beforeEach(() => {
    vi.clearAllMocks();
    mocks.insertOne.mockResolvedValue({ insertedId: chatId });
    mocks.find.mockReturnValue({ project: mocks.project });
    mocks.project.mockReturnValue({ sort: mocks.sort });
    mocks.sort.mockReturnValue({ toArray: mocks.toArray });
    mocks.toArray.mockResolvedValue([]);
});

function sessionCookie(userId = "user_123") {
    const value = JSON.stringify({
        user: { id: userId, email: `${userId}@example.com` },
    });
    const signature = createHmac("sha256", cookieSecret)
        .update(value)
        .digest("base64")
        .replace(/=+$/, "");

    return `workos_session=${encodeURIComponent(`s:${value}.${signature}`)}`;
}

function completedMessages() {
    return [
        {
            role: "user",
            text: "Hello",
            timestamp: "2026-07-15T12:00:00.000Z",
        },
        {
            role: "model",
            text: "Hi there",
            timestamp: "2026-07-15T12:00:01.000Z",
        },
    ];
}

describe("chat persistence routes", () => {
    it("requires authentication", async () => {
        const response = await request(app).post("/chats").send({
            title: "Hello",
            model: "openai/gpt-4o-mini",
            messages: completedMessages(),
        });

        expect(response.status).toBe(401);
        expect(mocks.insertOne).not.toHaveBeenCalled();
    });

    it("creates a completed chat owned by the session user", async () => {
        const response = await request(app)
            .post("/chats")
            .set("Cookie", sessionCookie())
            .send({
                title: " Hello ",
                model: "openai/gpt-4o-mini",
                messages: completedMessages(),
                userId: "attacker",
            });

        expect(response.status).toBe(201);
        expect(response.body._id).toBe(chatId.toHexString());
        expect(mocks.insertOne).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: "user_123",
                title: "Hello",
                model: "openai/gpt-4o-mini",
                messages: [
                    expect.objectContaining({
                        role: "user",
                        timestamp: new Date("2026-07-15T12:00:00.000Z"),
                    }),
                    expect.objectContaining({
                        role: "model",
                        timestamp: new Date("2026-07-15T12:00:01.000Z"),
                    }),
                ],
            }),
        );
    });

    it("rejects invalid completed messages", async () => {
        const response = await request(app)
            .post("/chats")
            .set("Cookie", sessionCookie())
            .send({
                title: "Hello",
                model: "openai/gpt-4o-mini",
                messages: [{ role: "model", text: "", timestamp: "not-a-date" }],
            });

        expect(response.status).toBe(400);
        expect(mocks.insertOne).not.toHaveBeenCalled();
    });

    it("updates the completed history using an owner-scoped filter", async () => {
        const updatedChat = {
            _id: chatId,
            userId: "user_123",
            messages: completedMessages(),
        };
        mocks.findOneAndUpdate.mockResolvedValue(updatedChat);

        const response = await request(app)
            .put(`/chats/${chatId.toHexString()}`)
            .set("Cookie", sessionCookie())
            .send({ messages: completedMessages() });

        expect(response.status).toBe(200);
        expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
            { _id: chatId, userId: "user_123" },
            {
                $set: {
                    messages: expect.any(Array),
                    updatedAt: expect.any(Date),
                },
            },
            { returnDocument: "after" },
        );
    });

    it("does not expose a chat missing from the owner's scope", async () => {
        mocks.findOneAndUpdate.mockResolvedValue(null);

        const response = await request(app)
            .put(`/chats/${chatId.toHexString()}`)
            .set("Cookie", sessionCookie("different_user"))
            .send({ messages: completedMessages() });

        expect(response.status).toBe(404);
    });

    it("lists owned chats newest first", async () => {
        mocks.toArray.mockResolvedValue([
            {
                _id: chatId,
                title: "Newest chat",
                updatedAt: new Date("2026-07-15T13:00:00.000Z"),
            },
        ]);

        const response = await request(app)
            .get("/chats/all/user_123")
            .set("Cookie", sessionCookie());

        expect(response.status).toBe(200);
        expect(response.body).toEqual([
            expect.objectContaining({
                _id: chatId.toHexString(),
                title: "Newest chat",
            }),
        ]);
        expect(mocks.find).toHaveBeenCalledWith({ userId: "user_123" });
        expect(mocks.sort).toHaveBeenCalledWith({ updatedAt: -1 });
    });
});
