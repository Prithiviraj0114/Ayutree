# Ayutree — Full Source Code

Premium ayurvedic e-commerce platform (React + FastAPI + MongoDB) with admin console, JWT auth, Emergent Google OAuth, Razorpay payments, image uploads, transactional emails, forgot/reset password, and 41 seeded products.

---

## 1. Prerequisites

| Tool | Version |
|------|---------|
| **Node.js** | 18 or 20 LTS |
| **Yarn** | 1.22+ (`npm i -g yarn`) |
| **Python** | 3.11+ |
| **MongoDB** | 6.x (local install OR free Atlas cluster) |
| **Git** (optional) | any recent version |

Install MongoDB locally:
- **macOS**: `brew tap mongodb/brew && brew install mongodb-community && brew services start mongodb-community`
- **Windows**: download the MSI from mongodb.com/try/download/community
- **Linux**: `sudo apt install mongodb` (or follow distro docs)

Or get a free cluster on https://www.mongodb.com/cloud/atlas and copy the connection string.

---

## 2. Project Layout

```
ayutree/
├── backend/
│   ├── server.py              # FastAPI app — all endpoints, seed, auth, payments
│   ├── requirements.txt       # Python deps
│   └── .env                   # Environment variables (edit this!)
├── frontend/
│   ├── src/                   # React 19 source
│   ├── public/                # Static assets
│   ├── package.json           # JS deps
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── craco.config.js
│   └── .env                   # Frontend env (REACT_APP_BACKEND_URL)
└── README.md                  # This file
```

---

## 3. Backend Setup

```bash
cd backend
python -m venv .venv
# macOS/Linux
source .venv/bin/activate
# Windows
.venv\Scripts\activate

pip install -r requirements.txt
```

Edit `backend/.env`:

```env
MONGO_URL="mongodb://localhost:27017"
DB_NAME="ayutree_db"
CORS_ORIGINS="*"

# Required — generate any 64-char random string for production
JWT_SECRET="your-64-char-random-hex"

# Admin seed account (created on first startup)
ADMIN_EMAIL="admin@ayutree.com"
ADMIN_PASSWORD="Admin@2026"

# Optional — leave as placeholder for simulated checkout, or paste real ones
RAZORPAY_KEY_ID="rzp_test_placeholder"
RAZORPAY_KEY_SECRET="placeholder_secret"
RAZORPAY_WEBHOOK_SECRET="placeholder_webhook"

# URL the frontend is served from (used in password-reset email links)
FRONTEND_URL="http://localhost:3000"

# Optional — for object storage (image upload) via Emergent
EMERGENT_LLM_KEY=""
APP_NAME="ayutree"

# Optional — leave blank to silently log emails instead of sending
RESEND_API_KEY=""
SENDER_EMAIL="Ayutree <onboarding@resend.dev>"
```

Run the backend:

```bash
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

On first startup it auto-creates the admin user and seeds 41 products + 10 categories into MongoDB.

Test: open http://localhost:8001/api/categories — you should see JSON of 10 categories.

---

## 4. Frontend Setup

```bash
cd frontend
yarn install
```

Edit `frontend/.env`:

```env
REACT_APP_BACKEND_URL=http://localhost:8001
WDS_SOCKET_PORT=443
```

Run:

```bash
yarn start
```

Visit http://localhost:3000. You'll see the Ayutree storefront. Sign in as admin (`admin@ayutree.com` / `Admin@2026`) → you'll be redirected to `/admin`.

---

## 5. Production Build

Frontend:
```bash
cd frontend
yarn build         # → frontend/build/  (deploy to any static host: Vercel, Netlify, S3+CloudFront)
```

Backend (any Python-hosting platform):
```bash
gunicorn server:app -k uvicorn.workers.UvicornWorker -w 4 --bind 0.0.0.0:8001
```

Set the same `.env` values on your host. Point your frontend `REACT_APP_BACKEND_URL` at the deployed backend URL **before** running `yarn build`.

---

## 6. Common Tasks

### Reset the database (drop everything and re-seed)
```bash
mongo
> use ayutree_db
> db.dropDatabase()
> exit
# then restart backend — seed runs again
```

### Change admin password
Edit `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `backend/.env` and restart. The seed routine keeps the password in sync with env.

### Enable real Razorpay payments
1. Sign up at https://razorpay.com → Settings → API Keys → Generate.
2. Paste `KEY_ID` and `KEY_SECRET` into `backend/.env`.
3. Restart backend. The simulated path turns off automatically.

### Enable real emails
1. Sign up at https://resend.com → API Keys → Create.
2. Verify your domain (or use the `onboarding@resend.dev` sender for testing).
3. Paste `RESEND_API_KEY` and update `SENDER_EMAIL` in `backend/.env`.
4. Restart backend.

---

## 7. Key Files to Know

| File | Purpose |
|------|---------|
| `backend/server.py` | Single-file FastAPI app — all endpoints |
| `frontend/src/App.js` | React Router setup |
| `frontend/src/contexts/AuthContext.jsx` | Login/register/me + JWT storage |
| `frontend/src/contexts/CartContext.jsx` | Cart state |
| `frontend/src/lib/api.js` | Axios instance + helpers |
| `frontend/src/pages/admin/AdminDashboard.jsx` | Recharts analytics |

---

## 8. Default Credentials

- **Admin**: `admin@ayutree.com` / `Admin@2026`
- **Storefront**: register any customer at `/register`, or use Google sign-in if you deploy to a domain Emergent recognises.

---

## 9. Tech Stack

- **Backend**: FastAPI, Motor (async MongoDB), PyJWT, bcrypt, razorpay-python, resend, Pydantic v2
- **Frontend**: React 19, React Router v7, Tailwind CSS, shadcn/ui, Framer Motion, Phosphor Icons, Recharts, Sonner toasts, Axios
- **Database**: MongoDB
- **Payments**: Razorpay
- **Email**: Resend
- **Object Storage**: Emergent managed storage (optional; falls back to URL-only)

---

## 10. Need Help?

- `backend/server.py` is intentionally one file (~1000 lines) so you can read top-to-bottom.
- All routes are prefixed with `/api` so Kubernetes/Nginx ingress can route them.
- Auth uses **both** httpOnly cookies AND `Authorization: Bearer <token>` — Axios is configured with `withCredentials: true` and adds the Bearer header automatically.

Enjoy building with Ayutree. Empowered by Nature, Enhanced by Ayurveda.
