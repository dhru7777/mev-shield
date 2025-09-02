

export interface Env {
  TXKV: any; // KVNamespace
  FLASHBOTS_RPC: string;
  BLOX_PROTECT: string;
  EDEN_RPC: string;
  READ_RPC: string;
  // Testnet configurations
  SEPOLIA_READ_RPC: string;
  GOERLI_READ_RPC: string;
  HOLESKY_READ_RPC: string;
}

const WRITE_METHODS = new Set(["eth_sendRawTransaction"]);

// Testnet configurations
const TESTNET_CONFIGS = {
  sepolia: {
    chainId: "0xaa36a7", // 11155111
    name: "Sepolia"
  },
  goerli: {
    chainId: "0x5", // 5
    name: "Goerli"
  },
  holesky: {
    chainId: "0x4268", // 17000
    name: "Holesky"
  }
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // Health check
    if (url.pathname === "/") {
      return json({ ok: true, name: "mev-shield", time: new Date().toISOString() }, 200, {
        "Access-Control-Allow-Origin": "*",
      });
    }

    // Simple status endpoint (optional for demos)
    if (url.pathname.startsWith("/status/")) {
      const id = url.pathname.split("/").pop()!;
      const rec = await env.TXKV.get(`tx:${id}`, "json");
      return rec ? json(rec, 200, { "Access-Control-Allow-Origin": "*" }) : new Response("Not found", { status: 404 });
    }

    // JSON-RPC proxy - support both mainnet and testnet
    if (url.pathname === "/rpc" && req.method === "POST") {
      const body = await req.json().catch(() => null);
      if (!body || typeof body !== "object") return json({ error: "invalid_json" }, 400, { "Access-Control-Allow-Origin": "*" });

      // Batch or single
      if (Array.isArray(body)) {
        const out = await Promise.all(body.map((call) => handleRpc(call, env, "mainnet")));
        return json(out, 200, { "Access-Control-Allow-Origin": "*" });
      } else {
        const out = await handleRpc(body, env, "mainnet");
        return json(out, 200, { "Access-Control-Allow-Origin": "*" });
      }
    }

    // Testnet RPC endpoints
    if (url.pathname.startsWith("/rpc/") && req.method === "POST") {
      const testnet = url.pathname.split("/")[2]; // /rpc/sepolia, /rpc/goerli, etc.
      if (!TESTNET_CONFIGS[testnet as keyof typeof TESTNET_CONFIGS]) {
        return json({ error: "unsupported_testnet" }, 400, { "Access-Control-Allow-Origin": "*" });
      }

      const body = await req.json().catch(() => null);
      if (!body || typeof body !== "object") return json({ error: "invalid_json" }, 400, { "Access-Control-Allow-Origin": "*" });

      // Batch or single
      if (Array.isArray(body)) {
        const out = await Promise.all(body.map((call) => handleRpc(call, env, testnet)));
        return json(out, 200, { "Access-Control-Allow-Origin": "*" });
      } else {
        const out = await handleRpc(body, env, testnet);
        return json(out, 200, { "Access-Control-Allow-Origin": "*" });
      }
    }

    return new Response("Not found", { status: 404 });
  }
};

async function handleRpc(call: any, env: Env, network: string = "mainnet") {
  const id = call?.id ?? null;
  const method = String(call?.method || "");
  const params = Array.isArray(call?.params) ? call.params : [];

  try {
    if (WRITE_METHODS.has(method)) {
      // Route writes to private relays (cascade) - only for mainnet
      if (network !== "mainnet") {
        return rpcError(id, -32000, "private_relays_only_supported_on_mainnet");
      }

      const rawTx = params[0];
      if (!/^0x[0-9a-fA-F]+$/.test(rawTx || "")) {
        return rpcError(id, -32602, "eth_sendRawTransaction expects hex rawTx");
      }

      const reqBody = { jsonrpc: "2.0", id, method, params: [rawTx] };
      const relays = [env.FLASHBOTS_RPC, env.BLOX_PROTECT, env.EDEN_RPC];

      for (const rpc of relays) {
        try {
          const r = await postJson(rpc, reqBody, 3500);
          const j = await r.json();
          if (j?.result) {
            // Save minimal status
            const txId = crypto.randomUUID();
            await env.TXKV.put(`tx:${txId}`, JSON.stringify({
              id: txId, method, hash: j.result, via: rpc, ts: Date.now(), network
            }), { expirationTtl: 60 * 60 * 24 }); // 24h
            // Return normal JSON-RPC shape
            return { jsonrpc: "2.0", id, result: j.result };
          }
          // fall through on error
        } catch { /* try next relay */ }
      }
      // All relays failed
      return rpcError(id, -32000, "private_relay_submit_failed");
    }

    // Everything else → appropriate RPC based on network
    let targetRpc = env.READ_RPC; // default to mainnet
    
    if (network !== "mainnet") {
      if (network === "sepolia") {
        targetRpc = env.SEPOLIA_READ_RPC;
      } else if (network === "goerli") {
        targetRpc = env.GOERLI_READ_RPC;
      } else if (network === "holesky") {
        targetRpc = env.HOLESKY_READ_RPC;
      }
    }

    const forward = await postJson(targetRpc, {
      jsonrpc: "2.0",
      id,
      method,
      params
    }, 8000);

    // Pass-through response
    const j = await forward.json();
    // Ensure id echoes back correctly for wallet compatibility
    if (j && typeof j === "object") j.id = id;
    return j ?? rpcError(id, -32000, "upstream_failed");

  } catch (e: any) {
    return rpcError(id, -32603, `internal_error: ${String(e?.message || e)}`);
  }
}

function rpcError(id: any, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function json(data: any, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), { 
    status, 
    headers: { 
      "content-type": "application/json",
      ...headers
    } 
  });
}

async function postJson(url: string, body: any, timeoutMs = 5000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: ctrl.signal
  });
  clearTimeout(t);
  return res;
}
