import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';

import { ApiKeyService } from '../services/api-key.service';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'api-key') {
  constructor(private apiKeyService: ApiKeyService) {
    super();
  }

  async validate(req: { headers: Record<string, string | undefined> }): Promise<unknown> {
    // Extract API key from header
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException('API key is missing');
    }

    try {
      const result = await this.apiKeyService.validate(apiKey);
      return result; // This will be attached to req.user
    } catch (error) {
      throw new UnauthorizedException('Invalid API key');
    }
  }
}
