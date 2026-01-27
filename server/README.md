# Server — Invite Email & SMS Integration

This server supports sending invitation emails and SMS when creating organizations.

## Setup

1. Copy the example env file:

```bash
cp .env.example .env
```

2. Edit `.env` and fill in your SMTP and Twilio credentials:

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`
- Optional: `INVITE_LINK_BASE`

If SMTP or Twilio credentials are not provided, the server will mock-send (log to console) and still return success for development.

## Run

Install dependencies (if not already):

```bash
cd server
npm install
```

Start in development (auto-restarts on changes):

```bash
npm run dev
```

Start production:

```bash
npm start
```

## API

- `POST /api/send-invite` — body: `{ email?: string, mobile?: string }`
  - Returns `{ success: true, emailSent: boolean, smsSent: boolean, inviteLink: string }`

## Notes

- The client dev server is configured to proxy `/api` to `http://localhost:5000` in `client/vite.config.js`.
- Use `.env` to provide real credentials for sending real emails/SMS.

*** End of README
