import { gql } from '@apollo/client';
import {
  useQuery,
  useMutation,
  type QueryHookOptions,
  type MutationHookOptions,
} from '@apollo/client/react';
import { useMemo } from 'react';

// TODO: Once backend is fixed and code generation runs, import these types from generated file:
// import type {
//   GetBranchQuery,
//   GetBranchQueryVariables,
//   GetBranchesQuery,
//   GetBranchesQueryVariables,
//   GetBranchHierarchyQuery,
//   GetBranchHierarchyQueryVariables,
//   CreateBranchMutation,
//   CreateBranchMutationVariables,
//   UpdateBranchMutation,
//   UpdateBranchMutationVariables,
//   DeleteBranchMutation,
//   DeleteBranchMutationVariables,
//   ForkBranchMutation,
//   ForkBranchMutationVariables,
// } from '@/__generated__/graphql';

// Temporary placeholder types until code generation runs
type Branch = {
  id: string;
  name: string;
  description?: string | null;
  campaignId: string;
  parentId?: string | null;
  parent?: Branch | null;
  children?: Branch[];
  divergedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

type BranchNode = {
  branch: Branch;
  children: BranchNode[];
};

type ForkResult = {
  branch: Branch;
  versionsCopied: number;
};

type GetBranchQuery = {
  branch: Branch | null;
};

type GetBranchQueryVariables = {
  id: string;
};

type GetBranchesQuery = {
  branches: Branch[];
};

type GetBranchesQueryVariables = {
  campaignId: string;
};

type GetBranchHierarchyQuery = {
  branchHierarchy: BranchNode[];
};

type GetBranchHierarchyQueryVariables = {
  campaignId: string;
};

type CreateBranchInput = {
  campaignId: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  divergedAt?: string | null;
};

type CreateBranchMutation = {
  createBranch: Branch;
};

type CreateBranchMutationVariables = {
  input: CreateBranchInput;
};

type UpdateBranchInput = {
  name?: string | null;
  description?: string | null;
};

type UpdateBranchMutation = {
  updateBranch: Branch;
};

type UpdateBranchMutationVariables = {
  id: string;
  input: UpdateBranchInput;
};

type DeleteBranchMutation = {
  deleteBranch: boolean;
};

type DeleteBranchMutationVariables = {
  id: string;
};

type ForkBranchInput = {
  sourceBranchId: string;
  name: string;
  description?: string | null;
  worldTime: string;
};

type ForkBranchMutation = {
  forkBranch: ForkResult;
};

type ForkBranchMutationVariables = {
  input: ForkBranchInput;
};

/**
 * GraphQL query to get a single branch by ID.
 *
 * This query fetches a branch with its parent and children relationships,
 * useful for displaying branch details and navigation.
 *
 * @example
 * Query:
 * ```graphql
 * query GetBranch($id: ID!) {
 *   branch(id: $id) {
 *     id
 *     name
 *     description
 *     campaignId
 *     parentId
 *     parent { id name }
 *     children { id name }
 *     divergedAt
 *     createdAt
 *     updatedAt
 *   }
 * }
 * ```
 */
export const GET_BRANCH = gql`
  query GetBranch($id: ID!) {
    branch(id: $id) {
      id
      name
      description
      campaignId
      parentId
      parent {
        id
        name
      }
      children {
        id
        name
      }
      divergedAt
      createdAt
      updatedAt
    }
  }
`;

/**
 * GraphQL query to get all branches for a campaign (flat list).
 *
 * This query fetches all branches in a campaign with parent/child references,
 * useful for branch selection dropdowns and lists.
 *
 * @example
 * Query:
 * ```graphql
 * query GetBranches($campaignId: ID!) {
 *   branches(campaignId: $campaignId) {
 *     id
 *     name
 *     description
 *     parentId
 *     divergedAt
 *     createdAt
 *     updatedAt
 *   }
 * }
 * ```
 */
export const GET_BRANCHES = gql`
  query GetBranches($campaignId: ID!) {
    branches(campaignId: $campaignId) {
      id
      name
      description
      parentId
      divergedAt
      createdAt
      updatedAt
    }
  }
`;

/**
 * GraphQL query to get branch hierarchy for a campaign (tree structure).
 *
 * This query fetches all branches in a hierarchical tree structure with
 * recursive BranchNode type, useful for visualizing branch relationships
 * and ancestry.
 *
 * @example
 * Query:
 * ```graphql
 * query GetBranchHierarchy($campaignId: ID!) {
 *   branchHierarchy(campaignId: $campaignId) {
 *     branch {
 *       id
 *       name
 *       description
 *       divergedAt
 *       createdAt
 *     }
 *     children {
 *       branch { id name divergedAt }
 *       children { ... }
 *     }
 *   }
 * }
 * ```
 */
export const GET_BRANCH_HIERARCHY = gql`
  query GetBranchHierarchy($campaignId: ID!) {
    branchHierarchy(campaignId: $campaignId) {
      branch {
        id
        name
        description
        divergedAt
        createdAt
        updatedAt
      }
      children {
        branch {
          id
          name
          description
          divergedAt
          createdAt
          updatedAt
        }
        children {
          branch {
            id
            name
            divergedAt
          }
          children {
            branch {
              id
              name
            }
          }
        }
      }
    }
  }
`;

/**
 * GraphQL mutation to create a new branch.
 *
 * @example
 * Mutation:
 * ```graphql
 * mutation CreateBranch($input: CreateBranchInput!) {
 *   createBranch(input: $input) {
 *     id
 *     name
 *     description
 *     campaignId
 *     parentId
 *     divergedAt
 *     createdAt
 *   }
 * }
 * ```
 */
export const CREATE_BRANCH = gql`
  mutation CreateBranch($input: CreateBranchInput!) {
    createBranch(input: $input) {
      id
      name
      description
      campaignId
      parentId
      divergedAt
      createdAt
      updatedAt
    }
  }
`;

/**
 * GraphQL mutation to update a branch (name/description only).
 *
 * @example
 * Mutation:
 * ```graphql
 * mutation UpdateBranch($id: ID!, $input: UpdateBranchInput!) {
 *   updateBranch(id: $id, input: $input) {
 *     id
 *     name
 *     description
 *     updatedAt
 *   }
 * }
 * ```
 */
export const UPDATE_BRANCH = gql`
  mutation UpdateBranch($id: ID!, $input: UpdateBranchInput!) {
    updateBranch(id: $id, input: $input) {
      id
      name
      description
      updatedAt
    }
  }
`;

/**
 * GraphQL mutation to delete a branch (soft delete).
 *
 * @example
 * Mutation:
 * ```graphql
 * mutation DeleteBranch($id: ID!) {
 *   deleteBranch(id: $id)
 * }
 * ```
 */
export const DELETE_BRANCH = gql`
  mutation DeleteBranch($id: ID!) {
    deleteBranch(id: $id)
  }
`;

/**
 * GraphQL mutation to fork a branch (create child branch with version copies).
 *
 * @example
 * Mutation:
 * ```graphql
 * mutation ForkBranch($input: ForkBranchInput!) {
 *   forkBranch(input: $input) {
 *     branch {
 *       id
 *       name
 *       description
 *       parentId
 *       divergedAt
 *       createdAt
 *     }
 *     versionsCopied
 *   }
 * }
 * ```
 */
export const FORK_BRANCH = gql`
  mutation ForkBranch($input: ForkBranchInput!) {
    forkBranch(input: $input) {
      branch {
        id
        name
        description
        parentId
        divergedAt
        createdAt
        updatedAt
      }
      versionsCopied
    }
  }
`;

/**
 * React hook to fetch a single branch by ID.
 *
 * @param id - The branch ID
 * @param options - Additional Apollo query options
 * @returns Query result with branch data, loading state, and error
 *
 * @example
 * ```typescript
 * function BranchDetails({ branchId }: { branchId: string }) {
 *   const { data, loading, error } = useGetBranch(branchId);
 *
 *   if (loading) return <div>Loading branch...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!data?.branch) return <div>Branch not found</div>;
 *
 *   return (
 *     <div>
 *       <h2>{data.branch.name}</h2>
 *       <p>{data.branch.description}</p>
 *       {data.branch.parent && <p>Parent: {data.branch.parent.name}</p>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useGetBranch(
  id: string,
  options?: QueryHookOptions<GetBranchQuery, GetBranchQueryVariables>
) {
  return useQuery<GetBranchQuery, GetBranchQueryVariables>(GET_BRANCH, {
    ...options,
    variables: { id },
    skip: !id || options?.skip,
  });
}

/**
 * React hook to fetch all branches for a campaign (flat list).
 *
 * @param campaignId - The campaign ID
 * @param options - Additional Apollo query options
 * @returns Query result with branches array, loading state, and error
 *
 * @example
 * ```typescript
 * function BranchList({ campaignId }: { campaignId: string }) {
 *   const { data, loading, error } = useGetBranches(campaignId);
 *
 *   if (loading) return <div>Loading branches...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   return (
 *     <ul>
 *       {data?.branches.map(branch => (
 *         <li key={branch.id}>{branch.name}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useGetBranches(
  campaignId: string,
  options?: QueryHookOptions<GetBranchesQuery, GetBranchesQueryVariables>
) {
  return useQuery<GetBranchesQuery, GetBranchesQueryVariables>(GET_BRANCHES, {
    ...options,
    variables: { campaignId },
    skip: !campaignId || options?.skip,
  });
}

/**
 * React hook to fetch branch hierarchy for a campaign (tree structure).
 *
 * Returns a memoized flattened version of the hierarchy for easier iteration
 * in addition to the raw tree structure.
 *
 * @param campaignId - The campaign ID
 * @param options - Additional Apollo query options
 * @returns Query result with hierarchy tree, flat branches list, loading state, and error
 *
 * @example
 * ```typescript
 * function BranchHierarchyView({ campaignId }: { campaignId: string }) {
 *   const { hierarchy, flatBranches, loading, error } = useGetBranchHierarchy(campaignId);
 *
 *   if (loading) return <div>Loading hierarchy...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   // Render tree structure
 *   return <BranchTree nodes={hierarchy} />;
 *
 *   // Or use flat list for dropdown
 *   return (
 *     <select>
 *       {flatBranches.map(branch => (
 *         <option key={branch.id} value={branch.id}>
 *           {branch.name}
 *         </option>
 *       ))}
 *     </select>
 *   );
 * }
 * ```
 */
export function useGetBranchHierarchy(
  options: QueryHookOptions<GetBranchHierarchyQuery, GetBranchHierarchyQueryVariables>
) {
  const result = useQuery<GetBranchHierarchyQuery, GetBranchHierarchyQueryVariables>(
    GET_BRANCH_HIERARCHY,
    {
      ...options,
      skip: !options?.variables?.campaignId || options?.skip,
    }
  );

  // Flatten hierarchy tree into a single array for easier iteration
  // Preserves depth information for indentation in UI
  const flatBranches = useMemo(() => {
    if (!result.data?.branchHierarchy) return [];

    const flatten = (
      nodes: readonly BranchNode[],
      depth = 0
    ): Array<Branch & { depth: number }> => {
      return nodes.flatMap((node) => [
        { ...node.branch, depth },
        ...flatten(node.children, depth + 1),
      ]);
    };

    return flatten(result.data.branchHierarchy);
  }, [result.data?.branchHierarchy]);

  return {
    ...result,
    hierarchy: result.data?.branchHierarchy ?? [],
    flatBranches,
  };
}

/**
 * React hook to create a new branch.
 *
 * @param options - Additional Apollo mutation options
 * @returns Mutation function and result state
 *
 * @example
 * ```typescript
 * function CreateBranchForm({ campaignId }: { campaignId: string }) {
 *   const [createBranch, { loading, error }] = useCreateBranch();
 *   const [name, setName] = useState('');
 *
 *   const handleSubmit = async (e: React.FormEvent) => {
 *     e.preventDefault();
 *     const { data } = await createBranch({
 *       variables: {
 *         input: { campaignId, name, description: 'New branch' }
 *       }
 *     });
 *     console.log('Created branch:', data?.createBranch);
 *   };
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <input value={name} onChange={e => setName(e.target.value)} />
 *       <button type="submit" disabled={loading}>Create</button>
 *       {error && <div>Error: {error.message}</div>}
 *     </form>
 *   );
 * }
 * ```
 */
export function useCreateBranch(
  options?: MutationHookOptions<CreateBranchMutation, CreateBranchMutationVariables>
) {
  return useMutation<CreateBranchMutation, CreateBranchMutationVariables>(CREATE_BRANCH, options);
}

/**
 * React hook to update a branch (name/description only).
 *
 * @param options - Additional Apollo mutation options
 * @returns Mutation function and result state
 *
 * @example
 * ```typescript
 * function RenameBranchForm({ branchId }: { branchId: string }) {
 *   const [updateBranch, { loading }] = useUpdateBranch();
 *   const [name, setName] = useState('');
 *
 *   const handleSubmit = async (e: React.FormEvent) => {
 *     e.preventDefault();
 *     await updateBranch({
 *       variables: { id: branchId, input: { name } }
 *     });
 *   };
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <input value={name} onChange={e => setName(e.target.value)} />
 *       <button type="submit" disabled={loading}>Rename</button>
 *     </form>
 *   );
 * }
 * ```
 */
export function useUpdateBranch(
  options?: MutationHookOptions<UpdateBranchMutation, UpdateBranchMutationVariables>
) {
  return useMutation<UpdateBranchMutation, UpdateBranchMutationVariables>(UPDATE_BRANCH, options);
}

/**
 * React hook to delete a branch (soft delete).
 *
 * @param options - Additional Apollo mutation options
 * @returns Mutation function and result state
 *
 * @example
 * ```typescript
 * function DeleteBranchButton({ branchId }: { branchId: string }) {
 *   const [deleteBranch, { loading }] = useDeleteBranch();
 *
 *   const handleDelete = async () => {
 *     if (confirm('Are you sure you want to delete this branch?')) {
 *       await deleteBranch({ variables: { id: branchId } });
 *     }
 *   };
 *
 *   return (
 *     <button onClick={handleDelete} disabled={loading}>
 *       Delete
 *     </button>
 *   );
 * }
 * ```
 */
export function useDeleteBranch(
  options?: MutationHookOptions<DeleteBranchMutation, DeleteBranchMutationVariables>
) {
  return useMutation<DeleteBranchMutation, DeleteBranchMutationVariables>(DELETE_BRANCH, options);
}

/**
 * React hook to fork a branch (create child branch with version copies).
 *
 * This mutation creates a new child branch and copies all entity versions
 * at the specified world time from the source branch to the new branch.
 *
 * @param options - Additional Apollo mutation options
 * @returns Mutation function and result state
 *
 * @example
 * ```typescript
 * function ForkBranchButton({ sourceBranchId, worldTime }: { sourceBranchId: string; worldTime: string }) {
 *   const [forkBranch, { loading, data }] = useForkBranch();
 *
 *   const handleFork = async () => {
 *     const result = await forkBranch({
 *       variables: {
 *         input: {
 *           sourceBranchId,
 *           name: 'Alternate Timeline',
 *           description: 'What if...?',
 *           worldTime,
 *         }
 *       }
 *     });
 *     console.log(`Forked! Created ${result.data?.forkBranch.versionsCopied} versions`);
 *   };
 *
 *   return (
 *     <button onClick={handleFork} disabled={loading}>
 *       Fork Branch {loading && '(copying versions...)'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useForkBranch(
  options?: MutationHookOptions<ForkBranchMutation, ForkBranchMutationVariables>
) {
  return useMutation<ForkBranchMutation, ForkBranchMutationVariables>(FORK_BRANCH, options);
}

// Export types for convenience
export type {
  Branch,
  BranchNode,
  ForkResult,
  GetBranchQuery,
  GetBranchQueryVariables,
  GetBranchesQuery,
  GetBranchesQueryVariables,
  GetBranchHierarchyQuery,
  GetBranchHierarchyQueryVariables,
  CreateBranchInput,
  CreateBranchMutation,
  CreateBranchMutationVariables,
  UpdateBranchInput,
  UpdateBranchMutation,
  UpdateBranchMutationVariables,
  DeleteBranchMutation,
  DeleteBranchMutationVariables,
  ForkBranchInput,
  ForkBranchMutation,
  ForkBranchMutationVariables,
};
