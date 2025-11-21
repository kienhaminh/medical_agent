# AI Agent - Web Frontend

Modern Next.js frontend for the AI Agent with dark-themed landing page and Claude-inspired chat interface.

## Features

- 🎨 **Distinctive Dark Design** - Neo-brutalist aesthetic with custom typography
- 💬 **Chat Interface** - Claude-inspired conversational UI
- ⚡ **Real-time Ready** - Built for streaming responses
- 📱 **Responsive** - Works on desktop, tablet, and mobile
- 🎭 **Custom Fonts** - JetBrains Mono + Crimson Pro
- 🎯 **Shadcn/ui Components** - Production-grade UI components

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

Visit http://localhost:3000

## Project Structure

```
app/
├── page.tsx              # Landing page
├── chat/
│   └── page.tsx          # Chat interface
├── api/
│   └── chat/
│       └── route.ts      # API endpoint
├── layout.tsx            # Root layout
└── globals.css           # Global styles + fonts

components/ui/            # Shadcn components
├── button.tsx
├── card.tsx
├── input.tsx
└── textarea.tsx
```

## Pages

### Landing Page (`/`)
- Hero section with animated headline
- Features showcase (6 cards)
- Tech stack display
- Call-to-action buttons

### Chat Page (`/chat`)
- Message history display
- Real-time input area
- Loading states
- Keyboard shortcuts (Enter to send, Shift+Enter for newline)

### API Route (`/api/chat`)
- POST endpoint for messages
- Ready to connect to Python backend
- Currently returns mock data

## Environment Variables

Create `.env.local`:

```env
PYTHON_BACKEND_URL=http://localhost:8000
```

## Design System

### Typography
- **Display Font**: JetBrains Mono (monospace, technical)
- **Body Font**: Crimson Pro (serif, readable)

### Color Scheme (Dark)
- Background: `oklch(0.09 0 0)` - Deep black
- Foreground: `oklch(0.95 0 0)` - Soft white
- Card: `oklch(0.11 0 0)` - Slightly lighter
- Border: `oklch(0.2 0 0)` - Subtle

### Key Classes
- `.font-display` - JetBrains Mono
- `.font-body` - Crimson Pro
- `.grain` - Subtle noise texture
- `.text-gradient` - Text gradient effect
- `.diagonal-accent` - Geometric clipping

## Connecting to Backend

Update `/app/api/chat/route.ts`:

```typescript
// Uncomment these lines once Python backend is running
const pythonBackendUrl = process.env.PYTHON_BACKEND_URL || "http://localhost:8000";
const response = await fetch(`${pythonBackendUrl}/api/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message }),
});
```

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS v4
- **UI Components**: Shadcn/ui
- **TypeScript**: 5.x
- **Fonts**: Google Fonts (JetBrains Mono, Crimson Pro)

## Development

```bash
# Run dev server with live reload
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint
```

## Performance

- Fast page loads (< 1s)
- Optimized fonts with `next/font`
- Code splitting with Next.js
- Lazy loading for components

## Browser Support

- Chrome/Edge 120+
- Firefox 120+
- Safari 17+

## Next Steps

1. **Connect Python Backend**: Update API route to call FastAPI server
2. **Add Streaming**: Implement SSE for real-time message streaming
3. **Session Persistence**: Save conversations to database
4. **Authentication**: Add user login if needed
5. **Deploy**: Vercel/Netlify for frontend, Railway/Render for backend

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Shadcn/ui](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Implementation Guide](../plans/ai-agent-bootstrap/251115-langchain-nextjs-implementation.md)

## License

MIT
