import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';
import * as passwordUtil from '../utils/password.util';

import { AuthService } from './auth.service';
import { UsersService } from './users.service';

jest.mock('../utils/password.util');

describe('AuthService', () => {
  let service: AuthService;

  const mockUsersService = {
    findByEmail: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockPrismaService = {
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user with valid password', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'MyP@ssw0rd1',
        name: 'Test User',
      };

      (passwordUtil.validatePasswordStrength as jest.Mock).mockReturnValue({
        isValid: true,
        errors: [],
      });
      (passwordUtil.hashPassword as jest.Mock).mockResolvedValue('hashedPassword');

      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue({
        id: '1',
        email: registerDto.email,
        name: registerDto.name,
        password: 'hashedPassword',
      });

      mockJwtService.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');
      (passwordUtil.hashPassword as jest.Mock).mockResolvedValue('hashed-refresh-token');
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockUsersService.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException if password is weak', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'weak',
        name: 'Test User',
      };

      (passwordUtil.validatePasswordStrength as jest.Mock).mockReturnValue({
        isValid: false,
        errors: ['Password must be at least 8 characters long'],
      });

      await expect(service.register(registerDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if email already exists', async () => {
      const registerDto = {
        email: 'existing@example.com',
        password: 'MyP@ssw0rd1',
        name: 'Test User',
      };

      (passwordUtil.validatePasswordStrength as jest.Mock).mockReturnValue({
        isValid: true,
        errors: [],
      });

      mockUsersService.findByEmail.mockResolvedValue({
        id: '1',
        email: registerDto.email,
      });

      await expect(service.register(registerDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateUser', () => {
    it('should return user without password if credentials are valid', async () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        password: 'hashedPassword',
        name: 'Test User',
      };

      mockUsersService.findByEmail.mockResolvedValue(user);
      (passwordUtil.comparePassword as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'correctPassword');

      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      if (result) {
        expect(result).not.toHaveProperty('password');
        expect(result.email).toBe('test@example.com');
        expect(result.id).toBe('1');
        expect(result.name).toBe('Test User');
      }
    });

    it('should return null if user not found', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      const result = await service.validateUser('nonexistent@example.com', 'password');

      expect(result).toBeNull();
    });

    it('should return null if password is incorrect', async () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        password: 'hashedPassword',
        name: 'Test User',
      };

      mockUsersService.findByEmail.mockResolvedValue(user);
      (passwordUtil.comparePassword as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser('test@example.com', 'wrongPassword');

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return access and refresh tokens', async () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
      };

      mockJwtService.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');
      (passwordUtil.hashPassword as jest.Mock).mockResolvedValue('hashed-refresh-token');
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.login(user);

      expect(result).toHaveProperty('accessToken', 'access-token');
      expect(result).toHaveProperty('refreshToken', 'refresh-token');
    });
  });
});
