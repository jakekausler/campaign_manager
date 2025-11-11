import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';

import { ApiKeyService } from '../services/api-key.service';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'api-key') {
  constructor(private apiKeyService: ApiKeyService) {
    super();
  }

  async validate(req: { headers: Record<string, string | undefined> }): Promise<{
    id: string;
    email: string;
    role: string;
  }> {
    // Extract API key from header
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException('API key is missing');
    }

    try {
      const result = await this.apiKeyService.validate(apiKey);

      // Return flat object matching AuthenticatedUser interface
      // This allows GraphQL context factory to work correctly
      return {
        id: result.user.id,
        email: result.user.email,
        role: 'service', // Special role for service accounts using API keys
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid API key');
    }
  }
}
