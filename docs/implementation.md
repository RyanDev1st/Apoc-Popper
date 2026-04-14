# Implementation Notes

## Run
```bash
npm install
npm run dev
```

## Env
Copy `.env.example` to `.env.local` and fill:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_DATABASE_URL`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `HOST_ACCESS_TOKEN`

## Host Link
- Spectator: `/spectator`
- Host: `/host/<your token>`

Example:
```txt
/host/demo-presenter-token
```

## Question Bank
- Edit `data/questions.json`
- Keep exactly 4 options per question
- Use the shape documented in [question-bank.md](/abs/path/c:/Users/admin/maze%20game/docs/question-bank.md)

## UX Shape
- Player view is a full-screen arena with floating HUD and a small action dock.
- Spectator view keeps the arena large and moves controls/data into an overlay rail.
- Mobile shows twin touch pads near the bottom of the screen.

## Verification
```bash
rtk npm test
rtk lint
npm run build
```
