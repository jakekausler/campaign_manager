import * as crypto from 'crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { hashPassword, comparePassword } from '../utils/password.util';

export interface CreateApiKeyData {
  userId: string;
  name: string;
  scopes: string[];
  campaignId?: string;
  expiresAt?: Date;
}

@Injectable()
export class ApiKeyService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate a new API key
   * Format: camp_sk_<32_random_characters>
   */
  private generateApiKey(): string {
    const randomBytes = crypto.randomBytes(24);
    const randomString = randomBytes.toString('base64url').substring(0, 32);
    return `camp_sk_${randomString}`;
  }

  /**
   * Create a new API key
   */
  async create(data: CreateApiKeyData): Promise<{ id: string; key: string; name: string }> {
    const apiKey = this.generateApiKey();
    const hashedKey = await hashPassword(apiKey);

    const created = await this.prisma.apiKey.create({
      data: {
        userId: data.userId,
        name: data.name,
        key: hashedKey,
        scopes: data.scopes,
        campaignId: data.campaignId,
        expiresAt: data.expiresAt,
      },
    });

    // Return the plain API key only once (user must save it)
    return {
      id: created.id,
      key: apiKey,
      name: created.name,
    };
  }

  /**
   * Validate an API key and return the associated user
   */
  async validate(apiKey: string): Promise<{
    user: { id: string; email: string; name: string };
    apiKey: { id: string; scopes: unknown; campaignId: string | null };
  }> {
    if (!apiKey.startsWith('camp_sk_')) {
      throw new UnauthorizedException('Invalid API key format');
    }

    // Find all non-revoked API keys
    const keys = await this.prisma.apiKey.findMany({
      where: {
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    // Check if the provided key matches any stored key
    for (const storedKey of keys) {
      const isMatch = await comparePassword(apiKey, storedKey.key);
      if (isMatch) {
        // Update last used timestamp
        await this.prisma.apiKey.update({
          where: { id: storedKey.id },
          data: { lastUsedAt: new Date() },
        });

        return {
          user: storedKey.user,
          apiKey: {
            id: storedKey.id,
            scopes: storedKey.scopes,
            campaignId: storedKey.campaignId,
          },
        };
      }
    }

    throw new UnauthorizedException('Invalid API key');
  }

  /**
   * Get all API keys for a user (without the actual keys)
   */
  async getUserApiKeys(userId: string) {
    return this.prisma.apiKey.findMany({
      where: {
        userId,
        revokedAt: null,
      },
      select: {
        id: true,
        name: true,
        scopes: true,
        campaignId: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
  }

  /**
   * Revoke an API key
   */
  async revoke(id: string, userId: string) {
    return this.prisma.apiKey.updateMany({
      where: {
        id,
        userId, // Ensure user owns the key
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Check if API key has a specific scope
   */
  hasScope(scopes: unknown, requiredScope: string): boolean {
    let scopeArray: string[];
    if (!Array.isArray(scopes)) {
      scopeArray = JSON.parse(scopes as string) as string[];
    } else {
      scopeArray = scopes;
    }
    return scopeArray.includes(requiredScope);
  }
}
