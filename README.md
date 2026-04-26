# 🚀 SwiftRoute — Logistics & Delivery Tracking Portal

A full-stack, production-grade logistics management platform built with **Node.js**, **Express**, **MongoDB (Mongoose)**, **Socket.IO**, and a custom dark-themed frontend.

---

## 📁 Project Structure

```
logistics-portal/
├── backend/
│   ├── config/
│   │   └── database.js          # MongoDB connection (Mongoose)
│   ├── controllers/
│   │   ├── authController.js    # Auth logic (JWT, RBAC)
│   │   └── shipmentController.js # Shipment CRUD + dashboard stats
│   ├── middleware/
│   │   ├── auth.js              # JWT protect + authorize (RBAC)
│   │   ├── error.js             # Global error handler (AppError)
│   │   └── logger.js            # Request logger + zlib compression
│   ├── models/
│   │   ├── User.js              # Mongoose schema + bcrypt hooks
│   │   ├── Shipment.js          # Shipment schema + paginate()
│   │   └── Notification.js      # Notification schema
│   ├── routes/
│   │   ├── auth.js              # /api/v1/auth/* (express-validator)
│   │   ├── shipments.js         # /api/v1/shipments/*
│   │   └── notifications.js     # /api/v1/notifications/*
│   ├── server.js                # Express + Socket.IO + EventEmitter
│   ├── seed.js                  # Demo data seeder (40 shipments)
│   ├── server.test.js           # Jest + Supertest API tests
│   ├── .env                     # Environment variables
│   └── package.json
├── frontend/
│   └── public/
│       ├── index.html           # Single-page app shell
│       ├── css/style.css        # Full dark-theme design system
│       └── js/app.js            # SPA router + Socket.IO client
└── README.md
```

---

## 🛠️ Tech Stack & Topics Covered

### Unit I – Node.js Fundamentals
| Feature | Implementation |
|---------|---------------|
| Node.js REPL | Interactive testing in terminal |
| npm + npm init | `package.json` with all dependencies |
| Core Modules | `http`, `fs`, `zlib`, `stream`, `events` |
| Local Modules | All `controllers/`, `middleware/`, `models/` |
| Third-Party Modules | express, mongoose, socket.io, jwt, bcryptjs |
| EventEmitter | `LogisticsEventEmitter` in `server.js` |
| Callbacks | Legacy `fs` operations |
| Streams + Zlib | `compressLogFile()` in `middleware/logger.js` |
| Promises / async-await | All controllers use `async/await` |

### Unit II – Express & HTTP
| Feature | Implementation |
|---------|---------------|
| Express setup | `server.js` |
| GET / POST / PATCH / DELETE | All shipment & auth routes |
| express.Router | `routes/auth.js`, `routes/shipments.js` |
| express-validator | Input validation on all POST routes |
| Error handling | `middleware/error.js` → `AppError` class |
| HTTP module | `http.createServer(app)` for Socket.IO |
| Request/Response/Server | Full Express + HTTP server |
| Status codes + headers | All API responses |
| Microservices concept | Routes modularized as service-like units |

### Unit III – Middleware & Sockets
| Feature | Implementation |
|---------|---------------|
| Socket.IO | Real-time tracking, live feed, driver assignment |
| WebSocket events | `shipment:new`, `shipment:updated`, `tracking:update` |
| Custom middleware | `requestLogger`, `createRateLimiter` |
| cookie-parser | `cookieParser()` in `server.js` |
| cookie-session | `cookieSession()` in `server.js` |
| express-session | Session middleware setup |
| `app.use()` | All global middleware registered |
| `app.all()` | Catch-all route for frontend SPA |

### Unit IV – Authentication & Security
| Feature | Implementation |
|---------|---------------|
| JWT | `generateToken()`, `protect` middleware |
| RBAC | `authorize('admin','manager')` on routes |
| Permissions array | Per-user permission list set by role |
| Security headers | `helmet()` in `server.js` |
| Rate limiting | `express-rate-limit` on all `/api` routes |
| Password hashing | `bcryptjs` pre-save hook in `User.js` |

### Unit IV – MongoDB & Mongoose
| Feature | Implementation |
|---------|---------------|
| MongoDB connection | `config/database.js` |
| Schema definition | `User.js`, `Shipment.js`, `Notification.js` |
| Models | Mongoose models with indexes |
| CRUD operations | Full create/read/update/delete |
| Pagination | `Shipment.paginate()` static method |
| Aggregation | `$group` for monthly dashboard stats |
| Indexes | Compound indexes for fast queries |

### Unit VI – Testing & Deployment
| Feature | Implementation |
|---------|---------------|
| Jest + Supertest | `server.test.js` — 17 test cases |
| API versioning | All routes under `/api/v1/` |
| Health check | `GET /api/health` |

### Frontend (Units I–VI)
| Feature | Implementation |
|---------|---------------|
| HTML5 Semantic | Full semantic structure |
| CSS3 / Flexbox / Grid | Complete design system |
| Responsive design | Mobile-first breakpoints |
| JavaScript ES6+ | Arrow functions, async/await, destructuring |
| DOM Manipulation | Dynamic table rendering, modal system |
| Async Programming | fetch API + promise chains |
| Event Handling | Socket.IO real-time events |
| Module pattern | Organized JS functions |

---

## 🚀 Setup & Run

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment
Edit `backend/.env`:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/logistics_portal
JWT_SECRET=your_super_secret_key
```

### 3. Seed Demo Data
```bash
cd backend
node seed.js
```

### 4. Start Server
```bash
# Development
npm run dev

# Production
npm start
```

### 5. Open App
Visit: **http://localhost:5000**

---

## 🔐 Demo Accounts

| Role     | Email                        | Password    | Access |
|----------|------------------------------|-------------|--------|
| Admin    | admin@swiftroute.com         | admin123    | Full access — all features |
| Manager  | manager@swiftroute.com       | manager123  | Manage shipments, assign drivers |
| Driver   | driver@swiftroute.com        | driver123   | View & update assigned shipments |
| Customer | customer@swiftroute.com      | customer123 | Track own shipments |

---

## 🧪 Running Tests

```bash
cd backend
npm test
```

Test coverage includes:
- User registration & login
- JWT authentication
- Role-based access control
- Shipment CRUD
- Public tracking
- Dashboard stats authorization
- Pagination
- Health check

---

## 🌐 API Endpoints

### Auth
```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
GET    /api/v1/auth/me              [protected]
PUT    /api/v1/auth/update-profile  [protected]
GET    /api/v1/auth/users           [admin]
GET    /api/v1/auth/drivers         [admin, manager]
```

### Shipments
```
GET    /api/v1/shipments/track/:trackingNumber  [public]
GET    /api/v1/shipments/dashboard/stats        [admin, manager]
GET    /api/v1/shipments                        [protected]
POST   /api/v1/shipments                        [protected]
GET    /api/v1/shipments/:id                    [protected]
DELETE /api/v1/shipments/:id                    [admin]
PATCH  /api/v1/shipments/:id/status             [admin, manager, driver]
PATCH  /api/v1/shipments/:id/assign-driver      [admin, manager]
```

### Notifications
```
GET    /api/v1/notifications                    [protected]
PATCH  /api/v1/notifications/:id/read           [protected]
PATCH  /api/v1/notifications/mark-all-read      [protected]
```

### Health
```
GET    /api/health
```

---

## ⚡ Real-Time Events (Socket.IO)

| Event (Client → Server) | Description |
|--------------------------|-------------|
| `user:join` | Authenticate socket with userId |
| `shipment:subscribe` | Subscribe to shipment updates |
| `location:update` | Driver sends GPS update |
| `chat:message` | Send live chat message |

| Event (Server → Client) | Description |
|--------------------------|-------------|
| `shipment:new` | New shipment created |
| `shipment:updated` | Shipment status changed |
| `tracking:update` | Real-time tracking update |
| `driver:assigned` | Driver assigned to shipment |
| `users:online` | Online user count |

---

## 🎨 Frontend Features

- **Dark theme** design system with CSS variables
- **SPA routing** — no page reloads
- **Role-based UI** — menus hidden based on permissions
- **Real-time live feed** — Socket.IO event stream
- **Interactive charts** — Chart.js (line, doughnut, bar, pie)
- **Shipment form** — dynamic cost calculator
- **Public tracker** — no login required
- **Toast notifications** — success/error/info
- **Responsive** — works on mobile & desktop
- **Animated counters** — dashboard stat cards
