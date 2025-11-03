/**
 * VariableSchemaService Tests
 * Tests for typed variable schema management and validation
 */

import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Party, Kingdom, Settlement, Structure, Campaign, Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import type { VariableSchema } from '../types/variable-schema.types';

import { AuditService } from './audit.service';
import { VariableSchemaService } from './variable-schema.service';

/**
 * Type definitions for test data with variable schema fields
 */
type PartialCampaign = Pick<Campaign, 'id' | 'ownerId'>;

type PartyWithSchemas = Party & {
  variableSchemas: Prisma.JsonValue;
};

type KingdomWithSchemas = Kingdom & {
  variableSchemas: Prisma.JsonValue;
};

type SettlementWithSchemas = Settlement & {
  variableSchemas: Prisma.JsonValue;
};

type StructureWithSchemas = Structure & {
  variableSchemas: Prisma.JsonValue;
};

type SettlementWithKingdom = Settlement & {
  kingdom: Pick<Kingdom, 'id' | 'campaignId'>;
};

describe('VariableSchemaService', () => {
  let service: VariableSchemaService;
  let prisma: PrismaService;
  let audit: AuditService;

  const mockUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'test@example.com',
    role: 'user',
  };

  const mockParty: Party = {
    id: 'party-1',
    campaignId: 'campaign-1',
    name: 'Test Party',
    averageLevel: 5,
    manualLevelOverride: null,
    variables: {},
    variableSchemas: [],
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    archivedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VariableSchemaService,
        {
          provide: PrismaService,
          useValue: {
            party: {
              findFirst: jest.fn(),
              update: jest.fn(),
            },
            kingdom: {
              findFirst: jest.fn(),
              update: jest.fn(),
            },
            settlement: {
              findFirst: jest.fn(),
              update: jest.fn(),
            },
            structure: {
              findFirst: jest.fn(),
              update: jest.fn(),
            },
            campaign: {
              findFirst: jest.fn(),
            },
          },
        },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<VariableSchemaService>(VariableSchemaService);
    prisma = module.get<PrismaService>(PrismaService);
    audit = module.get<AuditService>(AuditService);
  });

  describe('validateVariableValue', () => {
    it('should validate string type', () => {
      const schema: VariableSchema = {
        name: 'motto',
        type: 'string',
        description: 'Party motto',
      };

      expect(() => service.validateVariableValue(schema, 'For honor!')).not.toThrow();
      expect(() => service.validateVariableValue(schema, 123)).toThrow(BadRequestException);
      expect(() => service.validateVariableValue(schema, true)).toThrow(BadRequestException);
    });

    it('should validate number type', () => {
      const schema: VariableSchema = {
        name: 'gold',
        type: 'number',
        description: 'Gold amount',
      };

      expect(() => service.validateVariableValue(schema, 100)).not.toThrow();
      expect(() => service.validateVariableValue(schema, 0)).not.toThrow();
      expect(() => service.validateVariableValue(schema, -50)).not.toThrow();
      expect(() => service.validateVariableValue(schema, '100')).toThrow(BadRequestException);
      expect(() => service.validateVariableValue(schema, true)).toThrow(BadRequestException);
    });

    it('should validate boolean type', () => {
      const schema: VariableSchema = {
        name: 'isHostile',
        type: 'boolean',
        description: 'Is party hostile',
      };

      expect(() => service.validateVariableValue(schema, true)).not.toThrow();
      expect(() => service.validateVariableValue(schema, false)).not.toThrow();
      expect(() => service.validateVariableValue(schema, 'true')).toThrow(BadRequestException);
      expect(() => service.validateVariableValue(schema, 1)).toThrow(BadRequestException);
    });

    it('should validate enum type', () => {
      const schema: VariableSchema = {
        name: 'alignment',
        type: 'enum',
        enumValues: ['good', 'neutral', 'evil'],
        description: 'Party alignment',
      };

      expect(() => service.validateVariableValue(schema, 'good')).not.toThrow();
      expect(() => service.validateVariableValue(schema, 'neutral')).not.toThrow();
      expect(() => service.validateVariableValue(schema, 'evil')).not.toThrow();
      expect(() => service.validateVariableValue(schema, 'chaotic')).toThrow(BadRequestException);
      expect(() => service.validateVariableValue(schema, 123)).toThrow(BadRequestException);
    });

    it('should throw error for enum type without enumValues', () => {
      const schema: VariableSchema = {
        name: 'status',
        type: 'enum',
        description: 'Status',
      };

      expect(() => service.validateVariableValue(schema, 'active')).toThrow(BadRequestException);
    });
  });

  describe('defineSchema', () => {
    it('should define a new schema for party', async () => {
      const schema: VariableSchema = {
        name: 'gold',
        type: 'number',
        description: 'Party gold',
        defaultValue: 0,
      };

      jest.spyOn(prisma.party, 'findFirst').mockResolvedValue(mockParty);
      const mockCampaign: PartialCampaign = {
        id: 'campaign-1',
        ownerId: 'user-1',
      };
      jest.spyOn(prisma.campaign, 'findFirst').mockResolvedValue(mockCampaign as Campaign);
      const updatedParty: PartyWithSchemas = {
        ...mockParty,
        variableSchemas: [schema] as unknown as Prisma.JsonValue,
      };
      jest.spyOn(prisma.party, 'update').mockResolvedValue(updatedParty as Party);

      await service.defineSchema('party', 'party-1', schema, mockUser);

      expect(prisma.party.update).toHaveBeenCalledWith({
        where: { id: 'party-1' },
        data: {
          variableSchemas: [schema] as unknown as Prisma.JsonValue,
        },
      });
      expect(audit.log).toHaveBeenCalledWith('party', 'party-1', 'UPDATE', 'user-1', {
        defineSchema: schema,
      });
    });

    it('should replace existing schema with same name', async () => {
      const existingSchema: VariableSchema = {
        name: 'gold',
        type: 'number',
        description: 'Old description',
      };

      const newSchema: VariableSchema = {
        name: 'gold',
        type: 'number',
        description: 'New description',
        defaultValue: 100,
      };

      const partyWithSchema: PartyWithSchemas = {
        ...mockParty,
        variableSchemas: [existingSchema] as unknown as Prisma.JsonValue,
      };

      jest.spyOn(prisma.party, 'findFirst').mockResolvedValue(partyWithSchema as Party);
      const mockCampaign: PartialCampaign = {
        id: 'campaign-1',
        ownerId: 'user-1',
      };
      jest.spyOn(prisma.campaign, 'findFirst').mockResolvedValue(mockCampaign as Campaign);
      const updatedParty: PartyWithSchemas = {
        ...mockParty,
        variableSchemas: [newSchema] as unknown as Prisma.JsonValue,
      };
      jest.spyOn(prisma.party, 'update').mockResolvedValue(updatedParty as Party);

      await service.defineSchema('party', 'party-1', newSchema, mockUser);

      expect(prisma.party.update).toHaveBeenCalledWith({
        where: { id: 'party-1' },
        data: {
          variableSchemas: [newSchema],
        },
      });
    });

    it('should throw NotFoundException for non-existent entity', async () => {
      jest.spyOn(prisma.party, 'findFirst').mockResolvedValue(null);

      const schema: VariableSchema = {
        name: 'gold',
        type: 'number',
      };

      await expect(service.defineSchema('party', 'invalid-id', schema, mockUser)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ForbiddenException for unauthorized user', async () => {
      jest.spyOn(prisma.party, 'findFirst').mockResolvedValue(mockParty);
      jest.spyOn(prisma.campaign, 'findFirst').mockResolvedValue(null);

      const schema: VariableSchema = {
        name: 'gold',
        type: 'number',
      };

      await expect(service.defineSchema('party', 'party-1', schema, mockUser)).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  describe('getSchema', () => {
    it('should retrieve existing schema', async () => {
      const schema: VariableSchema = {
        name: 'gold',
        type: 'number',
        description: 'Party gold',
      };

      const partyWithSchema: PartyWithSchemas = {
        ...mockParty,
        variableSchemas: [schema] as unknown as Prisma.JsonValue,
      };

      jest.spyOn(prisma.party, 'findFirst').mockResolvedValue(partyWithSchema as Party);

      const result = await service.getSchema('party', 'party-1', 'gold', mockUser);

      expect(result).toEqual(schema);
    });

    it('should return null for non-existent schema', async () => {
      jest.spyOn(prisma.party, 'findFirst').mockResolvedValue(mockParty);

      const result = await service.getSchema('party', 'party-1', 'nonexistent', mockUser);

      expect(result).toBeNull();
    });

    it('should throw NotFoundException for non-existent entity', async () => {
      jest.spyOn(prisma.party, 'findFirst').mockResolvedValue(null);

      await expect(service.getSchema('party', 'invalid-id', 'gold', mockUser)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('listSchemas', () => {
    it('should list all schemas for entity', async () => {
      const schemas: VariableSchema[] = [
        { name: 'gold', type: 'number' },
        { name: 'motto', type: 'string' },
        { name: 'alignment', type: 'enum', enumValues: ['good', 'neutral', 'evil'] },
      ];

      const partyWithSchemas: PartyWithSchemas = {
        ...mockParty,
        variableSchemas: schemas as unknown as Prisma.JsonValue,
      };

      jest.spyOn(prisma.party, 'findFirst').mockResolvedValue(partyWithSchemas as Party);

      const result = await service.listSchemas('party', 'party-1', mockUser);

      expect(result).toEqual(schemas);
    });

    it('should return empty array when no schemas defined', async () => {
      jest.spyOn(prisma.party, 'findFirst').mockResolvedValue(mockParty);

      const result = await service.listSchemas('party', 'party-1', mockUser);

      expect(result).toEqual([]);
    });
  });

  describe('deleteSchema', () => {
    it('should delete existing schema', async () => {
      const schemas: VariableSchema[] = [
        { name: 'gold', type: 'number' },
        { name: 'motto', type: 'string' },
      ];

      const partyWithSchemas: PartyWithSchemas = {
        ...mockParty,
        variableSchemas: schemas as unknown as Prisma.JsonValue,
      };

      jest.spyOn(prisma.party, 'findFirst').mockResolvedValue(partyWithSchemas as Party);
      const mockCampaign: PartialCampaign = {
        id: 'campaign-1',
        ownerId: 'user-1',
      };
      jest.spyOn(prisma.campaign, 'findFirst').mockResolvedValue(mockCampaign as Campaign);
      const updatedParty: PartyWithSchemas = {
        ...mockParty,
        variableSchemas: [{ name: 'motto', type: 'string' }] as unknown as Prisma.JsonValue,
      };
      jest.spyOn(prisma.party, 'update').mockResolvedValue(updatedParty as Party);

      await service.deleteSchema('party', 'party-1', 'gold', mockUser);

      expect(prisma.party.update).toHaveBeenCalledWith({
        where: { id: 'party-1' },
        data: {
          variableSchemas: [{ name: 'motto', type: 'string' }],
          variables: {},
        },
      });
      expect(audit.log).toHaveBeenCalledWith('party', 'party-1', 'UPDATE', 'user-1', {
        deleteSchema: 'gold',
      });
    });

    it('should throw NotFoundException when schema does not exist', async () => {
      jest.spyOn(prisma.party, 'findFirst').mockResolvedValue(mockParty);
      const mockCampaign: PartialCampaign = {
        id: 'campaign-1',
        ownerId: 'user-1',
      };
      jest.spyOn(prisma.campaign, 'findFirst').mockResolvedValue(mockCampaign as Campaign);

      await expect(
        service.deleteSchema('party', 'party-1', 'nonexistent', mockUser)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('setVariable', () => {
    it('should set variable with valid value', async () => {
      const schema: VariableSchema = {
        name: 'gold',
        type: 'number',
        description: 'Party gold',
      };

      const partyWithSchema: PartyWithSchemas = {
        ...mockParty,
        variableSchemas: [schema] as unknown as Prisma.JsonValue,
        variables: {},
      };

      jest.spyOn(prisma.party, 'findFirst').mockResolvedValue(partyWithSchema as Party);
      const mockCampaign: PartialCampaign = {
        id: 'campaign-1',
        ownerId: 'user-1',
      };
      jest.spyOn(prisma.campaign, 'findFirst').mockResolvedValue(mockCampaign as Campaign);
      const updatedParty: PartyWithSchemas = {
        ...mockParty,
        variables: { gold: 100 },
      };
      jest.spyOn(prisma.party, 'update').mockResolvedValue(updatedParty as Party);

      await service.setVariable('party', 'party-1', 'gold', 100, mockUser);

      expect(prisma.party.update).toHaveBeenCalledWith({
        where: { id: 'party-1' },
        data: {
          variables: { gold: 100 },
        },
      });
      expect(audit.log).toHaveBeenCalledWith('party', 'party-1', 'UPDATE', 'user-1', {
        setVariable: { name: 'gold', value: 100 },
      });
    });

    it('should throw BadRequestException for invalid value type', async () => {
      const schema: VariableSchema = {
        name: 'gold',
        type: 'number',
      };

      const partyWithSchema: PartyWithSchemas = {
        ...mockParty,
        variableSchemas: [schema] as unknown as Prisma.JsonValue,
      };

      jest.spyOn(prisma.party, 'findFirst').mockResolvedValue(partyWithSchema as Party);
      const mockCampaign: PartialCampaign = {
        id: 'campaign-1',
        ownerId: 'user-1',
      };
      jest.spyOn(prisma.campaign, 'findFirst').mockResolvedValue(mockCampaign as Campaign);

      await expect(
        service.setVariable('party', 'party-1', 'gold', 'not-a-number', mockUser)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when schema not defined', async () => {
      jest.spyOn(prisma.party, 'findFirst').mockResolvedValue(mockParty);
      const mockCampaign: PartialCampaign = {
        id: 'campaign-1',
        ownerId: 'user-1',
      };
      jest.spyOn(prisma.campaign, 'findFirst').mockResolvedValue(mockCampaign as Campaign);

      await expect(
        service.setVariable('party', 'party-1', 'undefined-var', 100, mockUser)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getVariable', () => {
    it('should retrieve variable value', async () => {
      const schema: VariableSchema = {
        name: 'gold',
        type: 'number',
      };

      const partyWithVariable: PartyWithSchemas = {
        ...mockParty,
        variableSchemas: [schema] as unknown as Prisma.JsonValue,
        variables: { gold: 100 },
      };

      jest.spyOn(prisma.party, 'findFirst').mockResolvedValue(partyWithVariable as Party);

      const result = await service.getVariable('party', 'party-1', 'gold', mockUser);

      expect(result).toBe(100);
    });

    it('should return default value when variable not set', async () => {
      const schema: VariableSchema = {
        name: 'gold',
        type: 'number',
        defaultValue: 0,
      };

      const partyWithSchema: PartyWithSchemas = {
        ...mockParty,
        variableSchemas: [schema] as unknown as Prisma.JsonValue,
        variables: {},
      };

      jest.spyOn(prisma.party, 'findFirst').mockResolvedValue(partyWithSchema as Party);

      const result = await service.getVariable('party', 'party-1', 'gold', mockUser);

      expect(result).toBe(0);
    });

    it('should return undefined when variable not set and no default', async () => {
      const schema: VariableSchema = {
        name: 'gold',
        type: 'number',
      };

      const partyWithSchema: PartyWithSchemas = {
        ...mockParty,
        variableSchemas: [schema] as unknown as Prisma.JsonValue,
        variables: {},
      };

      jest.spyOn(prisma.party, 'findFirst').mockResolvedValue(partyWithSchema as Party);

      const result = await service.getVariable('party', 'party-1', 'gold', mockUser);

      expect(result).toBeUndefined();
    });

    it('should throw NotFoundException when schema not defined', async () => {
      jest.spyOn(prisma.party, 'findFirst').mockResolvedValue(mockParty);

      await expect(
        service.getVariable('party', 'party-1', 'undefined-var', mockUser)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listVariables', () => {
    it('should list all variables for entity', async () => {
      const schemas: VariableSchema[] = [
        { name: 'gold', type: 'number' },
        { name: 'motto', type: 'string' },
      ];

      const partyWithVariables: PartyWithSchemas = {
        ...mockParty,
        variableSchemas: schemas as unknown as Prisma.JsonValue,
        variables: { gold: 100, motto: 'For honor!' },
      };

      jest.spyOn(prisma.party, 'findFirst').mockResolvedValue(partyWithVariables as Party);

      const result = await service.listVariables('party', 'party-1', mockUser);

      expect(result).toEqual({ gold: 100, motto: 'For honor!' });
    });

    it('should return empty object when no variables set', async () => {
      jest.spyOn(prisma.party, 'findFirst').mockResolvedValue(mockParty);

      const result = await service.listVariables('party', 'party-1', mockUser);

      expect(result).toEqual({});
    });
  });

  describe('multi-entity support', () => {
    it('should work with kingdom entity', async () => {
      const mockKingdom: Kingdom = {
        id: 'kingdom-1',
        campaignId: 'campaign-1',
        name: 'Test Kingdom',
        level: 1,
        variables: {},
        variableSchemas: [],
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        archivedAt: null,
      };

      const schema: VariableSchema = {
        name: 'treasury',
        type: 'number',
      };

      jest.spyOn(prisma.kingdom, 'findFirst').mockResolvedValue(mockKingdom);
      const mockCampaign: PartialCampaign = {
        id: 'campaign-1',
        ownerId: 'user-1',
      };
      jest.spyOn(prisma.campaign, 'findFirst').mockResolvedValue(mockCampaign as Campaign);
      const updatedKingdom: KingdomWithSchemas = {
        ...mockKingdom,
        variableSchemas: [schema] as unknown as Prisma.JsonValue,
      };
      jest.spyOn(prisma.kingdom, 'update').mockResolvedValue(updatedKingdom as Kingdom);

      await service.defineSchema('kingdom', 'kingdom-1', schema, mockUser);

      expect(prisma.kingdom.update).toHaveBeenCalled();
    });

    it('should work with settlement entity', async () => {
      const mockSettlement: Settlement = {
        id: 'settlement-1',
        kingdomId: 'kingdom-1',
        locationId: 'location-1',
        name: 'Test Settlement',
        level: 1,
        variables: {},
        variableSchemas: [],
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        archivedAt: null,
      };

      const schema: VariableSchema = {
        name: 'population',
        type: 'number',
      };

      jest.spyOn(prisma.settlement, 'findFirst').mockResolvedValue(mockSettlement);
      const mockKingdomPartial: Pick<Kingdom, 'id' | 'campaignId'> = {
        id: 'kingdom-1',
        campaignId: 'campaign-1',
      };
      jest.spyOn(prisma.kingdom, 'findFirst').mockResolvedValue(mockKingdomPartial as Kingdom);
      const mockCampaign: PartialCampaign = {
        id: 'campaign-1',
        ownerId: 'user-1',
      };
      jest.spyOn(prisma.campaign, 'findFirst').mockResolvedValue(mockCampaign as Campaign);
      const updatedSettlement: SettlementWithSchemas = {
        ...mockSettlement,
        variableSchemas: [schema] as unknown as Prisma.JsonValue,
      };
      jest.spyOn(prisma.settlement, 'update').mockResolvedValue(updatedSettlement as Settlement);

      await service.defineSchema('settlement', 'settlement-1', schema, mockUser);

      expect(prisma.settlement.update).toHaveBeenCalled();
    });

    it('should work with structure entity', async () => {
      const mockStructure: Structure = {
        id: 'structure-1',
        settlementId: 'settlement-1',
        type: 'temple',
        name: 'Test Temple',
        level: 1,
        variables: {},
        variableSchemas: [],
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        archivedAt: null,
      };

      const schema: VariableSchema = {
        name: 'blessing',
        type: 'boolean',
      };

      jest.spyOn(prisma.structure, 'findFirst').mockResolvedValue(mockStructure);
      const mockSettlementWithKingdom: SettlementWithKingdom = {
        id: 'settlement-1',
        kingdomId: 'kingdom-1',
        locationId: 'location-1',
        name: 'Test Settlement',
        level: 1,
        variables: {},
        variableSchemas: [],
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        archivedAt: null,
        kingdom: {
          id: 'kingdom-1',
          campaignId: 'campaign-1',
        },
      };
      jest
        .spyOn(prisma.settlement, 'findFirst')
        .mockResolvedValue(mockSettlementWithKingdom as Settlement);
      const mockKingdomPartial: Pick<Kingdom, 'id' | 'campaignId'> = {
        id: 'kingdom-1',
        campaignId: 'campaign-1',
      };
      jest.spyOn(prisma.kingdom, 'findFirst').mockResolvedValue(mockKingdomPartial as Kingdom);
      const mockCampaign: PartialCampaign = {
        id: 'campaign-1',
        ownerId: 'user-1',
      };
      jest.spyOn(prisma.campaign, 'findFirst').mockResolvedValue(mockCampaign as Campaign);
      const updatedStructure: StructureWithSchemas = {
        ...mockStructure,
        variableSchemas: [schema] as unknown as Prisma.JsonValue,
      };
      jest.spyOn(prisma.structure, 'update').mockResolvedValue(updatedStructure as Structure);

      await service.defineSchema('structure', 'structure-1', schema, mockUser);

      expect(prisma.structure.update).toHaveBeenCalled();
    });
  });
});
