import http from "node:http";

const LABEL_PORT = Number(process.env.LABEL_PORT || 8001);
const REFUND_PORT = Number(process.env.REFUND_PORT || 18085);
const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 8000);

const hopByHop = new Set([
  "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
  "te", "trailer", "transfer-encoding", "upgrade"
]);

const server = http.createServer((req, res) => {
  const incoming = new URL(req.url, "http://router.local");
  if (incoming.pathname === "/__refund_router_health") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    res.end(JSON.stringify({ ok: true, labelPort: LABEL_PORT, refundPort: REFUND_PORT }));
    return;
  }
  if (incoming.pathname === "/ai" || incoming.pathname === "/ai/") {
    res.writeHead(302, { location: "/ai/refund-agent.html", "cache-control": "no-store" });
    res.end();
    return;
  }

  const isRefundStatic = incoming.pathname.startsWith("/ai/");
  const isRefundApi = incoming.pathname.startsWith("/api/refund-agent/");
  const targetPort = isRefundStatic || isRefundApi ? REFUND_PORT : LABEL_PORT;
  const targetPath = isRefundStatic ? req.url.replace(/^\/ai/, "") : req.url;
  const headers = { ...req.headers };
  for (const name of hopByHop) delete headers[name];
  headers.host = `127.0.0.1:${targetPort}`;
  headers["x-forwarded-host"] = req.headers.host || "";
  headers["x-forwarded-proto"] = req.headers["x-forwarded-proto"] || "https";
  headers["x-forwarded-for"] = [req.headers["x-forwarded-for"], req.socket.remoteAddress].filter(Boolean).join(", ");
  if (isRefundStatic) headers["x-forwarded-prefix"] = "/ai";

  const upstream = http.request({
    hostname: "127.0.0.1",
    port: targetPort,
    path: targetPath,
    method: req.method,
    headers,
    timeout: 130_000
  }, (upstreamRes) => {
    const responseHeaders = { ...upstreamRes.headers };
    for (const name of hopByHop) delete responseHeaders[name];
    res.writeHead(upstreamRes.statusCode || 502, responseHeaders);
    upstreamRes.pipe(res);
  });

  upstream.on("timeout", () => upstream.destroy(new Error("upstream timeout")));
  upstream.on("error", (error) => {
    if (res.headersSent) return res.destroy(error);
    res.writeHead(502, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    res.end(JSON.stringify({ error: "上游服务暂时不可用。" }));
  });
  req.pipe(upstream);
});

server.requestTimeout = 135_000;
server.headersTimeout = 140_000;
server.listen(PORT, HOST, () => {
  console.log(`refund router listening on http://${HOST}:${PORT}`);
});
