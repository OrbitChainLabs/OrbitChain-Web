<div align="center">
  <h1>🌍 OrbitChain</h1>
  <p><strong>Blockchain-based crowdfunding platform on the Stellar Network</strong></p>
  <p>Transparent · Borderless · Secure</p>

  <p>
    <img src="https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js" alt="Next.js 14" />
    <img src="https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Stellar-SDK-7A5CFE?style=flat-square&logo=stellar" alt="Stellar SDK" />
    <img src="https://img.shields.io/badge/TailwindCSS-3-38BDF8?style=flat-square&logo=tailwindcss" alt="TailwindCSS" />
    <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT License" />
  </p>
</div>

---

## 📋 Overview

**OrbitChain** is a full-featured, decentralized crowdfunding platform that leverages the **Stellar blockchain** to enable transparent, borderless fundraising. Project creators can raise funds in XLM, USDC, or any Stellar-based asset, while donors benefit from complete on-chain visibility — every contribution is verifiable on the Stellar ledger.

The platform serves three primary audiences:

- **Donors** — Discover and contribute to global fundraising campaigns using their preferred Stellar wallet.
- **Creators** — Launch social impact projects, track donations in real time, and withdraw funds directly on-chain.
- **Admins** — Oversee the ecosystem through campaign approval workflows, KYC management, and analytics dashboards.

Built with **Next.js 14**, the Stellar ecosystem, and a modern TypeScript stack, OrbitChain provides a performant, responsive, and accessible user experience across devices.

---

## ✨ Features

### 🎯 For Donors

| Feature | Description |
|---|---|
| **Campaign Discovery** | Browse, search, and filter campaigns by category, urgency, and verification status |
| **Multi-Asset Donations** | Contribute in XLM, USDC, NGNT, or any Stellar-based asset |
| **Wallet Integration** | Connect via Freighter, Albedo, LOBSTR, Rabet, xBull, Hana, or WalletConnect |
| **On-Chain Transparency** | Every donation is recorded on the Stellar ledger and publicly verifiable |
| **Bookmarks** | Save and manage favorite campaigns for quick access |

### 🎯 For Creators

| Feature | Description |
|---|---|
| **Campaign Creation** | Launch projects with rich media, milestones, and funding goals |
| **Multi-Currency Goals** | Accept contributions in XLM, USDC, and custom Stellar assets |
| **Real-Time Tracking** | Live donation feed, funding progress charts, and analytics |
| **Direct Withdrawals** | Withdraw funds directly to any Stellar wallet address |
| **Draft Management** | Save and resume campaign drafts before publishing |

### 🎯 For Administrators

| Feature | Description |
|---|---|
| **Campaign Moderation** | Review, approve, or reject submitted campaigns |
| **User Management** | Manage user roles and KYC verification status |
| **Withdrawal Oversight** | Approve, reject, and track withdrawal requests |
| **Analytics Dashboard** | Platform-wide metrics, reports, and exportable data |
| **Audit Logs** | Comprehensive activity logs for compliance and security |

### 🎨 Additional Highlights

- **Dark Mode** — Full dark mode support with system preference detection and smooth transitions
- **Responsive Design** — Optimized for desktop, tablet, and mobile devices
- **Accessibility** — WCAG-compliant components with keyboard navigation and screen reader support
- **SEO Optimized** — Dynamic Open Graph tags, structured data, sitemap, and canonical URLs
- **Image Optimization** — Cloudinary integration with automatic WebP/AVIF conversion, responsive sizing, and lazy loading
- **Animations** — Fluid page transitions and micro-interactions powered by Framer Motion

---

## 🏗️ Architecture

```
orbitchain-web/
├── app/                    # Next.js 14 App Router (pages, layouts, API routes)
│   ├── (main)/            # Main application layout and pages
│   ├── admin/             # Admin dashboard pages
│   ├── auth/              # Authentication pages (login, signup, password reset)
│   ├── campaigns/         # Campaign listing and detail pages
│   ├── dashboard/         # Creator dashboard pages
│   ├── projects/          # Project detail and discovery pages
│   └── api/               # API route handlers
├── components/            # Reusable UI components
│   ├── ui/                # Primitive UI components (Button, Card, Modal, Toast, etc.)
│   ├── campaigns/         # Campaign-related components
│   ├── donations/         # Donation flow components (modal, asset selector, chart)
│   ├── projects/          # Project detail components
│   ├── admin/             # Admin panel components
│   └── legal/             # Legal and policy page components
├── hooks/                 # Custom React hooks
├── store/                 # Zustand state management stores
├── lib/                   # Core utilities and services
│   ├── stellar/           # Stellar SDK - config, validation, formatting, connection
│   ├── auth/              # Authentication utilities and session management
│   ├── api/               # API client and endpoint modules
│   ├── cache/             # Caching utilities
│   └── env.ts             # Type-safe environment variable validation
├── types/                 # TypeScript type definitions
├── utils/                 # General utility functions
├── features/              # Feature-specific logic
├── data/                  # Static data (FAQ, etc.)
├── contexts/              # React contexts (Theme, etc.)
└── docs/                  # Documentation
```

### Key Technology Decisions

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | Next.js 14 (App Router) | Server-side rendering, API routes, file-based routing |
| **Language** | TypeScript (strict mode) | Type safety across the entire codebase |
| **Styling** | TailwindCSS 3 | Utility-first CSS with dark mode support |
| **Blockchain** | Stellar SDK + Soroban RPC | On-chain transactions, wallet interaction, smart contracts |
| **State Management** | Zustand 5 | Lightweight, TypeScript-first state management |
| **Server State** | TanStack React Query 5 | Data fetching, caching, and mutation management |
| **Authentication** | NextAuth.js 4 | OAuth (Google, GitHub), email/password, session management |
| **Forms** | React Hook Form + Yup/Zod | Performant forms with schema validation |
| **UI/UX** | Framer Motion, Recharts, Lucide | Animations, charts, and icons |
| **Image Management** | Cloudinary (next-cloudinary) | Upload, optimization, and CDN delivery |
| **Notifications** | Custom toast system | In-app notifications and alerts |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** 9+ (or pnpm, yarn)
- A **Stellar wallet** extension (Freighter, Albedo, etc.) for local testing
- (Optional) **PostgreSQL** database for server-side features

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/orbitchain-web.git
cd orbitchain-web

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env.local
# Edit .env.local with your configuration (see Configuration section)

# Start the development server
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

### Configuration

Copy `.env.example` to `.env.local` and configure the following required variables:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL |
| `NEXT_PUBLIC_STELLAR_NETWORK` | `testnet`, `mainnet`, or `futurenet` |
| `NEXT_PUBLIC_STELLAR_HORIZON_URL` | Horizon server URL |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | Soroban RPC endpoint |
| `NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE` | Network passphrase |
| `NEXT_PUBLIC_CAMPAIGN_CONTRACT_ID` | Contract id of the deployed `orbitchain-campaign` contract (required for campaign deployment) |
| `STELLAR_ADMIN_SECRET_KEY` | Server-side Stellar signing key used to sign campaign deployments |
| `AUTH_SECRET` | JWT/session signing secret (32+ characters) |
| `DATABASE_URL` | PostgreSQL connection string |

See [`README.env.md`](./README.env.md) for the full list of optional variables and wallet configuration.

### Campaign deployment

The Deploy step of the campaign wizard performs a **real** Soroban submission — it does not fabricate a transaction hash. It builds the `initialize` invocation against the canonical [`orbitchain-campaign` contract](https://github.com/OrbitChainLabs/OrbitChain-Contracts) (`campaign/` crate), signs it with `STELLAR_ADMIN_SECRET_KEY` (server-side admin signing), submits it to the network configured by `NEXT_PUBLIC_STELLAR_NETWORK` / `NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE` / `NEXT_PUBLIC_SOROBAN_RPC_URL`, and registers the campaign through the backend's `POST /campaigns` lifecycle endpoint so the returned campaign id is real.

Deployment fails with a specific, user-facing error when any piece is missing (contract id, admin key, RPC), when the admin account is unfunded, when the simulation or submission is rejected, or when backend registration fails — the on-chain transaction hash is included in the error when the ledger submission succeeded but registration did not.

---

## 📖 Usage

### Running the Development Server

```bash
npm run dev
```

### Building for Production

```bash
npm run build
npm start
```

### Available Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `npm run dev` | Start development server |
| `build` | `npm run build` | Build for production |
| `start` | `npm run start` | Start production server |
| `lint` | `npm run lint` | Run ESLint |
| `type-check` | `npm run type-check` | Run TypeScript type checking |
| `storybook` | `npm run storybook` | Launch Storybook component library |
| `build-storybook` | `npm run build-storybook` | Build Storybook for deployment |

### Wallet Connection

OrbitChain supports multiple Stellar wallets:

- **Freighter** — Browser extension wallet
- **Albedo** — OAuth-based wallet integration
- **LOBSTR** — Mobile-first wallet
- **Rabet** — Browser extension wallet
- **xBull** — Cross-platform wallet
- **Hana** — Crypto-native wallet
- **WalletConnect** — Mobile wallet support via QR code

---

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

1. **Fork the repository** and create a feature branch:
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Write clear, conventional commit messages**:
   ```
   feat: add wallet connection modal
   fix: resolve donation API error
   refactor: clean up campaign creation form
   docs: update API documentation
   ```

3. **Ensure code quality**:
   ```bash
   npm run lint        # Check for lint issues
   npm run type-check  # Verify TypeScript types
   ```

4. **Open a Pull Request** from your fork back to the `main` branch with a clear description of the change.

---

## 🧪 Testing

```bash
# Run Storybook component tests
npm run storybook

# Run type checking
npm run type-check

# Run linter
npm run lint
```

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](./LICENSE) file for details.

---

<div align="center">
  <sub>Built with ❤️ on the Stellar Network</sub>
</div>
