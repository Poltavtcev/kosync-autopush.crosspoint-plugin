import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";

test("kosync-autopush manifest, device, and plugin validate cleanly", async () => {
  const dir = "/Volumes/myData/Projects/Reading/modules/kosync-autopush.crosspoint-plugin/kosync-autopush.crosspoint-plugin";
  
  // 1. Manifest validation
  const manifest = JSON.parse(readFileSync(`${dir}/manifest.json`, "utf8"));
  expect(manifest.name).toBe("kosync-autopush");
  expect(manifest.version).toBe("0.1.0");

  // 2. Device schema validation
  const device = JSON.parse(readFileSync(`${dir}/device.json`, "utf8"));
  expect(device.title).toBe("KOSync Auto-push");
  expect(device.events["reader.session"].request.url).toContain("{cfg.sync_url}");

  // 3. Plugin registration & syntax validation
  const pluginCode = readFileSync(`${dir}/plugin.js`, "utf8");
  expect(pluginCode).toContain("CrossPoint.registerPlugin");
  expect(pluginCode).toContain("Calibre-Web Automated");

  // Run mock plugin execution
  let registeredFn: any = null;
  (globalThis as any).CrossPoint = {
    registerPlugin: (fn: any) => { registeredFn = fn; }
  };
  (globalThis as any).document = {
    createElement: (tag: string) => ({
      tag,
      children: [] as any[],
      style: {},
      append(...c: any[]) { this.children.push(...c); },
      replaceChildren(...c: any[]) { this.children = c; }
    })
  };
  (globalThis as any).fetch = async () => ({ ok: false });
  (globalThis as any).crypto = {
    getRandomValues: (a: any) => a.fill(5)
  };

  eval(pluginCode);
  expect(typeof registeredFn).toBe("function");
});
