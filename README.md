# Ludo Game - Online Multiplayer

A full-stack online Ludo game built with Next.js, Prisma, PostgreSQL, and Tailwind CSS. Features crypto wallet integration, real-time multiplayer, video calls, tournaments, and more.

## Features

- 🎮 **Online Multiplayer**: Play Ludo with friends or random players worldwide
- 💰 **Crypto Wallet**: TRON (TRC-20) USDT integration for deposits, withdrawals, and game entry fees
- 👥 **Friend System**: Add friends and invite them to games
- 🎯 **Tournaments**: Monthly tournaments with leaderboard and bracket phases
- 📹 **Video Calls**: WebRTC video/audio calls during gameplay
- 📱 **Screen Recording**: Record and share your games on social media
- 🎨 **Customization**: Unlock board colors and piece styles based on level
- 📊 **Admin Panel**: Dashboard with daily statistics and user management
- 🔄 **Rejoin**: Reconnect to games if you disconnect

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Socket.io
- **Database**: PostgreSQL with Prisma ORM
- **Blockchain**: TRON (TRC-20) for USDT
- **Real-time**: Socket.io for game synchronization
- **Video**: WebRTC for peer-to-peer video calls
- **Auth**: NextAuth.js

## Setup

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- TRON wallet (for main game wallet)

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd ledo-game
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:
   Create a `.env` file in the root directory:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/ledo_game?schema=public"
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"
TRON_NETWORK="shasta"
TRON_PRIVATE_KEY="your-tron-private-key-here"
TRON_API_KEY="your-trongrid-api-key-here"
GAME_WALLET_ADDRESS="your-game-wallet-address"
```

4. Set up the database:

```bash
npx prisma migrate dev
npx prisma generate
```

5. Run the development server:

```bash
npm run dev
```

## Admin Access

### Making a User Admin

To make a user an admin, you can use the provided script:

```bash
npx tsx scripts/make-admin.ts <email|username>
```

Example:

```bash
npx tsx scripts/make-admin.ts admin@example.com
# or
npx tsx scripts/make-admin.ts adminuser
```

Alternatively, you can directly update the database:

```sql
UPDATE "User" SET "isAdmin" = true WHERE email = 'admin@example.com';
```

### Accessing Admin Dashboard

Once a user is an admin:

1. Log in with the admin account
2. Navigate to `/admin` or click the "Admin" card on the home page (only visible to admins)
3. The admin dashboard provides:
   - **Overview**: Daily statistics (games, deposits, withdrawals, commission, active users)
   - **Settings**: Configure game entry fees, commission rates, and allowed entry fee options
   - **Users**: User management (coming soon)
   - **Games**: Game management (coming soon)

### Admin Features

- **Entry Fee Configuration**: Set default, minimum, and maximum entry fees
- **Allowed Entry Fees**: Configure which entry fee options appear in the lobby
- **Commission Rate**: Set the percentage commission taken from game entry fees (0-100%)
- **Statistics**: View daily statistics for games, transactions, and users

The application will be available at `http://localhost:3000`.

## Project Structure

```
ledo-game/
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (auth)/            # Authentication routes
│   │   ├── (game)/            # Game routes
│   │   ├── admin/             # Admin panel
│   │   └── api/               # API routes
│   ├── components/            # React components
│   │   ├── game/              # Game components
│   │   ├── ui/                # UI components
│   │   ├── wallet/            # Wallet components
│   │   └── video/             # Video call components
│   ├── lib/                   # Utilities and libraries
│   │   ├── game/              # Game logic
│   │   ├── blockchain/        # TRON integration
│   │   └── socket/            # Socket.io client
│   └── server/                # Server-side code
│       └── socket/            # Socket.io server
└── server.ts                  # Custom server with Socket.io
```

## Game Modes

- **Solo**: 1-player teams, 2-12 players total
- **Team**: 1-6 players per team, up to 12 players total

## Entry Fees

Players can choose entry fees from 1 to 10 USDT. Matchmaking pairs players with the same entry fee.

## Commission

17% of the total pot is deducted as commission to the game wallet before winner payout.

## Level System

Players gain XP from games:

- Win: 100 XP
- Level up: Every 1000 XP

Higher levels unlock:

- Custom board colors
- Fancy piece styles

## Development

### Running in Development

```bash
npm run dev
```

### Building for Production

```bash
npm run build
npm start
```

### Database Migrations

```bash
npx prisma migrate dev
```

## Security Notes

- Private keys should be stored securely (use environment variables or a key management service)
- In production, implement proper encryption for wallet private keys
- Use HTTPS in production
- Implement rate limiting for API routes
- Validate all user inputs

## Future Enhancements

- Mobile apps (React Native)
- Push notifications
- In-app chat
- Spectator mode
- Replay system
- More customization options

## License

[Your License Here]
