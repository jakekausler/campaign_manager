# GraphQL API Error Handling Guide

## Overview

The Campaign Manager GraphQL API provides comprehensive error handling with consistent error structures, specific error codes, and detailed messages to help clients understand what went wrong and how to fix it.

All errors are returned in GraphQL response format with detailed information to support client-side error handling and user feedback.

---

## Table of Contents

1. [Error Response Format](#error-response-format)
2. [Error Types](#error-types)
3. [HTTP Status Codes](#http-status-codes)
4. [Authentication Errors](#authentication-errors)
5. [Authorization Errors](#authorization-errors)
6. [Validation Errors](#validation-errors)
7. [Resource Errors](#resource-errors)
8. [Conflict Errors](#conflict-errors)
9. [Business Logic Errors](#business-logic-errors)
10. [Error Handling Best Practices](#error-handling-best-practices)
11. [Error Recovery Patterns](#error-recovery-patterns)

---

## Error Response Format

GraphQL errors are returned in the standard GraphQL error response format with additional metadata:

### Structure

```json
{
  "errors": [
    {
      "message": "Human-readable error message",
      "extensions": {
        "code": "ERROR_CODE",
        "statusCode": 400,
        "timestamp": "2025-01-15T10:30:00Z",
        "path": ["mutation", "updateCampaign"]
      }
    }
  ],
  "data": {
    "updateCampaign": null
  }
}
```

### Error Properties

- **message**: Human-readable description of what went wrong
- **extensions.code**: Machine-readable error code for client-side handling
- **extensions.statusCode**: HTTP status code equivalent (400, 401, 403, 404, 409, 500)
- **extensions.path**: GraphQL path where error occurred (query/mutation/field)
- **extensions.timestamp**: When error occurred (non-production environments)

### Production vs. Development

**Development Mode** (extensions visible):

- All error details included for debugging
- Stack traces available
- Helps with local development and testing

**Production Mode** (extensions hidden):

- Only message returned
- No sensitive details exposed
- Safer for public clients

---

## Error Types

The API uses NestJS exception types that map to GraphQL errors with specific HTTP codes:

| Exception Type          | HTTP Code | GraphQL Code          | When Used                                   |
| ----------------------- | --------- | --------------------- | ------------------------------------------- |
| BadRequestException     | 400       | BAD_REQUEST           | Input validation errors, invalid parameters |
| UnauthorizedException   | 401       | UNAUTHENTICATED       | Missing/invalid auth credentials            |
| ForbiddenException      | 403       | FORBIDDEN             | User lacks permission                       |
| NotFoundException       | 404       | NOT_FOUND             | Resource doesn't exist                      |
| ConflictException       | 409       | CONFLICT              | Version mismatch (optimistic locking)       |
| NotImplementedException | 501       | NOT_IMPLEMENTED       | Feature not yet implemented                 |
| Internal Error          | 500       | INTERNAL_SERVER_ERROR | Unexpected server error                     |

---

## HTTP Status Codes

The API returns appropriate HTTP status codes for all error scenarios:

### 400 Bad Request

**When**: Request has invalid input data
**Common Causes**:

- Missing required fields
- Invalid data types
- Validation constraint violations
- Business logic violations

**Example**:

```json
{
  "errors": [
    {
      "message": "entityType is required and cannot be empty",
      "extensions": {
        "code": "BAD_REQUEST",
        "statusCode": 400
      }
    }
  ]
}
```

### 401 Unauthorized

**When**: Authentication failed
**Common Causes**:

- Missing authentication token
- Invalid/expired JWT token
- Invalid credentials during login
- Invalid API key

**Example**:

```json
{
  "errors": [
    {
      "message": "Invalid email or password",
      "extensions": {
        "code": "UNAUTHENTICATED",
        "statusCode": 401
      }
    }
  ]
}
```

### 403 Forbidden

**When**: User lacks permission
**Common Causes**:

- Insufficient role (not an admin, GM, or owner)
- No access to campaign/resource
- Insufficient membership level

**Example**:

```json
{
  "errors": [
    {
      "message": "You do not have permission to update this campaign",
      "extensions": {
        "code": "FORBIDDEN",
        "statusCode": 403
      }
    }
  ]
}
```

### 404 Not Found

**When**: Resource doesn't exist
**Common Causes**:

- Invalid entity ID
- Resource was deleted
- Resource belongs to different campaign/world

**Example**:

```json
{
  "errors": [
    {
      "message": "Campaign with ID abc-123-def not found",
      "extensions": {
        "code": "NOT_FOUND",
        "statusCode": 404
      }
    }
  ]
}
```

### 409 Conflict

**When**: Request conflicts with current state
**Common Causes**:

- Concurrent modification (version mismatch)
- Resource already exists
- Invalid state transition

**Example**:

```json
{
  "errors": [
    {
      "message": "The entity was modified by another user. Please refresh and try again.",
      "extensions": {
        "code": "CONFLICT",
        "statusCode": 409,
        "expectedVersion": 5,
        "actualVersion": 6
      }
    }
  ]
}
```

### 500 Internal Server Error

**When**: Unexpected server error
**Common Causes**:

- Database connection failure
- Unhandled exception
- External service failure

**Example**:

```json
{
  "errors": [
    {
      "message": "Internal server error",
      "extensions": {
        "code": "INTERNAL_SERVER_ERROR",
        "statusCode": 500
      }
    }
  ]
}
```

---

## Authentication Errors

### Missing Token

**Scenario**: Request sent without authentication

**Error**:

```json
{
  "errors": [
    {
      "message": "Unauthorized",
      "extensions": {
        "code": "UNAUTHENTICATED",
        "statusCode": 401
      }
    }
  ]
}
```

**Recovery**:

1. User logs in to get JWT token
2. Include `Authorization: Bearer <token>` header in subsequent requests

---

### Invalid/Expired Token

**Scenario**: JWT token is malformed, expired, or revoked

**Error**:

```json
{
  "errors": [
    {
      "message": "User not found",
      "extensions": {
        "code": "UNAUTHENTICATED",
        "statusCode": 401
      }
    }
  ]
}
```

**Recovery**:

1. Refresh token if available using `refreshAccessToken` mutation
2. If refresh fails, user must log in again
3. Store tokens securely (not in localStorage)

---

### Invalid Credentials (Login)

**Scenario**: Email or password is incorrect

**Error**:

```json
{
  "errors": [
    {
      "message": "Invalid email or password",
      "extensions": {
        "code": "UNAUTHENTICATED",
        "statusCode": 401
      }
    }
  ]
}
```

**Recovery**:

1. Check email and password are correct
2. Implement password reset flow if needed
3. Show user-friendly message: "Email or password incorrect"

---

### Invalid API Key

**Scenario**: API key is missing or invalid

**Error**:

```json
{
  "errors": [
    {
      "message": "Invalid API key",
      "extensions": {
        "code": "UNAUTHENTICATED",
        "statusCode": 401
      }
    }
  ]
}
```

**Recovery**:

1. Verify API key is correct in Authorization header
2. Regenerate API key in dashboard if necessary
3. Use format: `Authorization: Bearer <api-key>`

---

### Invalid Refresh Token

**Scenario**: Refresh token is expired, revoked, or invalid

**Error**:

```json
{
  "errors": [
    {
      "message": "Invalid refresh token",
      "extensions": {
        "code": "UNAUTHENTICATED",
        "statusCode": 401
      }
    }
  ]
}
```

**Recovery**:

1. User must log in again to get new tokens
2. Don't retry with same refresh token
3. Clear stored tokens from client
4. Implement graceful logout and redirect to login

---

## Authorization Errors

### Insufficient Role

**Scenario**: User's role doesn't permit the action

**Error**:

```json
{
  "errors": [
    {
      "message": "Only admin users can access cache statistics",
      "extensions": {
        "code": "FORBIDDEN",
        "statusCode": 403
      }
    }
  ]
}
```

**Recovery**:

1. Show user-friendly message: "You don't have permission to access this feature"
2. Don't retry (same user won't gain permission)
3. Suggest contacting campaign owner if access is needed

---

### No Campaign Access

**Scenario**: User is not a member of the campaign

**Error**:

```json
{
  "errors": [
    {
      "message": "User does not have access to campaign 550e8400-e29b-41d4-a716-446655440000",
      "extensions": {
        "code": "FORBIDDEN",
        "statusCode": 403
      }
    }
  ]
}
```

**Recovery**:

1. Verify campaign ID is correct
2. Check user is invited to campaign
3. Suggest asking campaign owner to add user
4. Show campaigns user has access to from `campaigns` query

---

### Insufficient Permission for Action

**Scenario**: User lacks permission for specific operation

**Examples**:

- User can view campaign but not create parties
- User can edit locations but not structures
- Only owner can delete campaign

**Error**:

```json
{
  "errors": [
    {
      "message": "You do not have permission to create parties in this campaign",
      "extensions": {
        "code": "FORBIDDEN",
        "statusCode": 403
      }
    }
  ]
}
```

**Recovery**:

1. Check user's role in the campaign
2. Request permission change from campaign owner
3. Disable UI elements user can't access
4. Pre-flight permission checks before mutations

---

### Merge Authorization

**Scenario**: Only OWNER and GM can merge branches

**Error**:

```json
{
  "errors": [
    {
      "message": "Only campaign OWNER and GM roles can execute merges",
      "extensions": {
        "code": "FORBIDDEN",
        "statusCode": 403
      }
    }
  ]
}
```

**Recovery**:

1. Only show merge UI to OWNER/GM users
2. Ask owner/GM to perform merge
3. Check branch creation permissions similarly

---

## Validation Errors

### Missing Required Field

**Scenario**: Required field not provided in mutation

**Error**:

```json
{
  "errors": [
    {
      "message": "Field 'name' of required type String! was not provided",
      "extensions": {
        "code": "BAD_REQUEST",
        "statusCode": 400
      }
    }
  ]
}
```

**Recovery**:

1. Check all required fields are provided
2. Implement client-side validation UI
3. Show red error message near field
4. Prevent form submission if validation fails

---

### Invalid Data Type

**Scenario**: Field has wrong type

**Error**:

```json
{
  "errors": [
    {
      "message": "Expected type UUID but got String",
      "extensions": {
        "code": "BAD_REQUEST",
        "statusCode": 400
      }
    }
  ]
}
```

**Recovery**:

1. Verify input data types before sending
2. Validate UUIDs before including in mutation
3. Use TypeScript types to catch at compile-time
4. Show validation error to user

---

### Empty Required String

**Scenario**: Required string field is empty

**Error**:

```json
{
  "errors": [
    {
      "message": "entityType is required and cannot be empty",
      "extensions": {
        "code": "BAD_REQUEST",
        "statusCode": 400
      }
    }
  ]
}
```

**Recovery**:

1. Validate non-empty before sending
2. Show UI error: "This field cannot be empty"
3. Disable submit button until filled
4. Use placeholder text to guide user

---

### Invalid Formula Expression

**Scenario**: State variable or condition formula is syntactically invalid

**Error**:

```json
{
  "errors": [
    {
      "message": "Invalid formula: Missing closing parenthesis in expression",
      "extensions": {
        "code": "BAD_REQUEST",
        "statusCode": 400
      }
    }
  ]
}
```

**Recovery**:

1. Show formula preview/syntax highlighting
2. Point to location of error in formula
3. Provide formula syntax documentation
4. Offer formula builder UI alternative

---

### Invalid Password Strength

**Scenario**: Password doesn't meet strength requirements

**Error**:

```json
{
  "errors": [
    {
      "message": "Password must contain at least 8 characters, uppercase letter, lowercase letter, number, and special character",
      "extensions": {
        "code": "BAD_REQUEST",
        "statusCode": 400
      }
    }
  ]
}
```

**Recovery**:

1. Show password strength indicator
2. List requirements as user types
3. Highlight unmet requirements
4. Provide password generator option

---

### Duplicate Email

**Scenario**: Email already registered

**Error**:

```json
{
  "errors": [
    {
      "message": "User with this email already exists",
      "extensions": {
        "code": "BAD_REQUEST",
        "statusCode": 400
      }
    }
  ]
}
```

**Recovery**:

1. Offer "Log in" option
2. Provide "Forgot password" link
3. Check if account exists before registration
4. Prevent users from registering twice

---

### Invalid GeoJSON

**Scenario**: GeoJSON geometry is malformed

**Error**:

```json
{
  "errors": [
    {
      "message": "Invalid GeoJSON geometry: Missing coordinates array",
      "extensions": {
        "code": "BAD_REQUEST",
        "statusCode": 400
      }
    }
  ]
}
```

**Recovery**:

1. Use map drawing tool to create geometry
2. Validate geometry before sending
3. Show geometry preview on map
4. Use GeoJSON validator before submission

---

## Resource Errors

### Resource Not Found

**Scenario**: Requested resource doesn't exist

**Error**:

```json
{
  "errors": [
    {
      "message": "Campaign with ID 550e8400-e29b-41d4-a716-446655440000 not found",
      "extensions": {
        "code": "NOT_FOUND",
        "statusCode": 404
      }
    }
  ]
}
```

**Recovery**:

1. Check if resource was deleted
2. Verify correct ID was used
3. Refresh campaigns list
4. Show user: "Campaign not found - it may have been deleted"

---

### Related Resource Not Found

**Scenario**: Parent/related resource doesn't exist (e.g., party not found for character)

**Error**:

```json
{
  "errors": [
    {
      "message": "Party with ID 550e8400-e29b-41d4-a716-446655440000 not found in this campaign",
      "extensions": {
        "code": "NOT_FOUND",
        "statusCode": 404
      }
    }
  ]
}
```

**Recovery**:

1. Create parent resource first (e.g., party)
2. Verify relationship belongs to same campaign
3. Show error: "Parent resource not found - create it first"
4. Offer to create parent resource

---

### Branch Not Found

**Scenario**: Referenced branch doesn't exist

**Error**:

```json
{
  "errors": [
    {
      "message": "Branch with ID 550e8400-e29b-41d4-a716-446655440000 not found",
      "extensions": {
        "code": "NOT_FOUND",
        "statusCode": 404
      }
    }
  ]
}
```

**Recovery**:

1. Verify branch ID is correct
2. Check branch wasn't deleted
3. Refresh branch list
4. Use default/main branch if available

---

## Conflict Errors

### Optimistic Lock Failure (Version Mismatch)

**Scenario**: Another user modified the entity while you were editing it

**Error**:

```json
{
  "errors": [
    {
      "message": "The entity was modified by another user. Please refresh and try again.",
      "extensions": {
        "code": "CONFLICT",
        "statusCode": 409,
        "expectedVersion": 5,
        "actualVersion": 6
      }
    }
  ]
}
```

**Recovery Strategy**:

1. **User-Friendly Approach**:

   ```
   "Another user has updated this campaign.
    Would you like to:
    - Refresh and see the latest version
    - View the changes that were made
    - Keep your local changes and merge manually"
   ```

2. **Implementation**:
   - Show modal with conflict details
   - Fetch latest version data
   - Show diff between versions
   - Let user choose merge strategy
   - Re-submit with new version number

3. **Code Example**:

   ```typescript
   try {
     await updateCampaign(id, data, expectedVersion);
   } catch (error) {
     if (error.extensions?.code === 'CONFLICT') {
       // Show conflict resolution UI
       const latest = await getCampaign(id);
       showConflictDialog(current, latest);
     }
   }
   ```

4. **Prevention**:
   - Query version before mutation
   - Show last-modified timestamp
   - Implement periodic refresh
   - Use optimistic UI updates

---

### Circular Reference

**Scenario**: Creating a hierarchy that would form a cycle

**Error**:

```json
{
  "errors": [
    {
      "message": "Cannot set parent: would create circular reference",
      "extensions": {
        "code": "BAD_REQUEST",
        "statusCode": 400
      }
    }
  ]
}
```

**Recovery**:

1. Choose different parent location
2. Show hierarchy preview
3. Validate parentage before submission
4. Suggest valid parent options

---

### Cross-Campaign Constraint

**Scenario**: Trying to link entities from different campaigns

**Error**:

```json
{
  "errors": [
    {
      "message": "Cannot merge branches from different campaigns",
      "extensions": {
        "code": "BAD_REQUEST",
        "statusCode": 400
      }
    }
  ]
}
```

**Recovery**:

1. Verify both branches belong to same campaign
2. Show campaign IDs for verification
3. Create branch in correct campaign
4. Copy data if needed to other campaign

---

## Business Logic Errors

### Event Already Completed

**Scenario**: Cannot modify or resolve completed event

**Error**:

```json
{
  "errors": [
    {
      "message": "Event 550e8400-e29b-41d4-a716-446655440000 is already completed",
      "extensions": {
        "code": "BAD_REQUEST",
        "statusCode": 400
      }
    }
  ]
}
```

**Recovery**:

1. Show event is completed
2. Offer to view event details
3. Show completion date/details
4. Archive event if needed

---

### Location Already Occupied

**Scenario**: Another settlement exists at location

**Error**:

```json
{
  "errors": [
    {
      "message": "This location is already occupied by another settlement",
      "extensions": {
        "code": "BAD_REQUEST",
        "statusCode": 400
      }
    }
  ]
}
```

**Recovery**:

1. Show which settlement occupies location
2. Choose different location
3. Move existing settlement first
4. Show location map with occupancy

---

### Invalid Scope for Variable

**Scenario**: Variable scope doesn't match entity type

**Error**:

```json
{
  "errors": [
    {
      "message": "Unsupported scope: invalid_scope",
      "extensions": {
        "code": "BAD_REQUEST",
        "statusCode": 400
      }
    }
  ]
}
```

**Recovery**:

1. Choose valid scope (CAMPAIGN, PARTY, KINGDOM, SETTLEMENT, etc.)
2. Show available scopes for entity type
3. Validate scope selection in UI
4. Use dropdown instead of text input

---

### Missing Formula for Derived Variable

**Scenario**: Derived variable requires formula

**Error**:

```json
{
  "errors": [
    {
      "message": "Derived variables must have a formula",
      "extensions": {
        "code": "BAD_REQUEST",
        "statusCode": 400
      }
    }
  ]
}
```

**Recovery**:

1. Show formula field is required
2. Provide formula editor/builder
3. Show formula examples
4. Validate before allowing save

---

### Invalid Location Hierarchy

**Scenario**: Child location must belong to same world as parent

**Error**:

```json
{
  "errors": [
    {
      "message": "Parent location must belong to the same world",
      "extensions": {
        "code": "BAD_REQUEST",
        "statusCode": 400
      }
    }
  ]
}
```

**Recovery**:

1. Choose parent from same world
2. Show world ID for parent location
3. Filter location selector by world
4. Validate before submission

---

## Error Handling Best Practices

### Client-Side Error Handling

1. **Always handle errors in mutations**:

   ```typescript
   const { mutate: updateCampaign } = useMutation(UPDATE_CAMPAIGN, {
     onError: (error) => {
       console.error('Update failed:', error.message);
       showErrorNotification(error.message);
     },
   });
   ```

2. **Check error codes for specific handling**:

   ```typescript
   if (error.extensions?.code === 'CONFLICT') {
     showConflictResolutionUI();
   } else if (error.extensions?.code === 'FORBIDDEN') {
     showPermissionDeniedUI();
   }
   ```

3. **Implement retry logic for transient errors**:

   ```typescript
   if (error.extensions?.statusCode === 500) {
     // Retry after delay
     setTimeout(() => retry(), 1000);
   }
   ```

4. **Validate before sending**:

   ```typescript
   // Validate locally first
   const validation = validateCampaignInput(formData);
   if (!validation.isValid) {
     showValidationErrors(validation.errors);
     return;
   }
   // Only send if valid
   await updateCampaign(formData);
   ```

5. **Show user-friendly error messages**:
   ```typescript
   const userMessage = error.message
     .replace(/ID [a-f0-9-]+/, 'the resource')
     .replace('Campaign', 'Campaign');
   toast.error(userMessage);
   ```

### Server-Side Error Handling

1. **Include context in error messages**:
   - What resource/operation failed
   - Which field has the problem
   - Why the validation failed
   - Suggestions for fixing

2. **Use appropriate exception types**:
   - Don't throw generic errors
   - Use specific NestJS exceptions
   - Map to correct HTTP codes

3. **Log errors appropriately**:
   - Log 4xx errors as info (client fault)
   - Log 5xx errors as errors (server fault)
   - Include request context
   - Exclude sensitive data from logs

4. **Avoid exposing sensitive information**:
   - Don't leak database details
   - Don't expose file paths
   - Don't show internal system details
   - Use generic messages in production

---

## Error Recovery Patterns

### Retry Pattern

```typescript
async function retryOnTransientError(fn, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) throw error;

      // Only retry on transient errors
      if (!isTransientError(error)) throw error;

      // Exponential backoff
      await sleep(Math.pow(2, attempt) * 100);
    }
  }
}

function isTransientError(error) {
  return error.extensions?.statusCode >= 500;
}
```

### Fallback Pattern

```typescript
async function fetchCampaignWithFallback(campaignId) {
  try {
    return await getCampaign(campaignId);
  } catch (error) {
    if (error.extensions?.code === 'NOT_FOUND') {
      // Use cached data or default
      return getCachedCampaign(campaignId) || getDefaultCampaign();
    }
    throw error;
  }
}
```

### Conflict Resolution Pattern

```typescript
async function resolveConflict(resource, userChanges) {
  try {
    await update(resource.id, userChanges, resource.version);
  } catch (error) {
    if (error.extensions?.code === 'CONFLICT') {
      const latest = await fetch(resource.id);
      const merged = mergeChanges(latest, userChanges);
      return await update(resource.id, merged, latest.version);
    }
    throw error;
  }
}
```

### Permission Check Pattern

```typescript
async function checkAndExecute(operation, resource) {
  try {
    return await operation();
  } catch (error) {
    if (error.extensions?.code === 'FORBIDDEN') {
      const permissions = await getCurrentPermissions();
      throw new Error(
        `You need ${requiredPermission()} permission. ` + `Current: ${permissions.join(', ')}`
      );
    }
    throw error;
  }
}
```

---

## Error Examples by Domain

### Campaign Management

- Missing world ID: "World with ID X not found"
- Permission denied: "You do not have permission to update this campaign"
- Version conflict: "The entity was modified by another user"
- Invalid status: "Cannot transition from completed state"

### Geography (Locations, Settlements, Structures)

- Circular reference: "Cannot set parent: would create circular reference"
- Cross-world hierarchy: "Parent location must belong to the same world"
- Occupation conflict: "This location is already occupied by another settlement"
- Invalid geometry: "Invalid GeoJSON geometry: Missing coordinates array"

### Events & Encounters

- Already resolved: "Encounter is already resolved"
- Invalid condition: "Invalid formula: Missing closing parenthesis"
- Missing location: "Location must belong to the same world as the campaign"

### State Variables

- Missing formula: "Derived variables must have a formula"
- Invalid scope: "Unsupported scope: invalid_scope"
- Parse error: "Invalid formula: Syntax error at position 42"

### Branching & Merging

- Missing branch: "Branch with ID X not found"
- Cross-campaign merge: "Cannot merge branches from different campaigns"
- Role restriction: "Only campaign OWNER and GM roles can execute merges"

---

## Summary

The Campaign Manager API provides comprehensive error handling with:

- **Consistent structure** - All errors follow same format
- **Specific codes** - Machine-readable codes for client-side handling
- **Context** - Error messages include relevant details
- **Recovery guidance** - This documentation shows how to handle each error
- **HTTP standards** - Appropriate status codes for each scenario

By implementing the patterns and recovery strategies documented here, clients can provide excellent user experience even when errors occur.
