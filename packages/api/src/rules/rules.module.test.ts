/**
 * Rules Module Tests
 */

import { Test, TestingModule } from '@nestjs/testing';

import { ExpressionParserService } from './expression-parser.service';
import { OperatorRegistry } from './operator-registry';
import { RulesModule } from './rules.module';

describe('RulesModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [RulesModule],
    }).compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide ExpressionParserService', () => {
    const service = module.get<ExpressionParserService>(ExpressionParserService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(ExpressionParserService);
  });

  it('should provide OperatorRegistry', () => {
    const registry = module.get<OperatorRegistry>(OperatorRegistry);
    expect(registry).toBeDefined();
    expect(registry).toBeInstanceOf(OperatorRegistry);
  });

  it('should inject OperatorRegistry into ExpressionParserService', () => {
    const service = module.get<ExpressionParserService>(ExpressionParserService);
    const registry = module.get<OperatorRegistry>(OperatorRegistry);

    // Verify dependency injection by registering an operator and using it
    registry.register({
      name: 'test',
      implementation: () => 42,
    });

    const result = service.evaluate({ test: [] } as never, {});

    expect(result.success).toBe(true);
    expect(result.value).toBe(42);
  });

  it('should export ExpressionParserService for use in other modules', async () => {
    const testModule = await Test.createTestingModule({
      imports: [RulesModule],
    }).compile();

    const service = testModule.get<ExpressionParserService>(ExpressionParserService);

    expect(service).toBeDefined();

    await testModule.close();
  });

  it('should export OperatorRegistry for use in other modules', async () => {
    const testModule = await Test.createTestingModule({
      imports: [RulesModule],
    }).compile();

    const registry = testModule.get<OperatorRegistry>(OperatorRegistry);

    expect(registry).toBeDefined();

    await testModule.close();
  });
});
