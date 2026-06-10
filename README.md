# LTI 1.3 Mock Environment

A standalone training environment that emulates a complete LTI 1.3 ecosystem on localhost. Designed for developers new to LTI who want to understand how LTI 1.3, Deep Linking, Assignment and Grade Services (AGS), and Names and Role Provisioning Service (NRPS) work in practice — specifically following Blackboard Learn production patterns.

## Purpose

This application provides a fully functional LTI 1.3 environment running entirely on your local machine. It removes the need for a live LMS, external tool hosting, or developer portal access during learning and development.

**Use this to:**
- Understand the complete LTI 1.3 authentication flow (OIDC + JWT)
- See how Deep Linking creates and launches content items
- Explore how tools read course rosters via NRPS
- Learn how tools submit and retrieve grades via AGS
- Understand 3-Legged OAuth (3LO) and token exchange
- Understand OAuth 2.0 Client Credentials for LTI Advantage service calls
- Compare LTI AGS grade passback vs Learn REST API grade submission
- Observe how JWT signing and verification works with RSA keys and JWKS endpoints
- See how the Blackboard Developer Portal fits into the architecture

## What This Emulates

This environment simulates three real-world systems that interact during an LTI launch:

| Service | Port | Real-World Equivalent |
|---------|------|----------------------|
| **LMS Platform** | 3000 | Blackboard Learn |
| **Tool Provider (Backend)** | 3001 | Your LTI tool server |
| **Tool Provider (Frontend)** | 5173 | Your LTI tool React UI |
| **Dev Portal** | 3002 | Blackboard Developer Portal |

In production, these are separate systems owned by different parties. Here they all run locally so you can inspect every request, response, and JWT payload as they flow between systems.

## Prerequisites

- **Node.js 16+** and npm
- A modern web browser
- A terminal that supports ANSI colors (for color-coded logging)

**Helpful background knowledge:**
- Basic understanding of REST APIs and HTTP redirects
- Familiarity with JSON Web Tokens (JWT) — [jwt.io](https://jwt.io) is a great reference
- General understanding of OAuth 2.0 concepts (authorization codes, access tokens)
- Basic Express.js / Node.js and React knowledge (for reading the source code)

## Quick Start

```bash
npm install
cd tool-provider/client && npm install && cd ../..
npm start
```

Then open your browser to:

**http://localhost:3000/lms/course/123/launch?tool=demo**

This is the LMS course page where an instructor would launch an LTI tool. On first visit, you'll be prompted to "log in" with user information (or generate a random user). This user identity persists across all launches in the session.

## What Happens When You Launch

When you click "Launch demo Tool", the following occurs across all services:

```
┌─────────────┐         ┌───────────────┐         ┌────────────┐
│  LMS (3000) │         │  Tool (3001)  │         │ Dev Portal │
│  Platform   │         │  Provider     │         │   (3002)   │
└──────┬──────┘         └───────┬───────┘         └─────┬──────┘
       │                        │                       │
       │ 1. POST /lti/login     │                       │
       │──────────────────────> │                       │
       │                        │                       │
       │ 2. GET /oidc/login_initiations                 │
       │ <──────────────────────│                       │
       │                        │                       │
       │ 3. GET /lti/auth       │                       │
       │──────────────────────> │                       │
       │                        │                       │
       │ 4. POST /lti13 (id_token + state)              │
       │──────────────────────> │                       │
       │                        │                       │
       │ 5. OAuth /authorizationcode (3LO)              │
       │ <──────────────────────│                       │
       │                        │                       │
       │ 6. Redirect with auth code                     │
       │──────────────────────> │                       │
       │                        │                       │
       │                        │ 7. POST /oauth/token  │
       │                        │─────────────────────> │
       │                        │                       │
       │                        │ 8. 3LO Access token   │
       │                        │ <─────────────────────│
       │                        │                       │
       │  Tool redirects to React UI (port 5173)       │
       │                        │                       │
       │  (When tool calls AGS/NRPS):                  │
       │                        │                       │
       │ 9. POST /oauth2/token (client_credentials)    │
       │ <──────────────────────│                       │
       │                        │                       │
       │ 10. Service token      │                       │
       │──────────────────────> │                       │
       │                        │                       │
       │ 11. GET /lti/ags/... (Bearer token)           │
       │ <──────────────────────│                       │
       └────────────────────────┴───────────────────────┘
```

Watch the terminal output — each service logs in a different color:
- 🔵 **Blue** — LMS Platform
- 🟢 **Green** — Tool Provider
- 🟣 **Magenta** — Dev Portal

## Training Scenarios

### 1. Basic LTI 1.3 Launch (OIDC Flow)

**What you'll learn:** How OIDC authentication works between platform and tool, JWT structure, state/nonce security.

1. Visit http://localhost:3000/lms/course/123/launch?tool=demo
2. Log in with user info (or generate a random user)
3. Click "Launch demo Tool"
4. Watch the console for each numbered step
5. In the React UI, view the "Launch Claims" page to see the raw signed JWT and decoded payload

**Key concepts demonstrated:**
- Platform initiates login, not the tool
- State and nonce prevent replay attacks
- The id_token is a signed JWT containing all LTI claims
- The tool verifies the JWT signature using the platform's JWKS endpoint
- `redirect_uri` is validated against registered URIs (prevents open redirect)
- 3LO happens on every launch to obtain a bearer token for REST API access

### 2. Course Tool Launch (Resource Link)

**What you'll learn:** How a course-level tool launches directly as an `LtiResourceLinkRequest` without Deep Linking.

1. Click "Tools" in the LMS sidebar
2. Click "Demo Course Tool"
3. Observe the launch claims — note `message_type` is `LtiResourceLinkRequest` and `resource_link` identifies the tool placement

**Key concepts demonstrated:**
- Course tools launch directly as Resource Links
- No Deep Linking settings are included in the JWT
- The `resource_link` claim identifies the specific tool placement
- This is different from the content page launch which uses `LtiDeepLinkingRequest`

### 3. Deep Linking

**What you'll learn:** How tools create content items that get stored in the LMS, and how those items are subsequently launched.

1. Complete an LTI launch from the Content page (scenario 1)
2. Navigate to "Deep Linking" in the sidebar
3. Fill in the content item details and click "Create Deep Link"
4. View the decoded JWT payload and raw signed JWT
5. Click "Return Deep Link to Platform"
6. Platform shows the stored content item
7. Click the content item to launch it as a regular LTI Resource Link

**Key concepts demonstrated:**
- Deep Linking uses `LtiDeepLinkingRequest` message type
- Tool signs a response JWT containing content items
- Platform stores items and can launch them later as `LtiResourceLinkRequest`
- The Dev Portal signs the deep link JWT (Blackboard pattern)
- Each content item gets a unique Learn-style ID (e.g., `_3761_1`)
- Launched items include `resource_link` with the item's ID and title

### 4. Names and Role Provisioning Service (NRPS)

**What you'll learn:** How tools retrieve course membership and roles from the LMS.

1. Complete an LTI launch
2. Navigate to "Course Roster" in the sidebar
3. View the roster with role badges and analytics

**Key concepts demonstrated:**
- NRPS URL is provided in the LTI launch claims
- Tool obtains a **client credentials** token before calling NRPS
- Request includes `Authorization: Bearer` header and proper content-type
- Response includes user details, roles, and status
- This is a service-to-service call (no user context needed)

### 5. Assignment and Grade Services (AGS)

**What you'll learn:** How tools create assignments and submit grades back to the LMS, and how assignments appear as both gradebook items and launchable content items.

1. Complete an LTI launch
2. Navigate to "Grades (AGS)" in the sidebar
3. View existing line items (assignments)
4. Click "Submit Score" on a line item — enter a user ID and score
5. Click "View Results" to see submitted scores
6. Click "Create Assignment" to create a new line item
7. Return to the LMS course page ("← Return to LMS" in sidebar) — the new assignment appears as a content item
8. Click the assignment content item to launch it — the tool opens directly to the Grades page with that assignment pre-selected for score submission
9. Click "Gradebook" in the LMS sidebar to view all assignments and submitted scores

**Key concepts demonstrated:**
- AGS endpoint URLs are provided in the LTI launch claims
- Tool obtains a **client credentials** token before calling AGS endpoints
- Requests use LTI-specific content types (e.g., `application/vnd.ims.lis.v1.score+json`)
- Line items represent gradebook columns (assignments)
- Creating an assignment creates both a gradebook column and a launchable content item (mirrors real LMS behavior)
- Launching an assignment content item routes directly to the grading interface with the line item pre-populated
- Scores include activity progress and grading progress states
- Tools can create, read, update, and delete line items
- The LMS Gradebook page shows all line items and their submitted scores

### 6. Grades via REST API

**What you'll learn:** How to use the Learn REST API with a 3LO bearer token for grade management, and how it differs from AGS.

1. Complete an LTI launch
2. Navigate to "Grades (REST)" in the sidebar
3. View the bearer token obtained via 3LO
4. See gradebook columns fetched via REST API
5. Submit a grade using the REST API
6. View course users

**Key concepts demonstrated:**
- REST API uses the **3LO bearer token** (user context), not client credentials
- Endpoint pattern: `/learn/api/public/v3/courses/:courseId/gradebook/...`
- REST API provides broader platform access beyond LTI scopes
- Different from AGS which uses LTI service endpoints with client credentials tokens
- Both approaches can manage grades, but serve different use cases

### 7. 3-Legged OAuth (3LO)

**What you'll learn:** How the authorization code flow works between user, platform, and dev portal.

This happens automatically on every LTI launch. Watch the console for:
1. Platform's OAuth authorization endpoint receives the request
2. Platform generates an authorization code
3. Tool receives the code at `/tlocode`
4. Tool exchanges the code for an access token via Dev Portal

**Key concepts demonstrated:**
- `one_time_session_token` authorizes the OAuth request
- Authorization code is short-lived and single-use
- Dev Portal acts as the token exchange service
- Access token grants scoped API access (used for REST API calls)

### 8. Two-Token Pattern

**What you'll learn:** How LTI tools use two different OAuth tokens for different purposes.

| Token Type | How Obtained | Used For | User Context |
|-----------|-------------|----------|-------------|
| **3LO Token** | Authorization code flow during launch | REST API calls (`/learn/api/public/...`) | Yes — acts as the user |
| **Client Credentials Token** | `POST /oauth2/token` with `client_credentials` grant | AGS, NRPS service calls | No — acts as the tool |

Watch the console to see both token flows in action.

## Architecture

### LMS Platform (port 3000)
```
/lms/course/:id/launch                    # Course launch page (start here)
/lms/course/:id/launch/deeplink/:itemId   # Deep link item launch
/lms/course/:id/gradebook                 # Gradebook view (line items + scores)
/lms/course/:id/tools                     # Course tools page
/lti/login                                # OIDC login initiation
/lti/auth                                 # OIDC authorization + JWT signing
/learn/api/public/v1/oauth2/authorizationcode # 3LO authorization
/learn/api/public/v1/oauth2/token         # Client credentials token endpoint
/webapps/blackboard/controller/lti/v2/deeplinking # Deep link return
/.well-known/jwks.json                    # Platform public keys (JWKS)

# LTI Advantage Services (require Bearer token)
/lti/nrps/:contextId/memberships          # NRPS - course roster
/lti/ags/:contextId/lineitems             # AGS - list/create assignments
/lti/ags/:contextId/lineitems/:id         # AGS - get/update/delete assignment
/lti/ags/:contextId/lineitems/:id/scores  # AGS - submit grades
/lti/ags/:contextId/lineitems/:id/results # AGS - retrieve results

# Learn REST API (require 3LO Bearer token)
/learn/api/public/v3/courses/:id/gradebook/columns        # Gradebook columns
/learn/api/public/v3/courses/:id/gradebook/columns/:id/users/:id  # Submit grade
/learn/api/public/v3/courses/:id/gradebook/columns/:id/users      # Column grades
/learn/api/public/v3/courses/:id/users                    # Course users
```

### Tool Provider — Backend (port 3001)
```
/oidc/login_initiations  # Receives OIDC login from platform
/lti13                   # Receives signed JWT (LTI launch endpoint)
/tlocode                 # 3LO callback (receives authorization code)
/deep-link               # Creates and signs deep link response
/.well-known/jwks.json   # Tool public keys (JWKS)

# REST API for React frontend (proxies to platform with auth)
/api/session/:id         # Get LTI session/claims
/api/nrps/:id            # Proxy NRPS request (uses client_credentials token)
/api/ags/:id/lineitems   # Proxy AGS requests (uses client_credentials token)
/api/ags/:id/lineitems/:lineItemId/scores   # Submit score
/api/ags/:id/lineitems/:lineItemId/results  # Get results
/api/rest/:id/gradebook/columns             # REST API proxy (uses 3LO token)
/api/rest/:id/gradebook/columns/:id/users/:id  # REST grade submit
/api/rest/:id/gradebook/columns/:id/users   # REST column grades
/api/rest/:id/users                         # REST course users
```

### Tool Provider — Frontend (port 5173)
```
/launch       # LTI claims display (raw JWT + decoded payload)
/deeplink     # Deep link creation UI
/roster       # NRPS course roster
/grades       # AGS grade management
/grades-rest  # REST API grade management
```

### Dev Portal (port 3002)
```
/api/v1/oauth/token      # Token exchange (code → access token)
/.well-known/jwks.json   # Dev portal public keys (JWKS)
```

## Key Security Concepts

### JWT Signing and Verification
Every LTI launch involves signed JWTs. This environment uses RSA key pairs:
- Each service generates its own RSA key pair on startup
- Public keys are exposed via `/.well-known/jwks.json` endpoints
- JWTs are signed with private keys and verified with public keys from JWKS

### State and Nonce
- **State**: Links the OIDC request to the response, preventing CSRF attacks
- **Nonce**: Prevents token replay attacks — each token is valid only once

### Redirect URI Validation
The platform validates that the `redirect_uri` in the authorization request matches one of the URIs registered during tool setup. This prevents token theft via open redirect attacks.

### JWKS (JSON Web Key Set)
Each service exposes a `/.well-known/jwks.json` endpoint containing its public keys. Other services fetch these keys to verify JWT signatures. This is how trust is established without sharing private keys.

### Bearer Token Authentication
LTI Advantage service endpoints (AGS, NRPS) require a valid Bearer token obtained via OAuth 2.0 client credentials grant. The platform validates the token on every request and returns 401 if missing or expired.

## Configuration

### config.json
```json
{
  "platform": {
    "issuer": "http://localhost:3000",
    "client_id": "demo-client-123",
    "deployment_id": "deployment-456"
  },
  "tool": {
    "login_url": "http://localhost:3001/oidc/login_initiations",
    "redirect_uris": ["http://localhost:3001/lti13"]
  }
}
```

In production, these values come from registering your tool in the Blackboard Developer Portal.

## Project Structure

```
├── lms-platform.js              # LMS server entry point + REST API endpoints
├── dev-portal.js                # Dev Portal server entry point
├── config.json                  # Shared configuration
├── package.json                 # Root scripts and dependencies
├── routes/
│   └── platform-routes.js       # All LMS endpoints (OIDC, AGS, NRPS, OAuth)
├── utils/
│   └── logger.js                # Color-coded logging utility
└── tool-provider/
    ├── server.js                # Tool Express backend
    ├── routes/
    │   ├── lti-routes.js        # OIDC + LTI launch + 3LO callback
    │   ├── api-routes.js        # REST API for React frontend (AGS/NRPS/REST proxies)
    │   └── deeplink-routes.js   # Deep link JWT creation
    └── client/
        ├── index.html           # Vite entry point
        ├── vite.config.js       # Vite config with API proxy
        ├── package.json         # React dependencies
        └── src/
            ├── main.jsx         # React entry
            ├── App.jsx          # Router + session management
            ├── styles.css       # Global styles
            ├── components/
            │   └── Nav.jsx      # Sidebar navigation
            └── pages/
                ├── Launch.jsx   # LTI claims display (raw JWT + decoded)
                ├── DeepLink.jsx # Deep link creation
                ├── Roster.jsx   # NRPS roster view
                ├── Grades.jsx   # AGS grade management
                └── GradesRest.jsx # REST API grade management
```

## Development Features

- **Color-coded Logging**: Easily distinguish which service is handling each step
- **React Frontend**: Modern SPA with sidebar navigation and clean UI
- **Backend/Frontend Separation**: Realistic architecture matching real-world tools
- **Production URL Patterns**: Uses real Blackboard Learn URL structures and ID formats
- **Raw JWT Display**: See both the signed JWT string and decoded payload
- **Interactive UIs**: Click-through interfaces for all LTI Advantage services
- **LMS Gradebook**: View all assignments and scores from the platform side
- **LMS Tools Page**: Course tools that launch as direct Resource Links
- **Assignment ↔ Content Linking**: AGS-created assignments appear as launchable content items
- **Context-Aware Launches**: Launching an assignment routes to the grading UI with the item pre-selected
- **Return to LMS**: Navigate back to the course page from the tool sidebar
- **User Session**: Log in once, user identity persists across all launches
- **Two-Token Pattern**: Demonstrates both 3LO and client credentials flows
- **Bearer Token Validation**: AGS/NRPS endpoints reject requests without valid tokens
- **REST API Integration**: Demonstrates Learn REST API calls alongside LTI services
- **In-memory State**: No database needed — everything resets on restart
- **Vite Dev Server**: Hot module replacement for fast frontend development

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `concurrently: command not found` | Run `npm install` in root |
| React app shows "must be launched from LMS" | Start from http://localhost:3000/lms/course/123/launch?tool=demo |
| Invalid session errors | Restart all services — sessions are in-memory |
| JWT verification fails | Ensure all services are running |
| Port already in use | Kill existing processes on ports 3000, 3001, 3002, 5173 |
| Client dependencies missing | Run `cd tool-provider/client && npm install` |
| 401 on AGS/NRPS calls | Service token may have expired — restart services |
| Empty user info in JWT | Clear localStorage and re-login on the LMS page |

## Further Reading

- [IMS Global LTI 1.3 Specification](https://www.imsglobal.org/spec/lti/v1p3)
- [Blackboard LTI 1.3 Documentation](https://docs.anthology.com/docs/blackboard/lti/1.3/getting-started)
- [Blackboard AGS Documentation](https://docs.anthology.com/docs/blackboard/lti/1.3/lti-subsystems/ags/ags-start)
- [Blackboard REST API Documentation](https://docs.anthology.com/docs/blackboard/rest-apis/learn/getting-started)
- [JWT.io](https://jwt.io) — Decode and inspect JWTs
- [OAuth 2.0 Simplified](https://aaronparecki.com/oauth-2-simplified/)

## Requirements

- Node.js 16+
- npm

## License

MIT
