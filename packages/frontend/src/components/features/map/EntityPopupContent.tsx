import type { LocationPopupData, SettlementPopupData, StructurePopupData } from './types';

/**
 * Popup content for Location entities
 */
export function LocationPopupContent({ data }: { data: LocationPopupData }) {
  return (
    <div className="p-3 min-w-[200px]">
      <h3 className="font-semibold text-lg mb-2">{data.name}</h3>
      <div className="space-y-1 text-sm">
        <div className="text-gray-600">
          <span className="font-medium">Type:</span>{' '}
          {data.type === 'location-point' ? 'Point' : 'Region'}
        </div>
        {data.description && (
          <div className="text-gray-600">
            <span className="font-medium">Description:</span> {data.description}
          </div>
        )}
        <div className="text-gray-500 text-xs mt-2">
          Coordinates: [{data.coordinates[0].toFixed(4)}, {data.coordinates[1].toFixed(4)}]
        </div>
      </div>
    </div>
  );
}

/**
 * Popup content for Settlement entities
 */
export function SettlementPopupContent({ data }: { data: SettlementPopupData }) {
  return (
    <div className="p-3 min-w-[200px]">
      <h3 className="font-semibold text-lg mb-2">{data.name}</h3>
      <div className="space-y-1 text-sm">
        <div className="text-gray-600">
          <span className="font-medium">Level:</span> {data.level}
        </div>
        {data.kingdomId && (
          <div className="text-gray-600">
            <span className="font-medium">Kingdom ID:</span> {data.kingdomId}
          </div>
        )}
        {data.typedVariables && Object.keys(data.typedVariables).length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <div className="font-medium text-gray-700 mb-1">Variables:</div>
            <div className="space-y-1">
              {Object.entries(data.typedVariables).map(([key, value]) => (
                <div key={key} className="text-gray-600">
                  <span className="font-medium">{key}:</span>{' '}
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="text-gray-500 text-xs mt-2">
          Coordinates: [{data.coordinates[0].toFixed(4)}, {data.coordinates[1].toFixed(4)}]
        </div>
      </div>
    </div>
  );
}

/**
 * Popup content for Structure entities
 */
export function StructurePopupContent({ data }: { data: StructurePopupData }) {
  return (
    <div className="p-3 min-w-[200px]">
      <h3 className="font-semibold text-lg mb-2">{data.name}</h3>
      <div className="space-y-1 text-sm">
        <div className="text-gray-600">
          <span className="font-medium">Type:</span> {data.structureType}
        </div>
        <div className="text-gray-600">
          <span className="font-medium">Level:</span> {data.level}
        </div>
        {data.settlementId && (
          <div className="text-gray-600">
            <span className="font-medium">Settlement ID:</span> {data.settlementId}
          </div>
        )}
        {data.typedVariables && Object.keys(data.typedVariables).length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <div className="font-medium text-gray-700 mb-1">Variables:</div>
            <div className="space-y-1">
              {Object.entries(data.typedVariables).map(([key, value]) => (
                <div key={key} className="text-gray-600">
                  <span className="font-medium">{key}:</span>{' '}
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="text-gray-500 text-xs mt-2">
          Coordinates: [{data.coordinates[0].toFixed(4)}, {data.coordinates[1].toFixed(4)}]
        </div>
      </div>
    </div>
  );
}
