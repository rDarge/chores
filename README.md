# Home Chore Deck

A lightweight, self-hosted household chore management web app built for a home TinyPC (`Node.js` + `Express` + built-in `node:sqlite` + `React` + `Vite`).

## Features

- **Device Name Memory**: First-time visitors pick a name saved in `localStorage` on their device.
- **Cascaded 4-Card Stack**:
  - **Cards 1–3**: Active chores sorted strictly by **Importance** (`Important` > `Regular` > `Someday`), then by **Due Date** (overdue/earliest first, no-due-date last), with a deterministic daily/redeal shuffle for ties.
  - **Card 4 (Bottom Summary Card)**: Shows `# chores left`, breakdown by importance and ignored count, a **double-tap to redeal** action (un-ignoring all chores and re-shuffling ties from highest priority), and access to **Scheduled Recurring & Completed History**.
- **Touch & Mouse Gestures**:
  - **Swipe Right** on any of the top 3 chore cards to mark complete (with Undo toast).
  - **Swipe Left** on any of the top 3 chore cards to ignore for today and deal the next chore.
  - **Tap** any chore card to zoom into its details, view creation/completion metadata, or edit/delete it.
  - **Double-Tap** the 4th bottommost card to redeal.
- **Bottom-Left FAB**: Quickly add a new chore with Title, Description, Importance (`Important`, `Regular`, `Someday` by default), Weight (`Light 5–30m`, `Medium 30–60m`, `Heavy >60m`), and Optional Due Date (`No Due Date`, `Specific Day`, or `Recurring Interval` every `N` days).
- **12:00 AM Daily Reset & Live Household Sync**:
  - Automatically un-ignores all cards and reshuffles at `12:00 AM` local time.
  - Recurring chores automatically reopen when their `intervalDays` elapses after last completion.
  - Real-time updates across open devices via Server-Sent Events (`/api/events`) plus automatic sync on tab focus/wake.

## Running on Your TinyPC

### Option A: Docker Compose (Recommended)

```bash
docker compose up -d --build
```

- Exposes the app on `http://<tinypc-ip>:8001`
- Persists the SQLite database in `./data/chores.db` on the host

### Option B: Direct Node.js

```bash
# Install dependencies
npm install

# Build the frontend bundle
npm run build

# Start the single-process production server (defaults to 0.0.0.0:8001)
npm start
```

### Development Mode

```bash
npm run dev
```

### Running Automated Tests

```bash
npm test
```
