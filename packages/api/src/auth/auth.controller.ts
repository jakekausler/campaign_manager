import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Get,
  Delete,
  Param,
} from '@nestjs/common';

import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { RegisterDto, RefreshTokenDto } from './dto';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { ApiKeyService } from './services/api-key.service';
import { AuthService } from './services/auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private apiKeyService: ApiKeyService
  ) {}

  @Public()
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Request() req: { user: { id: string; email: string } }) {
    return this.authService.login(req.user);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshAccessToken(refreshTokenDto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: { id: string }, @Body('refreshToken') refreshToken: string) {
    await this.authService.logout(user.id, refreshToken);
    return { message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(@CurrentUser() user: { id: string }) {
    await this.authService.logoutAllDevices(user.id);
    return { message: 'Logged out from all devices' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('me')
  @HttpCode(HttpStatus.OK)
  async getProfile(@CurrentUser() user: { id: string; email: string }) {
    return user;
  }

  // API Key endpoints
  @UseGuards(JwtAuthGuard)
  @Post('api-keys')
  async createApiKey(
    @CurrentUser() user: { id: string },
    @Body() createApiKeyDto: CreateApiKeyDto
  ) {
    return this.apiKeyService.create({
      userId: user.id,
      name: createApiKeyDto.name,
      scopes: createApiKeyDto.scopes,
      campaignId: createApiKeyDto.campaignId,
      expiresAt: createApiKeyDto.expiresAt ? new Date(createApiKeyDto.expiresAt) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('api-keys')
  async listApiKeys(@CurrentUser() user: { id: string }) {
    return this.apiKeyService.getUserApiKeys(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('api-keys/:id')
  @HttpCode(HttpStatus.OK)
  async revokeApiKey(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    await this.apiKeyService.revoke(id, user.id);
    return { message: 'API key revoked successfully' };
  }
}
