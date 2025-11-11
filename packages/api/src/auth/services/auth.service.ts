/**
 * @file Authentication Service
 * @description
 * Core authentication service providing JWT-based authentication workflows including user registration,
 * login, token refresh, and logout operations. Implements secure token management with refresh token
 * rotation and database-backed token validation.
 *
 * Security Features:
 * - JWT access tokens with 15-minute expiration
 * - Refresh tokens with 7-day expiration, stored hashed in database
 * - Refresh token rotation on each use (new tokens generated)
 * - Support for device-specific logout and logout from all devices
 * - Password strength validation on registration
 * - Bcrypt password hashing with automatic salt generation
 *
 * Token Flow:
 * 1. User logs in → receives access token (15min) and refresh token (7d)
 * 2. Access token expires → client uses refresh token to get new token pair
 * 3. Refresh token is validated against hashed tokens in database
 * 4. New access and refresh tokens are generated (token rotation)
 * 5. Old refresh token can be revoked on logout
 *
 * @module api/auth
 */

import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '../../database/prisma.service';
import { RegisterDto } from '../dto';
import { AuthTokens, JwtPayload } from '../interfaces/jwt-payload.interface';
import { hashPassword, comparePassword, validatePasswordStrength } from '../utils/password.util';

import { UsersService } from './users.service';

/**
 * Authentication service handling user registration, login, token management, and logout operations.
 *
 * This service provides comprehensive JWT-based authentication with the following features:
 * - User registration with password strength validation
 * - Login with credential validation
 * - Access token generation (15-minute expiration)
 * - Refresh token generation and rotation (7-day expiration)
 * - Secure refresh token storage (hashed in database)
 * - Single-device logout (revokes specific refresh token)
 * - Multi-device logout (revokes all user refresh tokens)
 *
 * Security Considerations:
 * - All passwords are hashed using bcrypt before storage
 * - Refresh tokens are hashed before database storage
 * - Token validation includes expiration and revocation checks
 * - Failed authentication attempts return generic error messages
 * - JWT signing uses HS256 algorithm with secret from environment
 *
 * @example Basic login flow
 * ```typescript
 * // Validate credentials
 * const user = await authService.validateUser(email, password);
 * if (!user) {
 *   throw new UnauthorizedException('Invalid credentials');
 * }
 *
 * // Generate tokens
 * const tokens = await authService.login(user);
 * // Returns: { accessToken: string, refreshToken: string }
 * ```
 *
 * @example Token refresh flow
 * ```typescript
 * // When access token expires, use refresh token
 * const newTokens = await authService.refreshAccessToken(refreshToken);
 * // Returns new token pair (refresh token rotation)
 * ```
 *
 * @example Logout flow
 * ```typescript
 * // Single device logout
 * await authService.logout(userId, refreshToken);
 *
 * // Logout from all devices
 * await authService.logoutAllDevices(userId);
 * ```
 */
@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService
  ) {}

  /**
   * Registers a new user account with email, password, and name.
   *
   * Performs the following operations:
   * 1. Validates password strength (minimum 8 characters, complexity requirements)
   * 2. Checks for existing user with the same email
   * 3. Hashes the password using bcrypt
   * 4. Creates the user record in the database
   * 5. Generates access and refresh tokens for immediate login
   *
   * Password Requirements:
   * - Minimum 8 characters
   * - Must contain at least one uppercase letter
   * - Must contain at least one lowercase letter
   * - Must contain at least one number
   * - Must contain at least one special character
   *
   * Security Notes:
   * - Password is hashed with bcrypt before database storage
   * - Original password is never stored or logged
   * - Refresh token is hashed before database storage
   * - User is automatically logged in after successful registration
   *
   * @param registerDto - Registration data containing email, password, and optional name
   * @param registerDto.email - User's email address (must be unique)
   * @param registerDto.password - User's password (must meet strength requirements)
   * @param registerDto.name - User's display name (optional)
   *
   * @returns Promise resolving to access and refresh token pair
   *
   * @throws {BadRequestException} If password does not meet strength requirements
   * @throws {BadRequestException} If user with email already exists
   * @throws {Error} If database operation fails
   *
   * @example
   * ```typescript
   * const tokens = await authService.register({
   *   email: 'user@example.com',
   *   password: 'SecurePass123!',
   *   name: 'John Doe'
   * });
   * // Returns: { accessToken: '...', refreshToken: '...' }
   * ```
   */
  async register(registerDto: RegisterDto): Promise<AuthTokens> {
    const { email, password, name } = registerDto;

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      throw new BadRequestException(passwordValidation.errors);
    }

    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await this.usersService.create({
      email,
      password: hashedPassword,
      name,
    });

    // Generate tokens
    return this.login(user);
  }

  /**
   * Validates user credentials by checking email and password.
   *
   * This method is typically called by authentication strategies (e.g., LocalStrategy)
   * to verify user credentials during login. It performs the following steps:
   * 1. Looks up user by email address
   * 2. Compares provided password with stored hashed password using bcrypt
   * 3. Returns user data (excluding password) if credentials are valid
   * 4. Returns null if credentials are invalid
   *
   * Security Notes:
   * - Returns null for both "user not found" and "invalid password" cases
   *   to prevent user enumeration attacks
   * - Uses constant-time comparison via bcrypt to prevent timing attacks
   * - Never returns the password hash in the result
   * - Does not throw exceptions - caller is responsible for error handling
   *
   * @param email - User's email address to validate
   * @param password - Plain text password to verify
   *
   * @returns Promise resolving to user object (without password) if valid, null if invalid
   *
   * @example
   * ```typescript
   * const user = await authService.validateUser('user@example.com', 'password123');
   * if (!user) {
   *   throw new UnauthorizedException('Invalid credentials');
   * }
   * // user = { id: '...', email: '...', name: '...' }
   * ```
   */
  async validateUser(
    email: string,
    password: string
  ): Promise<{ id: string; email: string; name: string } | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return null;
    }

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...result } = user;
    return result;
  }

  /**
   * Generates JWT access and refresh tokens for an authenticated user.
   *
   * This method is called after successful credential validation to issue a token pair
   * that allows the user to access protected resources. It performs the following:
   * 1. Creates JWT payload with user ID, email, and timestamps
   * 2. Signs access token with 15-minute expiration
   * 3. Signs refresh token with 7-day expiration
   * 4. Hashes and stores refresh token in database for validation
   * 5. Returns both tokens to the client
   *
   * Token Details:
   * - Access Token: Short-lived (15 minutes), contains full JWT payload
   * - Refresh Token: Long-lived (7 days), contains only user ID
   * - Both tokens are signed with HS256 algorithm using JWT_SECRET
   *
   * JWT Payload Structure:
   * - sub: User ID (subject)
   * - email: User's email address
   * - iat: Issued at timestamp (seconds since epoch)
   * - exp: Expiration timestamp (seconds since epoch)
   *
   * Security Notes:
   * - Refresh token is hashed with bcrypt before database storage
   * - Each login creates a new refresh token (supports multiple devices)
   * - Expired tokens are not automatically cleaned up (requires periodic cleanup)
   * - Client should store tokens securely (httpOnly cookies or secure storage)
   *
   * @param user - Authenticated user object containing id and email
   * @param user.id - Unique user identifier (UUID)
   * @param user.email - User's email address
   *
   * @returns Promise resolving to object containing access and refresh tokens
   *
   * @throws {Error} If token generation fails
   * @throws {Error} If database operation fails
   *
   * @example
   * ```typescript
   * const user = { id: 'uuid-123', email: 'user@example.com' };
   * const tokens = await authService.login(user);
   * // Returns: {
   * //   accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
   * //   refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
   * // }
   * ```
   */
  async login(user: { id: string; email: string }): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      iat: Math.floor(Date.now() / 1000),
    };

    // Generate access token (15 minutes)
    // Note: Do not set `exp` manually in payload when using `expiresIn` option
    // to avoid "Bad options.expiresIn" errors. The `exp` field is set automatically.
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(
      { sub: user.id },
      {
        expiresIn: '7d',
      }
    );

    // Store hashed refresh token in database
    const hashedRefreshToken = await hashPassword(refreshToken);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: hashedRefreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * Refreshes expired access token using a valid refresh token (token rotation).
   *
   * This method implements the OAuth 2.0 refresh token flow with token rotation for
   * enhanced security. When an access token expires, the client can use their refresh
   * token to obtain a new token pair without re-entering credentials. The process:
   * 1. Verifies refresh token JWT signature and expiration
   * 2. Extracts user ID from token payload
   * 3. Validates user still exists in database
   * 4. Retrieves all non-expired, non-revoked refresh tokens for the user
   * 5. Compares provided token against stored hashed tokens
   * 6. Generates new access and refresh tokens (token rotation)
   * 7. Stores new hashed refresh token in database
   *
   * Token Rotation:
   * - Each refresh operation generates a new token pair
   * - Old refresh token remains valid until expiration or revocation
   * - This allows multiple devices to refresh independently
   * - Old tokens can be revoked during logout
   *
   * Security Notes:
   * - Verifies JWT signature to prevent token tampering
   * - Checks expiration timestamp to prevent expired token use
   * - Validates against database to detect revoked tokens
   * - Uses bcrypt comparison to verify token matches stored hash
   * - Generic error message prevents information leakage
   * - Each refresh creates new tokens (limits token lifetime)
   *
   * Error Handling:
   * - All errors (invalid, expired, revoked) return same error message
   * - This prevents attackers from distinguishing error types
   * - Malformed JWTs are caught and converted to generic error
   *
   * @param refreshToken - JWT refresh token to validate and use for token generation
   *
   * @returns Promise resolving to new access and refresh token pair
   *
   * @throws {UnauthorizedException} If token is invalid, expired, revoked, or user not found
   *
   * @example
   * ```typescript
   * try {
   *   const newTokens = await authService.refreshAccessToken(oldRefreshToken);
   *   // Returns: { accessToken: '...', refreshToken: '...' }
   *   // Client should replace old tokens with new ones
   * } catch (error) {
   *   // Token invalid - redirect to login
   *   throw new UnauthorizedException('Please log in again');
   * }
   * ```
   */
  async refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const user = await this.usersService.findById(payload.sub);

      if (!user) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Find valid refresh token in database
      const storedTokens = await this.prisma.refreshToken.findMany({
        where: {
          userId: user.id,
          expiresAt: {
            gt: new Date(),
          },
          revokedAt: null,
        },
      });

      // Verify refresh token matches one of the stored tokens
      let isValidToken = false;
      for (const storedToken of storedTokens) {
        const isMatch = await comparePassword(refreshToken, storedToken.token);
        if (isMatch) {
          isValidToken = true;
          break;
        }
      }

      if (!isValidToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new tokens
      return this.login(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Logs out user from current device by revoking the specific refresh token.
   *
   * This method implements single-device logout by finding and revoking only the
   * refresh token used for the current session. Other devices remain logged in
   * with their own refresh tokens. The process:
   * 1. Retrieves all non-revoked refresh tokens for the user
   * 2. Compares provided token against stored hashed tokens using bcrypt
   * 3. Marks matching token as revoked with current timestamp
   * 4. Stops after first match (each token is unique)
   *
   * Token Revocation:
   * - Revoked tokens remain in database with revokedAt timestamp
   * - Revoked tokens cannot be used for token refresh
   * - Other valid refresh tokens (other devices) remain active
   * - Access token continues working until natural expiration (15 min)
   *
   * Security Notes:
   * - Only revokes the specific token provided (device-specific logout)
   * - Uses bcrypt comparison to identify correct token
   * - Does not throw error if token not found (silent failure)
   * - Client should discard access token immediately after logout
   * - Access token remains valid until expiration (consider token blacklist for immediate invalidation)
   *
   * Limitations:
   * - Access token remains valid until expiration
   * - For immediate access token invalidation, implement token blacklist
   * - Refresh token remains in database after revocation (periodic cleanup recommended)
   *
   * @param userId - Unique identifier of the user logging out
   * @param refreshToken - Refresh token to revoke (from current device)
   *
   * @returns Promise that resolves when logout is complete
   *
   * @example
   * ```typescript
   * // Get user ID and refresh token from authenticated request
   * await authService.logout(req.user.id, req.body.refreshToken);
   * // User is logged out from current device only
   * // Other devices remain logged in
   * ```
   */
  async logout(userId: string, refreshToken: string): Promise<void> {
    // Find and revoke the refresh token
    const storedTokens = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
      },
    });

    for (const storedToken of storedTokens) {
      const isMatch = await comparePassword(refreshToken, storedToken.token);
      if (isMatch) {
        await this.prisma.refreshToken.update({
          where: { id: storedToken.id },
          data: { revokedAt: new Date() },
        });
        break;
      }
    }
  }

  /**
   * Logs out user from all devices by revoking all their refresh tokens.
   *
   * This method implements global logout functionality, revoking all refresh tokens
   * associated with the user. This is useful for security scenarios such as:
   * - User reports compromised account
   * - User changes password and wants to logout everywhere
   * - User wants to end all active sessions
   * - Administrator forces user logout
   *
   * The process:
   * 1. Finds all non-revoked refresh tokens for the user
   * 2. Updates all tokens with current timestamp in revokedAt field
   * 3. Uses updateMany for efficient bulk update
   *
   * Effects:
   * - All refresh tokens become invalid immediately
   * - User cannot refresh access tokens on any device
   * - All devices must re-authenticate to continue using the application
   * - Access tokens remain valid until natural expiration (up to 15 minutes)
   *
   * Security Notes:
   * - Provides nuclear option for account security
   * - Does not immediately invalidate access tokens (they expire naturally)
   * - For immediate access token invalidation, implement token blacklist
   * - Consider notifying user via email when this action is performed
   * - Useful after password change or suspicious activity detection
   *
   * Use Cases:
   * - Password change → force re-login on all devices
   * - Account compromise → immediately invalidate all sessions
   * - User request → "logout everywhere" feature
   * - Admin action → suspend user access
   *
   * Limitations:
   * - Access tokens remain valid for up to 15 minutes
   * - For immediate effect, implement real-time token blacklist
   * - Tokens remain in database with revocation timestamp
   *
   * @param userId - Unique identifier of the user to logout from all devices
   *
   * @returns Promise that resolves when all tokens are revoked
   *
   * @example
   * ```typescript
   * // After password change
   * await authService.logoutAllDevices(userId);
   * // All devices are logged out, user must re-authenticate
   *
   * // After detecting suspicious activity
   * if (suspiciousActivity) {
   *   await authService.logoutAllDevices(userId);
   *   await emailService.sendSecurityAlert(user.email);
   * }
   * ```
   */
  async logoutAllDevices(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }
}
