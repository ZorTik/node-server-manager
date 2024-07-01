import server from "../../server";
import boot, {AppBootContext} from "../../app";
import request from "supertest";
import {beforeAll, describe, expect, test} from "@jest/globals";
import {isServicePending} from "../../engine/asyncp";

function expectProps(obj: any, model: any[]) {
    for (let i = 0; i < model.length; i += 2) {
        if (model[i + 1]) {
            expect(obj).toHaveProperty(model[i], model[i + 1]);
        } else {
            expect(obj).toHaveProperty(model[i]);
        }
    }
}

async function miniService(ctx: AppBootContext) {
    const id = await ctx.engine.createService("test", {});
    do {
        await new Promise((resolve) => {
            setTimeout(() => resolve(null), 300);
        });
    } while (isServicePending(id));
    // Status check
    if (ctx.engine.getLastPowerError(id)) {
        return undefined;
    } else {
        return id;
    }
}

describe("Test v1 API models", () => {
    let ctx: AppBootContext|undefined = undefined;

    beforeAll(async () => {
        ctx = await boot(server, { test: true });
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

    test("Test /v1/service/{serviceId}", async () => {
        const id = await miniService(ctx);
        const res = await request(server).get("/v1/service/" + id);
        expect(res.status).toBe(200);
        expectProps(res.body, [
            "id", undefined,
            "template.id", undefined,
            "template.name", undefined,
            "template.description", undefined,
            "template.settings", undefined,
            "port", undefined,
            "options", undefined,
            "env", undefined,
            "session.serviceId", undefined,
            "session.nodeId", undefined,
            "session.containerId", undefined,
        ]);

    }, 20000);

    // TODO: /v1/service/<id>/resume

    test("Test /v1/service/{serviceId}/stop", async () => {
       const id = await miniService(ctx);
       const res = await request(server).post("/v1/service/" + id + "/stop");
       expect(res.status).toBe(200);
       expectProps(res.body, [
           "status", undefined,
           "message", undefined,
       ]);
    }, 20000);

    test("Test /v1/service/{serviceId}/delete", async () => {
       const id = await miniService(ctx);
       const res = await request(server).post("/v1/service/" + id + "/delete");
       expect(res.status).toBe(200);
       expectProps(res.body, [
           "status", undefined,
           "message", undefined,
       ]);
    }, 20000);

    test("Test /v1/service/{serviceId}/reboot", async  () => {
        const id = await miniService(ctx);
        const res = await request(server).post("/v1/service/" + id + "/reboot");
        expect(res.status).toBe(200);
        expectProps(res.body, [
            "status", undefined,
            "message", undefined,
        ]);
    }, 20000);

    test("Test /v1/service/{serviceId}/powerstatus", async () => {
        const id = await miniService(ctx);
        const res = await request(server).get("/v1/service/" + id + "/powerstatus");
        expect(res.status).toBe(200);
        expectProps(res.body, [
           "id", undefined,
           "status", undefined,
           "error", undefined,
        ]);
    }, 20000);

    // TODO: /v1/service/<id>/options

    // TODO: Add missing API tests
});

// TODO: Test v1 API in-depth