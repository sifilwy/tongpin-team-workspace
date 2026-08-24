import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const url = new URL("../dist/server/index.js", import.meta.url);
  url.searchParams.set("test", Date.now());
  const { default: worker } = await import(url.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test("renders the team collaboration workspace", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  for (const label of ["同频工作台", "协作总览", "任务时间线", "总结复盘", "悦悦", "吃吃", "czl", "xzx", "子涵"]) assert.match(html, new RegExp(label));
});
