import server from "@nsm/server";
import {init as boot, AppBootContext, AppBootOptions} from "@nsm/app";
import request from "supertest";
import {afterAll, beforeAll, describe, expect, test} from "@jest/globals";
import {isServicePending} from "@nsm/engine/asyncp";
import {log} from "console";

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
    const id = await ctx.manager.createService("test", {});
    do {
        await new Promise((resolve) => {
            setTimeout(() => resolve(null), 300);
        });
    } while (isServicePending(id));
    // Status check
    if (ctx.manager.getLastPowerError(id)) {
        return undefined;
    } else {
        return id;
    }
}

async function stopMini(ctx: AppBootContext, id: string) {
    await ctx.manager.stopService(id);
    await ctx.manager.waitForBusyAction(id); // Await stop
}

describe("Test v1 API models", () => {
    let ctx: AppBootContext|undefined = undefined;

    beforeAll((done) => {
        const options: AppBootOptions = {
            test: true,
            disableWorkers: true,
        };
        boot(server, options).then((ctx_) => {
            ctx = ctx_;
            done();
        }).catch(err => {
            console.log(err);
        });
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

    test("Test /v1/status to have service in running", async () => {
        const id = await miniService(ctx);
        const res = await request(server).get("/v1/status");
        expect(res.status).toBe(200);
        expect(res.body.running).toContain(id);
    }, 20000);

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
    }, 20000);

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

    test("Test /v1/servicelist right size", async () => {
        await miniService(ctx);
        await miniService(ctx);
        const res = await request(server)
            .post("/v1/servicelist")
            .send({ page: 0, pageSize: 1 });
        expect(res.status).toBe(200);
        expect(res.body.services).toHaveLength(1);
    });

    test("Test /v1/service/{serviceId}", async () => {
        const id = await miniService(ctx);
        log(id);
        const res = await request(server).get("/v1/service/" + id);
        expect(res.status).toBe(200);
        expectProps(res.body, [
            "id", id,
            "template.id", "test",
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

    test("Test /v1/service/{serviceId}/resume", async () => {
        const id = await miniService(ctx);
        log(id);
        await stopMini(ctx, id);
        const res = await request(server)
            .post("/v1/service/" + id + "/resume");
        expect(res.status).toBe(200);
        expectProps(res.body, [
            "status", 200,
            "message", undefined,
        ]);
    }, 30000);

    // TODO: /v1/service/<id>/resume

    test("Test /v1/service/{serviceId}/stop", async () => {
        const id = await miniService(ctx);
        log(id);
        const res = await request(server)
            .post("/v1/service/" + id + "/stop");
        expect(res.status).toBe(200);
        expectProps(res.body, [
            "status", 200,
            "message", undefined,
        ]);
    }, 20000);

    test("Test /v1/service/{serviceId}/delete", async () => {
        const id = await miniService(ctx);
        log(id);
        const res = await request(server)
            .post("/v1/service/" + id + "/delete");
        expect(res.status).toBe(200);
        expectProps(res.body, [
            "status", 200,
            "message", undefined,
        ]);
    }, 20000);

    test("Test /v1/service/{serviceId}/reboot", async  () => {
        const id = await miniService(ctx);
        log(id);
        const res = await request(server)
            .post("/v1/service/" + id + "/reboot");
        expect(res.status).toBe(200);
        expectProps(res.body, [
            "status", 200,
            "message", undefined,
        ]);
        // Wait for it to be started
        await new Promise((resolve, reject) => {
            ctx.manager.on('resume', (event) => {
                if (event.id == id) {
                    if (event.error) {
                        reject(event.error);
                    } else {
                        resolve(null);
                    }
                    return true;
                }
            });
        });
    }, 20000);

    test("Test /v1/service/{serviceId}/powerstatus", async () => {
        const id = await miniService(ctx);
        log(id);
        const res = await request(server)
            .get("/v1/service/" + id + "/powerstatus");
        expect(res.status).toBe(200);
        expectProps(res.body, [
            "id", id,
            "status", "IDLE",
        ]);
    }, 20000);

    afterAll(() => {
        return ctx.manager.stopRunning();
    }, 60000);

    // TODO: /v1/service/<id>/options
    // TODO: /v1/service/<id>/stopcmd
    // TODO: /v1/service/<id>/stop?force=true

    // TODO: Add missing API tests
});

// TODO: Test v1 API in-depth