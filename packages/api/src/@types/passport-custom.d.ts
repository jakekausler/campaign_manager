declare module 'passport-custom' {
  export interface StrategyOptions {
    passReqToCallback?: boolean;
  }

  export type VerifyFunction = (
    req: unknown,
    done: (error: Error | null, user?: unknown, info?: unknown) => void
  ) => void | Promise<unknown>;

  export class Strategy {
    constructor(verify: VerifyFunction);
    constructor(options: StrategyOptions, verify: VerifyFunction);
    name: string;
    authenticate(req: unknown, options?: unknown): void;
  }
}
