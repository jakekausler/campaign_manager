# TICKET-004: Authentication & Authorization System

## Status

- [ ] Completed
- **Commits**:

## Description

Implement a complete authentication and role-based access control (RBAC) system using JWT tokens, with support for multiple user roles (Owner, GM, Player, Viewer) and fine-grained permissions.

## Scope of Work

1. Implement JWT authentication strategy in NestJS:
   - Login/register endpoints
   - JWT token generation and validation
   - Refresh token mechanism
   - Password hashing with bcrypt (10-12 rounds)
   - Password validation (min 8 chars, 1 symbol, 1 number, check against common passwords)
2. Create RBAC system with multi-campaign support:
   - Define roles: Owner, GM (Game Master), Player, Viewer
   - Per-campaign role assignments (users can have different roles in different campaigns)
   - Permission model for campaigns/resources
   - Guards for route protection
   - Decorators for role/permission checks
3. Implement user management:
   - User CRUD operations
   - Password reset flow (email verification deferred to post-MVP)
   - Campaign membership management
4. Add authorization middleware:
   - Request context with user info and campaign memberships
   - Campaign membership checks
   - Resource ownership validation
5. Create auth module with services:
   - AuthService (login, register, validate)
   - UsersService (user CRUD)
   - PermissionsService (check permissions per campaign)
   - CampaignMembershipService (manage user-campaign associations)
6. Set up Passport.js strategies:
   - Local strategy (username/password)
   - JWT strategy (token validation)
7. Implement API key authentication:
   - Generate API keys for external integrations
   - API key CRUD operations
   - API key validation strategy
   - Scope/permission limitations for API keys
   - Rate limiting per API key

## Acceptance Criteria

- [ ] Users can register with email/password
- [ ] Password validation enforces requirements (8+ chars, 1 symbol, 1 number)
- [ ] Weak/common passwords are rejected
- [ ] Users can login and receive JWT token (15m expiration)
- [ ] Refresh token flow works correctly (7d expiration)
- [ ] JWT tokens are validated on protected routes
- [ ] Role-based access control prevents unauthorized access
- [ ] Users can belong to multiple campaigns with different roles
- [ ] Campaign owners can manage campaign permissions
- [ ] GMs have read-write access to campaign data
- [ ] Players have read-only access (configurable)
- [ ] Viewers have limited read access
- [ ] Passwords are securely hashed (bcrypt with salt)
- [ ] Auth errors return appropriate HTTP status codes
- [ ] API keys can be generated and validated
- [ ] API key authentication works for external integrations
- [ ] API keys respect scope/permission limitations
- [ ] Rate limiting works per API key

## Technical Notes

### Role Hierarchy

```
Owner (campaign creator)
  - Full control over campaign
  - Can delete campaign
  - Can manage user permissions

GM (Game Master)
  - Read/write access to all campaign data
  - Cannot delete campaign
  - Cannot manage permissions

Player
  - Read access to "available" content
  - Can edit own character
  - Cannot modify world/campaign data

Viewer
  - Read-only access to public content
  - No edit permissions
```

### JWT Payload Structure

```typescript
interface JwtPayload {
  sub: string; // user ID
  email: string;
  iat: number;
  exp: number;
  // Campaign roles loaded separately on demand for scalability
}

interface CampaignMembership {
  id: string;
  userId: string;
  campaignId: string;
  role: 'owner' | 'gm' | 'player' | 'viewer';
  permissions: string[];
  createdAt: DateTime;
}

// User can have multiple campaign memberships
interface UserCampaigns {
  userId: string;
  memberships: CampaignMembership[];
}
```

### NestJS Guard Example

```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    return requiredRoles.some(role => user.roles?.includes(role));
  }
}

// Usage
@Roles('owner', 'gm')
@UseGuards(JwtAuthGuard, RolesGuard)
async updateCampaign() { ... }
```

### Security Considerations

- Hash passwords with bcrypt (10-12 rounds)
- Use secure JWT secrets (256-bit minimum)
- Implement rate limiting on auth endpoints
- Set JWT expiration (15m access, 7d refresh)
- Store refresh tokens securely (HttpOnly cookies or database)
- Implement logout (token revocation via Redis blacklist)
- Password validation:
  - Minimum 8 characters
  - At least 1 symbol
  - At least 1 number
  - Check against list of common passwords (e.g., using `common-password-checker` library)

### API Key Authentication

```typescript
interface ApiKey {
  id: string;
  userId: string;
  key: string; // hashed
  name: string; // user-defined name
  scopes: string[]; // e.g., ['read:campaigns', 'write:events']
  campaignId?: string; // optional: limit to specific campaign
  expiresAt?: DateTime;
  lastUsedAt?: DateTime;
  createdAt: DateTime;
}

// API key format: camp_sk_<random_32_chars>
// Store hashed version in database
// Validate via API key strategy (separate from JWT)
```

### Multi-Campaign Support

- `CampaignMembership` table links users to campaigns with roles
- Users query their accessible campaigns: `GET /api/users/me/campaigns`
- Campaign context required for most operations
- Guards check: `user.hasRole(campaignId, ['owner', 'gm'])`

## Architectural Decisions

- **JWT vs Sessions**: JWT for stateless auth, suitable for API-first design
- **Token storage**: Access token in memory, refresh token in HttpOnly cookie
- **Token expiration**: 15m access token, 7d refresh token
- **Password policy**: 8+ chars, 1 symbol, 1 number, no common passwords
- **OAuth integration**: Deferred to post-MVP
- **Email verification**: Deferred to post-MVP
- **Multi-tenancy**: Full support - users can belong to multiple campaigns
- **API keys**: Supported for external integrations with scope limitations

## Dependencies

- Requires: TICKET-002 (Docker with Redis for token blacklist)
- Requires: TICKET-003 (User, Role, Permission, CampaignMembership models)

## Testing Requirements

- [ ] Register new user successfully
- [ ] Weak passwords are rejected (too short, no symbol, no number, common password)
- [ ] Login with valid credentials returns JWT
- [ ] Login with invalid credentials returns 401
- [ ] Access token expires after 15 minutes
- [ ] Refresh token expires after 7 days
- [ ] Protected routes reject requests without token
- [ ] Protected routes reject expired tokens
- [ ] Refresh token flow generates new access token
- [ ] RBAC prevents unauthorized role access
- [ ] User can belong to multiple campaigns with different roles
- [ ] Campaign permissions are enforced correctly per campaign
- [ ] Password hashing is not reversible
- [ ] Rate limiting prevents brute force attacks
- [ ] API key can be generated
- [ ] API key authentication works
- [ ] API key scopes are enforced
- [ ] Expired API keys are rejected

## Related Tickets

- Requires: TICKET-002, TICKET-003
- Blocks: TICKET-005

## Estimated Effort

3-4 days
