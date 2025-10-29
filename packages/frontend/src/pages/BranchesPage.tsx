import { BranchComparisonView, BranchHierarchyView } from '@/components/features/branches';

/**
 * Branches Page
 *
 * Displays the branch hierarchy visualization and comparison tools for the current campaign.
 * Users can view all branches, switch between them, perform branch operations, and compare
 * entity states between branches.
 */
export function BranchesPage() {
  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Branch Management</h1>
        <p className="mt-1 text-sm text-gray-600">
          View and manage alternate timeline branches for your campaign
        </p>
      </div>

      {/* Branch hierarchy view */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          <BranchHierarchyView />
          <BranchComparisonView />
        </div>
      </div>
    </div>
  );
}

export default BranchesPage;
