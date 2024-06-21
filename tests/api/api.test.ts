import server from "../../server";
import boot from "../../app";
import request from "supertest";
import {beforeAll, describe, expect, test} from "@jest/globals";

function expectProps(obj: any, model: any[]) {
    for (let i = 0; i < model.length; i += 2) {
        if (model[i + 1]) {
            expect(obj).toHaveProperty(model[i], model[i + 1]);
        } else {
            expect(obj).toHaveProperty(model[i]);
        }
    }
}

describe("Test v1 API", () => {
    beforeAll(async () => {
        await boot(server, { test: true });
    }, 20000);

    test("Test /v1/status", async () => {
        const res = await request(server).get("/v1/status");
        expect(res.status).toBe(200);
        expectProps(res.body, [
            'nodeId', undefined,
            'running', undefined,
            'all', undefined,
            'system.totalmem', undefined,
            'system.freemem', undefined,
            'system.totaldisk', undefined,
            'system.freedisk', undefined,
        ]);
    });

    test("Test /v1/status?stats=true", async () => {
        const res = await request(server).get("/v1/status?stats=true");
        expect(res.status).toBe(200);
        expectProps(res.body, [
            'stats.memory.used', undefined,
            'stats.memory.total', undefined,
            'stats.memory.percent', undefined,
            'stats.cpu.used', undefined,
            'stats.cpu.total', undefined,
            'stats.cpu.percent', undefined,
            'stats.services.memTotal', undefined,
            'stats.services.cpuTotal', undefined,
            'stats.services.diskTotal', undefined,
        ]);
    });

    test("Test /v1/servicelist", async () => {
        const res = await request(server)
            .post("/v1/servicelist")
            .send({ page: 0, pageSize: 10 });
        expect(res.status).toBe(200);
        expectProps(res.body, [
            'services', undefined,
            'meta.page', 0,
            'meta.pageSize', 10,
            'meta.total', 0,
        ]);
    });

    // TODO: Add missing API tests
});