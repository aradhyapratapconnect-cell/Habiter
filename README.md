# Habiter

A private, offline habit tracker that gives you a full year of your habits, streaks, mood, and sleep in one dashboard — with zero data ever leaving your machine.

## Tech Stack

- **Electron** — Desktop app shell (Windows, macOS, Linux)
- **React 18 + TypeScript** — UI framework
- **Vite** — Build tooling and dev server
- **SQLite (better-sqlite3)** — Local database
- **Zustand** — State management
- **Recharts** — Charts and data visualization
- **Tailwind CSS** — Styling

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Package for distribution
npm run electron:build:win   # Windows
npm run electron:build:mac   # macOS
npm run electron:build:linux # Linux
```

## Project Structure

```
habiter/
├── electron/          # Main process (Node.js side)
│   ├── main.ts        # App entry point, window creation, lifecycle
│   ├── preload.ts     # Secure bridge between main and renderer
│   ├── db/            # SQLite database and migrations
│   ├── notifications/ # Native OS reminder scheduler
│   └── ipc/           # IPC channel handlers
├── src/               # Renderer process (React app)
│   ├── components/    # UI components
│   ├── stores/        # Zustand state stores
│   ├── hooks/         # Custom React hooks
│   ├── types/         # TypeScript type definitions
│   ├── utils/         # Utility functions
│   └── styles/        # Tailwind config and global CSS
├── build/             # electron-builder config & icons
└── tests/             # Unit and E2E tests
```

## License

MIT
