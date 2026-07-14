import { Db, MongoClient } from "mongodb";
export declare const mongoClient: MongoClient;
export declare function connectDb(): Promise<Db>;
export declare function db(): Db;
