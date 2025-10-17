# SandboxExecutor Security Documentation

## Overview

The `SandboxExecutor` class provides secure execution of JSONLogic expressions with protection against common security vulnerabilities and resource exhaustion attacks. This document outlines the security measures implemented and best practices for using the sandbox.

## Security Features

### 1. Code Injection Prevention

**Threat**: Malicious expressions attempting to execute arbitrary code through JavaScript's dynamic features.

**Protection**:

- Context sanitization filters out dangerous properties before evaluation
- Blocked properties include:
  - `__proto__`, `constructor`, `prototype` (prototype pollution)
  - `eval`, `Function` (code execution)
  - `global`, `process`, `require`, `module`, `exports` (Node.js internals)
  - `__dirname`, `__filename` (filesystem access)

**Example Attack Prevented**:

```typescript
// Attempt to access dangerous features
const maliciousContext = {
  eval: eval,
  Function: Function,
  __proto__: { admin: true },
};

// These properties are filtered out during sanitization
executor.execute({ var: 'eval' }, maliciousContext);
// Returns null (property not found) instead of eval function
```

### 2. Recursion Depth Limits

**Threat**: Stack overflow from deeply nested expressions causing process crash.

**Protection**:

- Default maximum depth: 50 levels
- Configurable via `maxDepth` option
- Checks depth during expression traversal before execution

**Example Attack Prevented**:

```typescript
// Deeply nested expression (depth > 50)
let malicious = { var: 'x' };
for (let i = 0; i < 60; i++) {
  malicious = { if: [true, malicious, false] };
}

executor.execute(malicious, {});
// Returns error: "Maximum recursion depth exceeded: 51 > 50"
```

**Recommended Settings**:

- Default (50): Suitable for most use cases
- Strict (20): For untrusted user input
- Relaxed (100): For complex trusted expressions

### 3. Iteration Count Limits

**Threat**: Resource exhaustion from processing extremely large data structures.

**Protection**:

- Default maximum iterations: 10,000
- Configurable via `maxIterations` option
- Counts all structural elements (arrays, objects) during traversal
- Prevents both large input arrays and complex expression trees

**Example Attack Prevented**:

```typescript
// Attempt to process 100,000 items
const largeArray = Array.from({ length: 100000 }, (_, i) => i);
const expression = {
  map: [largeArray, { '+': [{ var: '' }, 1] }],
};

executor.execute(expression, {});
// Returns error: "Maximum iteration count exceeded: 100000 > 10000"
```

**Recommended Settings**:

- Default (10,000): Balanced for typical use
- Strict (1,000): For untrusted input with simple data
- Relaxed (100,000): For trusted batch operations

### 4. Execution Timeout

**Threat**: Denial of service from long-running expressions blocking the event loop.

**Protection**:

- Default timeout: 5,000ms (5 seconds)
- Configurable via `timeout` option
- Set to 0 to disable (only for trusted expressions)
- Checked during expression traversal

**Example Attack Prevented**:

```typescript
// Expression that would take too long
const options = { timeout: 100 }; // 100ms limit
const executor = new SandboxExecutor(options);

const slowExpression = {
  reduce: [Array(10000).fill(1), { '+': [{ var: 'accumulator' }, { var: 'current' }] }, 0],
};

executor.execute(slowExpression, {});
// May return error: "Execution timeout: expression exceeded 100ms limit"
```

**Recommended Settings**:

- Default (5000ms): General purpose
- Strict (1000ms): Interactive user requests
- Relaxed (30000ms): Background processing
- Disabled (0): Only for trusted, tested expressions

## Usage Guidelines

### For Untrusted User Input

Use strict settings when evaluating expressions from untrusted sources:

```typescript
const strictExecutor = new SandboxExecutor({
  maxDepth: 20, // Limit nesting
  maxIterations: 1000, // Limit data processing
  timeout: 1000, // 1 second max
});

// Always validate expressions before execution
const validator = new ExpressionValidator(operatorRegistry);
const validation = validator.validate(userExpression);

if (!validation.valid) {
  throw new BadRequestException(`Invalid expression: ${validation.errors.join(', ')}`);
}

// Execute with sandbox
const result = strictExecutor.execute(userExpression, userContext);
```

### For Trusted Internal Expressions

Use default or relaxed settings for expressions created by your application:

```typescript
const trustedExecutor = new SandboxExecutor({
  maxDepth: 50, // Default
  maxIterations: 10000, // Default
  timeout: 5000, // Default
});

// Still sanitizes context for defense in depth
const result = trustedExecutor.execute(internalExpression, context);
```

### For Background Processing

Disable timeout for long-running batch operations:

```typescript
const batchExecutor = new SandboxExecutor({
  maxDepth: 100, // Allow complex expressions
  maxIterations: 100000, // Allow large datasets
  timeout: 0, // No timeout (ONLY for trusted expressions)
});

// Use for batch processing of known-safe expressions
const results = await batchProcess(expressions, batchExecutor);
```

## Security Best Practices

### 1. Always Validate First

Use `ExpressionValidator` before `SandboxExecutor`:

```typescript
// Step 1: Validate structure and operators
const validator = new ExpressionValidator(operatorRegistry);
const validation = validator.validate(expression);

if (!validation.valid) {
  throw new BadRequestException(`Validation failed: ${validation.errors.join(', ')}`);
}

// Step 2: Execute safely
const result = executor.execute(expression, context);
```

### 2. Sanitize Context Data

Even though the executor sanitizes context, provide only necessary data:

```typescript
// Bad: Exposing entire object
const unsafeContext = {
  ...internalData, // May contain sensitive fields
  user: currentUser, // May contain password hash, etc.
};

// Good: Whitelist only needed fields
const safeContext = {
  userId: currentUser.id,
  userName: currentUser.name,
  userRole: currentUser.role,
};

const result = executor.execute(expression, safeContext);
```

### 3. Use Appropriate Limits

Choose limits based on threat model:

| Use Case        | maxDepth | maxIterations | timeout      |
| --------------- | -------- | ------------- | ------------ |
| User input      | 20       | 1,000         | 1,000ms      |
| Admin tools     | 50       | 10,000        | 5,000ms      |
| Background jobs | 100      | 100,000       | 30,000ms     |
| Trusted batch   | 100      | 1,000,000     | 0 (disabled) |

### 4. Log Security Events

Monitor for suspicious patterns:

```typescript
const result = executor.execute(expression, context);

if (!result.success) {
  if (result.error?.includes('recursion depth')) {
    logger.warn('Possible DoS attempt: excessive recursion', { userId, expression });
  } else if (result.error?.includes('iteration')) {
    logger.warn('Possible DoS attempt: excessive iterations', { userId, expression });
  } else if (result.error?.includes('timeout')) {
    logger.warn('Expression timeout', { userId, expression });
  }
}
```

### 5. Rate Limiting

Combine with rate limiting for untrusted input:

```typescript
// In your controller/resolver
@RateLimit({ points: 10, duration: 60 }) // 10 requests per minute
async evaluateExpression(input: EvaluateInput) {
  const validator = new ExpressionValidator(this.operatorRegistry);
  const validation = validator.validate(input.expression);

  if (!validation.valid) {
    throw new BadRequestException(validation.errors.join(', '));
  }

  const result = this.sandboxExecutor.execute(input.expression, input.context);
  return result;
}
```

## Limitations and Known Issues

### 1. Timeout Granularity

The timeout check occurs during expression traversal, not during JSONLogic execution. Very fast expressions may complete before timeout is checked.

**Mitigation**: Use iteration limits in combination with timeout.

### 2. Memory Usage

The executor doesn't directly limit memory usage, only iteration count.

**Mitigation**: Set appropriate `maxIterations` limits based on available memory.

### 3. Custom Operators

Custom operators bypass some sandbox protections. They execute with full Node.js privileges.

**Mitigation**:

- Only register trusted custom operators
- Implement security checks within custom operators
- Use interfaces (ISpatialService, ITemporalService) to control access

```typescript
// Bad: Custom operator with unchecked file access
operatorRegistry.register({
  name: 'readFile',
  implementation: (path) => fs.readFileSync(path), // DANGEROUS!
});

// Good: Custom operator with validation and sandboxing
operatorRegistry.register({
  name: 'getLocation',
  implementation: (locationId) => {
    // Validate input
    if (!isValidLocationId(locationId)) {
      return null;
    }
    // Use safe service layer
    return spatialService.getLocation(locationId);
  },
});
```

### 4. Prototype Pollution Variants

While direct `__proto__` access is blocked, complex object manipulation might still allow pollution.

**Mitigation**:

- Keep json-logic-js updated
- Avoid passing user-controlled object keys directly
- Use Object.freeze() on critical configuration objects

## Testing Security

### Run Security Tests

```bash
# Run all sandbox security tests
pnpm --filter @campaign/api test -- sandbox-executor.test.ts

# Run specific security test suites
pnpm --filter @campaign/api test -- sandbox-executor.test.ts -t "Code Injection"
pnpm --filter @campaign/api test -- sandbox-executor.test.ts -t "Recursion Depth"
```

### Add New Security Tests

When adding custom operators or modifying the sandbox, add corresponding security tests:

```typescript
describe('Custom Operator Security', () => {
  it('should not expose internal services', () => {
    const expression = { customOp: ['malicious'] };
    const result = executor.execute(expression, {});

    expect(result.value).not.toHaveProperty('service');
    expect(result.value).not.toHaveProperty('connection');
  });
});
```

## Incident Response

If a security issue is discovered:

1. **Immediate**: Disable affected custom operators if applicable
2. **Short-term**: Apply stricter limits (`maxDepth: 10, maxIterations: 100`)
3. **Long-term**: Fix vulnerability, add regression test, update this document

## References

- [JSONLogic Documentation](http://jsonlogic.com/)
- [OWASP Code Injection](https://owasp.org/www-community/attacks/Code_Injection)
- [Prototype Pollution](https://portswigger.net/web-security/prototype-pollution)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

## Version History

- **Stage 4 (Current)**: Initial implementation with code injection prevention, recursion/iteration limits, and timeout protection
- **Future**: Consider integrating vm2 or isolated-vm for stronger sandboxing
