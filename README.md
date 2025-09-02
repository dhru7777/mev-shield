# 🛡️ MEV Shield - Cloudflare Worker Agent

A Cloudflare Worker that protects crypto transactions from MEV (Maximal Extractable Value) attacks by routing them through private relays instead of the public mempool.

## 🎯 What is MEV Shield?

MEV Shield is a JSON-RPC proxy that intercepts wallet transactions and routes them through private relays (Flashbots Protect, bloXroute Protect, Eden RPC) to prevent front-running and sandwich attacks.

### The Problem (MEV):
- Bots monitor the public mempool for pending transactions
- They front-run your trades by buying first, driving up prices
- You pay more than intended, bots profit from the difference
- This happens to millions of traders daily

### The Solution (MEV Shield):
- Routes transactions through private, hidden channels
- Bots can't see your transactions before they're processed
- No front-running possible
- You get fair prices, keep your profits

## 🚀 Live Demo

**🌐 Landing Page:** https://mev-shield.mev-shield.workers.dev/

**🔗 RPC Endpoints:**
- **Mainnet:** `https://mev-shield.mev-shield.workers.dev/rpc`
- **Sepolia Testnet:** `https://mev-shield.mev-shield.workers.dev/rpc/sepolia`
- **Goerli Testnet:** `https://mev-shield.mev-shield.workers.dev/rpc/goerli`

## 🛠️ Technical Architecture

### Core Components:
- **JSON-RPC Proxy:** Intercepts wallet requests and intelligently routes them
- **Private Relay Integration:** Routes write transactions through Flashbots, bloXroute, and Eden networks
- **Fallback Protection:** Automatic failover between multiple private relays
- **Read Operation Optimization:** Direct forwarding to public RPCs for balance checks
- **Transaction Tracking:** Unique ID generation and status monitoring

### Supported Networks:
- **Ethereum Mainnet** (with private relay protection)
- **Sepolia Testnet** (read operations only)
- **Goerli Testnet** (read operations only)

## 📖 How to Use

### 1. Add to MetaMask

**Mainnet Setup:**
1. Open MetaMask → Settings → Networks → Add Network
2. Network Name: `MEV Shield (Mainnet)`
3. New RPC URL: `https://mev-shield.mev-shield.workers.dev/rpc`
4. Chain ID: `1`
5. Currency Symbol: `ETH`
6. Block Explorer: `https://etherscan.io`

**Sepolia Testnet Setup:**
1. Open MetaMask → Settings → Networks → Add Network
2. Network Name: `MEV Shield (Sepolia)`
3. New RPC URL: `https://mev-shield.mev-shield.workers.dev/rpc/sepolia`
4. Chain ID: `11155111`
5. Currency Symbol: `ETH`
6. Block Explorer: `https://sepolia.etherscan.io`

### 2. Test the Protection

1. Switch to your MEV Shield network in MetaMask
2. Send a small transaction (0.001 ETH)
3. Your transaction will be routed through private relays
4. Check transaction status at: `https://mev-shield.mev-shield.workers.dev/status/{txId}`

## 🧪 Testing

### Local Testing:
```bash
# Clone the repository
git clone https://github.com/yourusername/mev-shield.git
cd mev-shield

# Install dependencies
npm install

# Deploy to Cloudflare Workers
npx wrangler deploy

# Test locally
npx wrangler dev
```

### Test Endpoints:
- **Health Check:** `GET /`
- **Mainnet RPC:** `POST /rpc`
- **Sepolia RPC:** `POST /rpc/sepolia`
- **Transaction Status:** `GET /status/{id}`

## 🔧 Configuration

### Environment Variables:
```json
{
  "FLASHBOTS_RPC": "https://rpc.flashbots.net",
  "BLOX_PROTECT": "https://eth-protect.rpc.blxrbdn.com",
  "EDEN_RPC": "https://api.edennetwork.io/v1/rpc",
  "READ_RPC": "https://ethereum.publicnode.com",
  "SEPOLIA_READ_RPC": "https://rpc.sepolia.org",
  "GOERLI_READ_RPC": "https://rpc.goerli.mudit.blog",
  "HOLESKY_READ_RPC": "https://rpc.holesky.ethpandaops.io"
}
```

### KV Storage:
- **TXKV:** Stores transaction status and metadata

## 🏗️ Project Structure

```
mev-shield/
├── src/
│   └── index.ts          # Main Worker code
├── public/
│   └── index.html        # Landing page
├── test-protection.html  # Local testing interface
├── wrangler.jsonc        # Cloudflare Workers config
├── package.json          # Dependencies
└── README.md            # This file
```

## 🎯 Business Impact

- **User Protection:** Prevents millions in stolen value from front-running attacks
- **Cost Reduction:** Users pay fair prices without bot interference
- **Trust Building:** Transparent, reliable transaction processing
- **Scalable Solution:** Cloudflare Workers provide global edge deployment

## 🔒 Security Features

- **Private Routing:** Transactions bypass public mempool
- **Fallback Protection:** Multiple relay redundancy
- **Transaction Tracking:** Unique ID for each transaction
- **CORS Support:** Cross-origin request handling
- **Error Handling:** Graceful degradation on failures

## 🚀 Deployment

### Prerequisites:
- Cloudflare account
- Wrangler CLI installed
- KV namespace created

### Deploy Steps:
```bash
# Install Wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create KV namespace
wrangler kv namespace create TXKV

# Deploy
wrangler deploy
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Flashbots](https://flashbots.net/) for private relay infrastructure
- [bloXroute](https://bloxroute.com/) for MEV protection
- [Eden Network](https://eden.network/) for private RPC services
- [Cloudflare Workers](https://workers.cloudflare.com/) for serverless platform

## 📞 Contact

- **Project Link:** https://github.com/yourusername/mev-shield
- **Live Demo:** https://mev-shield.mev-shield.workers.dev/
- **Issues:** https://github.com/yourusername/mev-shield/issues

---

**Built with ❤️ using Cloudflare Workers**
