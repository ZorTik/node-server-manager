import server from "../../server";
import boot from "../../app";
import request from "supertest";
import {afterAll, beforeAll, describe, expect, test} from "@jest/globals";

function expectProps(obj: any, model: string[]) {
    for (const key of model) {
        expect(obj).toHaveProperty(key);
    }
}

describe("Test v1 API", () => {
    beforeAll(async () => {
        await boot(server, { test: true });
    }, 20000);

    test("Test /v1/status", async () => {
        const res = await request(server).get("/v1/status");
        expect(res.status).toBe(200);
        expectProps(res.body, ['nodeId', 'running', 'all', 'system.totalmem', 'system.freemem', 'system.totaldisk', 'system.freedisk']);
    });

    test("Test /v1/status?stats=true", async () => {
        const res = await request(server).get("/v1/status?stats=true");
        expect(res.status).toBe(200);
        expectProps(res.body, [
            'stats.memory.used',
            'stats.memory.total',
            'stats.memory.percent',
            'stats.cpu.used',
            'stats.cpu.total',
            'stats.cpu.percent',
            'stats.services.memTotal',
            'stats.services.cpuTotal',
            'stats.services.diskTotal',
        ]);
    });
});