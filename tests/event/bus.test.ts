import {describe, expect, test} from "@jest/globals";
import {callEvent, registerEventHandler} from "@nsm/event/bus";

describe('Test Event Bus', () => {
    test('Test catches event', async () => {
        const results = [];
        registerEventHandler('nsm:test:1', (value) => {
            results.push(value);
        });
        await callEvent('nsm:test:1', "testValue");
        expect(results.length).toBe(1);
        expect(results[0]).toBe("testValue");
    });
});