# Services Directory

This directory contains API clients and external service integrations.

## Purpose

Services handle communication with external systems:

- GraphQL API client for backend communication
- REST API clients (if needed)
- Third-party service integrations
- WebSocket connections
- Authentication token management

## Structure

```
services/
├── api/
│   ├── graphql-client.ts    # Apollo Client setup
│   ├── campaigns.ts         # Campaign API methods
│   ├── kingdoms.ts          # Kingdom API methods
│   └── auth.ts              # Authentication API methods
├── websocket/
│   └── realtime.ts          # WebSocket connection management
└── index.ts                 # Barrel export
```

## Usage

```tsx
import { graphqlClient, campaignService, authService } from '@/services';

// In a hook or component
async function fetchCampaign(id: string) {
  const campaign = await campaignService.getCampaign(id);
  return campaign;
}
```

## Guidelines

- Encapsulate all API communication logic
- Handle errors and provide meaningful error messages
- Use TypeScript for request/response types
- Implement retry logic and error handling
- Cache responses when appropriate
- Use environment variables for API URLs
- Separate concerns (one service per domain)
- Mock services for testing

## GraphQL Integration

The main GraphQL client should be configured in `api/graphql-client.ts`:

```typescript
import { ApolloClient, InMemoryCache } from '@apollo/client';

export const graphqlClient = new ApolloClient({
  uri: import.meta.env.VITE_GRAPHQL_URL,
  cache: new InMemoryCache(),
  // Additional configuration...
});
```

## Example Service

```typescript
// services/api/campaigns.ts
import { graphqlClient } from './graphql-client';
import { GET_CAMPAIGN, CREATE_CAMPAIGN } from './queries';

export const campaignService = {
  async getCampaign(id: string) {
    const { data } = await graphqlClient.query({
      query: GET_CAMPAIGN,
      variables: { id },
    });
    return data.campaign;
  },

  async createCampaign(input: CreateCampaignInput) {
    const { data } = await graphqlClient.mutate({
      mutation: CREATE_CAMPAIGN,
      variables: { input },
    });
    return data.createCampaign;
  },
};
```
