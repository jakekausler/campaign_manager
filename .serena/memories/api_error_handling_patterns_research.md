# API Error Handling Patterns Research

## NestJS Exceptions Used

The API uses NestJS built-in HTTP exceptions that map to GraphQL errors:

- **BadRequestException** - For validation errors and invalid input (400)
- **UnauthorizedException** - For auth failures (401)
- **ForbiddenException** - For authorization/permission failures (403)
- **NotFoundException** - For missing resources (404)
- **ConflictException** - For version conflicts (409)
- **NotImplementedException** - For unimplemented features (501)

## Custom Exceptions

- **OptimisticLockException** extends ConflictException
  - Used for concurrent modification detection
  - Includes expectedVersion and actualVersion properties
  - Message: "The entity was modified by another user. Please refresh and try again."

## Error Structure

GraphQL error formatting happens in graphql.module.ts line 102-109:

- Returns: { message, extensions? }
- Extensions included in non-production only
- Extensions contain error codes and metadata from NestJS exceptions

## Input Validation

Uses class-validator decorators on InputType classes:

- @IsString(), @IsNotEmpty(), @IsOptional(), @IsBoolean()
- @IsUUID(), @IsInt(), @IsDate()
- @MinLength(), @MaxLength(), @IsEmail()
- @ValidateNested() for nested objects
- @ValidateIf() for conditional validation
- Validation errors are caught and returned as BadRequestException

## Common Error Patterns in Services

### Authentication/Authorization

- `throw new UnauthorizedException('Invalid email or password')`
- `throw new UnauthorizedException('API key is missing')`
- `throw new UnauthorizedException('Invalid refresh token')`

### Authorization (Permissions)

- `throw new ForbiddenException('Only admin users can access cache statistics')`
- `throw new ForbiddenException('User does not have access to campaign ${campaignId}')`
- `throw new ForbiddenException('You do not have permission to create parties in this campaign')`
- `throw new ForbiddenException('Only campaign OWNER and GM roles can execute merges')`

### Not Found Errors

- `throw new NotFoundException('Campaign with ID ${campaignId} not found')`
- `throw new NotFoundException('Branch with ID ${branchId} not found')`
- `throw new NotFoundException('Settlement with ID ${settlementId} not found')`

### Bad Request/Validation

- `throw new BadRequestException('Derived variables must have a formula')`
- `throw new BadRequestException('Invalid formula: ${validationResult.errors.join(', ')}')`
- `throw new BadRequestException('entityType is required and cannot be empty')`
- `throw new BadRequestException('Cannot merge branches from different campaigns')`

### Optimistic Locking

- `throw new OptimisticLockException('..message..', expectedVersion, actualVersion)`
- Thrown when: update fails due to version mismatch

### Domain-Specific Errors

- `throw new BadRequestException('Event ${eventId} is already completed')`
- `throw new Error('Cannot link entities from different campaigns')`
- `throw new Error('Location must belong to the same world as the campaign')`
- `throw new Error('Cannot set parent: would create circular reference')`

## Resolver-Level Guards

Use @UseGuards with middleware:

- JwtAuthGuard - requires valid JWT token
- RolesGuard - checks user role with @Roles() decorator
- ApiKeyAuthGuard - validates API key

Errors thrown:

- UnauthorizedException in guards when auth fails

## Error Context

Services often include context in errors:

- Resource IDs (e.g., "Settlement with ID X not found")
- User permissions (e.g., "You do not have permission to...")
- Validation details (e.g., "Invalid formula: ${errors}")
- System state (e.g., "version mismatch: expected X, got Y")
