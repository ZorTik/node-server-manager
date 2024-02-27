import {expect, test} from "@jest/globals";
import {readResource} from "../../configuration/resources";
import * as fs from "fs";

test('Reads the resource', () => {
    expect(readResource('example_settings.yml')).toBe(fs.readFileSync(process.cwd() + '/resources/example_settings.yml', 'utf8'));
});