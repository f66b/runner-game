# Crypto Runner 🏃💰

A production-ready 2D endless runner web game with USDC wagering on Ink Chain (EVM).

## 🎮 Features

- **Smooth 60 FPS gameplay** with Phaser 3
- **Server-authoritative** - All game logic runs on the backend for fairness
- **Provably fair** - RNG commit/reveal scheme with EIP-712 signed receipts
- **Safe bankroll management** - Only risk what you lock
- **Checkpoints every 60s** - Exit safely or continue for bigger rewards
- **Mobile-friendly** - Touch controls for mobile play

## 📁 Project Structure

```
runner-game/
├── contracts/          # Solidity smart contracts (Foundry)
│   ├── src/
│   │   ├── Vault.sol       # Main vault contract
│   │   └── MockUSDC.sol    # Test token
│   ├── test/
│   │   └── Vault.t.sol     # Contract tests
│   └── script/
│       └── Deploy.s.sol    # Deployment script
├── backend/            # Node.js game server
│   ├── src/
│   │   ├── server.ts       # Express + WebSocket server
│   │   ├── signing.ts      # EIP-712 receipt signing
│   │   └── game/
│   │       ├── simulation.ts   # Deterministic game engine
│   │       └── rng.ts          # Seeded RNG
│   └── prisma/
│       └── schema.prisma   # Database schema
└── frontend/           # Next.js + Phaser 3 client
    └── src/
        ├── app/            # Next.js pages
        ├── components/     # React components
        ├── game/           # Phaser game scene
        └── lib/            # Utilities, config, API client
```

## 🔗 Chain Configuration

**Ink Sepolia Testnet:**
- Chain ID: `763373`
- RPC: `https://rpc-gel-sepolia.inkonchain.com`
- Explorer: `https://explorer-sepolia.inkonchain.com`

**Ink Mainnet:**
- Chain ID: `57073`
- RPC: `https://rpc-gel.inkonchain.com`
- Explorer: `https://explorer.inkonchain.com`

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- [Foundry](https://getfoundry.sh/)
- A wallet with testnet ETH on Ink Sepolia

### 1. Clone and Install

```bash
cd runner-game

# Install backend dependencies
cd backend
npm install
npx prisma generate
npx prisma db push
cd ..

# Install frontend dependencies
cd frontend
npm install
cd ..

# Install Foundry dependencies
cd contracts
forge install
cd ..
```

### 2. Configure Environment

Copy the example environment files:

```bash
# Backend
cp backend/.env.example backend/.env

# Frontend (create manually)
cat > frontend/.env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
NEXT_PUBLIC_VAULT_ADDRESS=0x0000000000000000000000000000000000000000
NEXT_PUBLIC_USDC_ADDRESS=0x0000000000000000000000000000000000000000
NEXT_PUBLIC_CHAIN_ID=763373
EOF
```

### 3. Deploy Contracts (Local Development)

Start a local Anvil chain:

```bash
cd contracts
anvil
```

In another terminal, deploy:

```bash
cd contracts
source ~/.bashrc
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
```

Update the contract addresses in your `.env` files.

### 4. Run the Application

Start the backend:

```bash
cd backend
npm run dev
```

Start the frontend:

```bash
cd frontend
npm run dev
```

Visit `http://localhost:3000`

## 🎮 How to Play

1. **Connect Wallet** - Use MetaMask or any injected wallet
2. **Claim Bonus** - Get $5 USDC free to start (one-time)
3. **Start Run** - Lock a bankroll amount and configure difficulty
4. **Play** - Jump (Space/Up) and Slide (Down) to avoid obstacles
5. **Collect Rewards** - Touch gold coins to increase bankroll
6. **Checkpoints** - Every 60s, choose to Exit/Pause/Continue
7. **Withdraw** - After playing, withdraw your winnings (min $10)

### Controls

| Key | Action |
|-----|--------|
| `Space` / `↑` | Jump |
| `↓` | Slide |
| `E` | Exit at checkpoint |
| `P` | Pause at checkpoint |
| `C` | Continue at checkpoint |

## 💰 Economy

| Parameter | Value |
|-----------|-------|
| Incentive (one-time) | $5 USDC |
| Minimum Deposit | $5 USDC |
| Minimum Withdrawal | $10 USDC |
| Profit Fee | 10% |
| Withdrawal Fee | 1% |

## 🔒 Security Features

- **Server-authoritative gameplay** - Client only sends inputs
- **EIP-712 signed receipts** - Verifiable on-chain settlement
- **Nonce-based replay protection** - Each receipt can only be used once
- **RNG commit/reveal** - Seed committed before run, revealed after
- **Forfeit on disconnect** - Mid-run disconnects forfeit locked bankroll

## 🧪 Testing

### Smart Contract Tests

```bash
cd contracts
forge test -vvv
```

### Backend Development

```bash
cd backend
npm run dev
```

## 📦 Production Deployment

### 1. Deploy Contracts to Ink

```bash
cd contracts

# Set environment variables
export PRIVATE_KEY=<deployer-private-key>
export SIGNER_ADDRESS=<backend-signer-address>
export TREASURY_ADDRESS=<fee-recipient-address>
export USDC_ADDRESS=<ink-usdc-address>  # Use real USDC on mainnet

# Deploy
forge script script/Deploy.s.sol \
  --rpc-url https://rpc-gel.inkonchain.com \
  --broadcast \
  --verify
```

### 2. Configure Production Environment

Update backend `.env`:
- Set production database URL
- Set production RPC URL
- Set deployed contract addresses
- Use secure JWT secret
- Use HSM/KMS for signer key

### 3. Deploy Backend

Deploy to your preferred hosting (Railway, Fly.io, AWS, etc.)

### 4. Deploy Frontend

```bash
cd frontend
npm run build
# Deploy to Vercel, Cloudflare Pages, etc.
```

## 📜 License

MIT

## ⚠️ Disclaimer

This is an MVP for educational purposes. Before using with real funds:

- Audit all smart contracts
- Use HSM/KMS for signing keys
- Implement rate limiting
- Add monitoring and alerts
- Consider regulatory requirements
