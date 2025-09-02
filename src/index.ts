

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

// Agent intelligence: Track relay performance
interface RelayStats {
  success: number;
  failures: number;
  avgResponseTime: number;
  lastUsed: number;
}

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

    // Agent intelligence endpoint - show relay performance
    if (url.pathname === "/agent/stats") {
      const stats = await getAgentStats(env);
      return json(stats, 200, { "Access-Control-Allow-Origin": "*" });
    }

    // Agent recommendation endpoint
    if (url.pathname === "/agent/recommend") {
      const recommendation = await getAgentRecommendation(env);
      return json(recommendation, 200, { "Access-Control-Allow-Origin": "*" });
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

// Agent intelligence: Get relay performance stats
async function getAgentStats(env: Env) {
  const stats = {
    flashbots: await env.TXKV.get("stats:flashbots", "json") as RelayStats || { success: 0, failures: 0, avgResponseTime: 0, lastUsed: 0 },
    bloxroute: await env.TXKV.get("stats:bloxroute", "json") as RelayStats || { success: 0, failures: 0, avgResponseTime: 0, lastUsed: 0 },
    eden: await env.TXKV.get("stats:eden", "json") as RelayStats || { success: 0, failures: 0, avgResponseTime: 0, lastUsed: 0 }
  };
  
  return {
    agent: "MEV Shield",
    version: "1.0.0",
    intelligence: "Active",
    relayPerformance: stats,
    totalTransactions: stats.flashbots.success + stats.bloxroute.success + stats.eden.success,
    successRate: calculateSuccessRate(stats),
    recommendation: await getAgentRecommendation(env)
  };
}

// Agent intelligence: Get smart recommendation
async function getAgentRecommendation(env: Env) {
  const stats = {
    flashbots: await env.TXKV.get("stats:flashbots", "json") as RelayStats || { success: 0, failures: 0, avgResponseTime: 0, lastUsed: 0 },
    bloxroute: await env.TXKV.get("stats:bloxroute", "json") as RelayStats || { success: 0, failures: 0, avgResponseTime: 0, lastUsed: 0 },
    eden: await env.TXKV.get("stats:eden", "json") as RelayStats || { success: 0, failures: 0, avgResponseTime: 0, lastUsed: 0 }
  };
  
  // Intelligent recommendation based on performance
  const recommendations: string[] = [];
  
  if (stats.flashbots.success > stats.bloxroute.success && stats.flashbots.success > stats.eden.success) {
    recommendations.push("Flashbots is performing best - prioritizing for transactions");
  }
  
  if (stats.bloxroute.avgResponseTime < 1000) {
    recommendations.push("bloXroute has fastest response time - good for time-sensitive transactions");
  }
  
  if (stats.eden.failures < stats.flashbots.failures && stats.eden.failures < stats.bloxroute.failures) {
    recommendations.push("Eden has lowest failure rate - reliable fallback option");
  }
  
  return {
    primaryRelay: getBestRelay(stats),
    fallbackStrategy: "Cascade through remaining relays",
    recommendations: recommendations.length > 0 ? recommendations : ["All relays performing well - using balanced approach"],
    confidence: calculateConfidence(stats)
  };
}

// Agent intelligence: Calculate success rate
function calculateSuccessRate(stats: any) {
  const total = stats.flashbots.success + stats.flashbots.failures + 
                stats.bloxroute.success + stats.bloxroute.failures + 
                stats.eden.success + stats.eden.failures;
  return total > 0 ? ((stats.flashbots.success + stats.bloxroute.success + stats.eden.success) / total * 100).toFixed(2) + "%" : "0%";
}

// Agent intelligence: Get best performing relay
function getBestRelay(stats: any) {
  const flashbotsScore = stats.flashbots.success - stats.flashbots.failures;
  const bloxrouteScore = stats.bloxroute.success - stats.bloxroute.failures;
  const edenScore = stats.eden.success - stats.eden.failures;
  
  if (flashbotsScore >= bloxrouteScore && flashbotsScore >= edenScore) return "Flashbots";
  if (bloxrouteScore >= edenScore) return "bloXroute";
  return "Eden";
}

// Agent intelligence: Calculate confidence level
function calculateConfidence(stats: any) {
  const totalSuccess = stats.flashbots.success + stats.bloxroute.success + stats.eden.success;
  const totalFailures = stats.flashbots.failures + stats.bloxroute.failures + stats.eden.failures;
  const total = totalSuccess + totalFailures;
  
  if (total === 0) return "No data yet";
  if (totalSuccess > totalFailures * 3) return "High confidence";
  if (totalSuccess > totalFailures) return "Medium confidence";
  return "Low confidence - investigating issues";
}

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
      const relayNames = ["flashbots", "bloxroute", "eden"];

      // Agent intelligence: Use performance-based routing
      const stats = await getRelayStats(env);
      const orderedRelays = orderRelaysByPerformance(relays, relayNames, stats);

      for (let i = 0; i < orderedRelays.length; i++) {
        const { relay, name } = orderedRelays[i];
        try {
          const startTime = Date.now();
          const r = await postJson(relay, reqBody, 3500);
          const responseTime = Date.now() - startTime;
          const j = await r.json();
          
          if (j?.result) {
            // Agent intelligence: Update performance stats
            await updateRelayStats(env, name, true, responseTime);
            
            // Save minimal status
            const txId = crypto.randomUUID();
            await env.TXKV.put(`tx:${txId}`, JSON.stringify({
              id: txId, method, hash: j.result, via: relay, ts: Date.now(), network,
              agentDecision: `Chose ${name} based on performance analysis`
            }), { expirationTtl: 60 * 60 * 24 }); // 24h
            // Return normal JSON-RPC shape
            return { jsonrpc: "2.0", id, result: j.result };
          }
          // Agent intelligence: Update failure stats
          await updateRelayStats(env, name, false, responseTime);
          // fall through on error
        } catch { 
          // Agent intelligence: Update failure stats
          await updateRelayStats(env, name, false, 0);
          /* try next relay */ 
        }
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

// Agent intelligence: Get relay performance stats
async function getRelayStats(env: Env) {
  return {
    flashbots: await env.TXKV.get("stats:flashbots", "json") as RelayStats || { success: 0, failures: 0, avgResponseTime: 0, lastUsed: 0 },
    bloxroute: await env.TXKV.get("stats:bloxroute", "json") as RelayStats || { success: 0, failures: 0, avgResponseTime: 0, lastUsed: 0 },
    eden: await env.TXKV.get("stats:eden", "json") as RelayStats || { success: 0, failures: 0, avgResponseTime: 0, lastUsed: 0 }
  };
}

// Agent intelligence: Order relays by performance
function orderRelaysByPerformance(relays: string[], names: string[], stats: any) {
  const relayData = relays.map((relay, i) => ({
    relay,
    name: names[i],
    score: calculateRelayScore(stats[names[i]])
  }));
  
  // Sort by performance score (highest first)
  relayData.sort((a, b) => b.score - a.score);
  
  return relayData;
}

// Agent intelligence: Calculate relay performance score
function calculateRelayScore(stats: RelayStats) {
  const total = stats.success + stats.failures;
  if (total === 0) return 0;
  
  const successRate = stats.success / total;
  const responseScore = Math.max(0, 1 - (stats.avgResponseTime / 5000)); // Prefer faster responses
  const recencyScore = Math.max(0, 1 - ((Date.now() - stats.lastUsed) / (24 * 60 * 60 * 1000))); // Prefer recently used
  
  return (successRate * 0.6) + (responseScore * 0.3) + (recencyScore * 0.1);
}

// Agent intelligence: Update relay performance stats
async function updateRelayStats(env: Env, relayName: string, success: boolean, responseTime: number) {
  const current = await env.TXKV.get(`stats:${relayName}`, "json") as RelayStats || { success: 0, failures: 0, avgResponseTime: 0, lastUsed: 0 };
  
  if (success) {
    current.success++;
  } else {
    current.failures++;
  }
  
  // Update average response time
  const totalRequests = current.success + current.failures;
  current.avgResponseTime = ((current.avgResponseTime * (totalRequests - 1)) + responseTime) / totalRequests;
  current.lastUsed = Date.now();
  
  await env.TXKV.put(`stats:${relayName}`, JSON.stringify(current), { expirationTtl: 60 * 60 * 24 * 7 }); // 7 days
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
