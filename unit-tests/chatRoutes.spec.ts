import { ObjectId } from "mongodb";
import express from "express";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/modelpass-test";
process.env.OPEN_ROUTER_API_KEY ??= "test-openrouter-key";

const mocks = vi.hoisted(() => ({
    insertOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
}));

vi.mock("../src/routes/chats/model.js", () => ({
    chatsCollection: () => mocks,
}));

let app: express.Express;

beforeAll(async () => {
    const { chatsRouter } = await import("../src/routes/chats/chats.js");
    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.session = {
            user: {
                id: "user_123",
                email: "user@example.com",
                firstName: null,
                lastName: null,
                profilePictureUrl: null,
            },
        };
        next();
    });
    app.use("/chats", chatsRouter);
});

beforeEach(() => {
    vi.clearAllMocks();
});

describe("chat routes", () => {
    it("creates an empty chat for the authenticated user", async () => {
        const insertedId = new ObjectId("507f1f77bcf86cd799439011");
        mocks.insertOne.mockResolvedValue({ insertedId });

        const response = await request(app)
            .post("/chats")
            .send({ title: "First prompt", model: "openai/gpt-4o-mini" });

        expect(response.status).toBe(201);
        expect(response.body).toEqual(expect.objectContaining({
            _id: insertedId.toHexString(),
            userId: "user_123",
            title: "First prompt",
            model: "openai/gpt-4o-mini",
            messages: [],
            tokensUsed: 0,
            creditsUsed: 0,
        }));
        expect(mocks.insertOne).toHaveBeenCalledWith(expect.objectContaining({
            userId: "user_123",
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
        }));
    });

    it("assigns a server timestamp when appending a message", async () => {
        const chatId = "507f1f77bcf86cd799439011";
        mocks.findOneAndUpdate.mockResolvedValue({ _id: new ObjectId(chatId) });

        const response = await request(app)
            .post(`/chats/addMessage/${chatId}`)
            .send({
                role: "user",
                text: "Hello",
                timestamp: "2000-01-01T00:00:00.000Z",
            });

        expect(response.status).toBe(200);
        expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
            { _id: new ObjectId(chatId), userId: "user_123" },
            {
                $push: {
                    messages: {
                        role: "user",
                        text: "Hello",
                        timestamp: expect.any(Date),
                    },
                },
                $set: { updatedAt: expect.any(Date) },
            },
            { returnDocument: "after" },
        );
    });
});
