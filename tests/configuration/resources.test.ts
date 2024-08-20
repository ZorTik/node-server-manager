import {expect, test} from "@jest/globals";
import {readResource} from "../../configuration/resources";
import * as fs from "fs";

test('Reads the resource', () => {
    expect(readResource('template/example/example_settings.yml')).toBe(fs.readFileSync(process.cwd() + '/resources/template/example/example_settings.yml', 'utf8'));
});