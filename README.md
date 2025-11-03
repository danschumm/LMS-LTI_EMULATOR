# LTI 1.3 Mock Environment

This solution was primary written by AI.

A comprehensive localhost environment for testing LTI 1.3 launches with full LTI Advantage services support. Emulates Blackboard Learn production patterns including Deep Linking, Names and Role Provisioning Service (NRPS), Assignment and Grade Services (AGS), and OAuth flows.

## Quick Start

```bash
npm install
npm run dev  # Runs all services concurrently
```

Or run services individually:
```bash
npm run platform  # LMS Platform (port 3000)
npm run tool      # Tool Provider (port 3001) 
npm run dev-portal # Dev Portal (port 3002)
```

## Services

- **LMS Platform** (port 3000) - Mock Blackboard Learn platform
- **Tool Provider** (port 3001) - LTI tool with full service integration
- **Dev Portal** (port 3002) - Authentication broker and JWT signing service

## Features

### 🚀 LTI 1.3 Core
- Complete OIDC authentication flow
- JWT signing and verification with RSA keys
- State/nonce validation for security
- Production-style error handling

### 🔗 Deep Linking
- LTI Deep Linking Request/Response flow
- Content item creation and storage
- Launch created deep link items as regular LTI resources
- Dev-portal brokered authentication (Blackboard pattern)

### 👥 Names and Role Provisioning Service (NRPS)
- Course membership retrieval
- Role-based analytics and grouping
- Attendance tracking simulation
- Interactive group formation tools

### 📊 Assignment and Grade Services (AGS)
- Full CRUD operations for line items (assignments)
- Score submission with comments and progress tracking
- Results retrieval and filtering
- Grade management interface

### 🔐 OAuth 2.0 Flow
- Authorization code exchange
- Access token management
- Scoped API access simulation

## Usage Scenarios

### Basic LTI Launch
1. Visit: http://localhost:3000/lms/course/123/launch?tool=demo
2. Click "Launch demo Tool"
3. View LTI claims and use service buttons

### Deep Linking Workflow
1. Launch tool → OAuth flow → "Create Deep Link"
2. Platform receives and stores content items
3. Click "🚀 Launch [Item Name]" to launch created items

### NRPS Demo
1. From tool, click "👥 View Course Members"
2. Explore analytics, group formation, and attendance features

### AGS Demo
1. From tool, click "📊 Manage Grades (AGS)"
2. Create assignments, submit scores, view results

## Architecture

### LMS Platform (port 3000)
```
/lms/course/:id/launch                    # Launch page
/lms/course/:id/launch/deeplink/:itemId   # Deep link item launch
/lti/login                                # OIDC login initiation
/lti/auth                                 # OIDC authorization
/learn/api/public/v1/oauth2/authorizationcode # OAuth authorization
/webapps/blackboard/controller/lti/v2/deeplinking # Deep link return
/.well-known/jwks.json                    # Platform public keys

# LTI Advantage Services
/lti/nrps/:contextId/memberships          # NRPS membership
/lti/ags/:contextId/lineitems             # AGS line items
/lti/ags/:contextId/lineitems/:id/scores  # AGS score submission
/lti/ags/:contextId/lineitems/:id/results # AGS results
```

### Tool Provider (port 3001)
```
/oidc/login_initiations  # OIDC login handler
/lti13                   # LTI launch endpoint
/tlocode                 # OAuth callback
/deep-link               # Deep link creation
/nrps                    # NRPS interface
/ags                     # AGS interface
/.well-known/jwks.json   # Tool public keys
```

### Dev Portal (port 3002)
```
/api/v1/oauth/token      # OAuth token exchange
/.well-known/jwks.json   # Dev portal public keys
```

## LTI 1.3 + Deep Linking Flow

1. **Launch Request**: User clicks launch → Platform initiates OIDC
2. **OIDC Handshake**: Tool ↔ Platform authentication with state/nonce
3. **JWT Verification**: Platform signs JWT, tool verifies with JWKS
4. **OAuth Flow**: Deep linking triggers OAuth authorization code flow
5. **Token Exchange**: Dev portal exchanges code for access token
6. **Deep Link Creation**: Tool creates content, signs JWT response
7. **Content Storage**: Platform stores deep link items
8. **Item Launch**: Stored items can be launched as regular LTI resources

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

## Development Features

- **Color-coded Logging**: Blue (Platform), Green (Tool), Magenta (Dev Portal)
- **Modular Architecture**: Route-based organization for maintainability
- **Production Patterns**: Follows real Blackboard Learn URL structures
- **Comprehensive Error Handling**: Detailed error messages and validation
- **Interactive UIs**: Rich interfaces for testing all LTI Advantage services

## Testing Scenarios

- **Security**: JWT validation, state/nonce verification, JWKS rotation
- **Deep Linking**: Content creation, storage, and subsequent launches
- **NRPS**: Membership retrieval, role-based features, analytics
- **AGS**: Grade management, score submission, results retrieval
- **OAuth**: Authorization flows, token exchange, scoped access
- **Error Handling**: Invalid tokens, missing parameters, network failures

## Requirements

- Node.js 16+
- npm or yarn

## License

MIT