export interface JwtPayload {
  sub: string; // user ID
  email: string;
  iat: number;
  exp?: number; // Optional - automatically added by JWT library when using expiresIn
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserFromJwt {
  id: string;
  email: string;
}
