import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import {
  LocationPopupContent,
  SettlementPopupContent,
  StructurePopupContent,
} from './EntityPopupContent';
import type { LocationPopupData, SettlementPopupData, StructurePopupData } from './types';

describe('LocationPopupContent', () => {
  it('should render location point data', () => {
    const data: LocationPopupData = {
      type: 'location-point',
      id: 'loc-1',
      name: 'Test Location',
      description: 'A test location',
      coordinates: [10.5, 20.5],
    };

    render(<LocationPopupContent data={data} />);

    expect(screen.getByText('Test Location')).toBeInTheDocument();
    expect(screen.getByText('Point')).toBeInTheDocument();
    expect(screen.getByText('A test location')).toBeInTheDocument();
    expect(screen.getByText(/10.5000.*20.5000/)).toBeInTheDocument();
  });

  it('should render location region data', () => {
    const data: LocationPopupData = {
      type: 'location-region',
      id: 'loc-2',
      name: 'Test Region',
      coordinates: [15.5, 25.5],
    };

    render(<LocationPopupContent data={data} />);

    expect(screen.getByText('Test Region')).toBeInTheDocument();
    expect(screen.getByText('Region')).toBeInTheDocument();
    expect(screen.queryByText(/Description/)).not.toBeInTheDocument();
  });

  it('should handle missing description', () => {
    const data: LocationPopupData = {
      type: 'location-point',
      id: 'loc-3',
      name: 'No Description',
      coordinates: [0, 0],
    };

    render(<LocationPopupContent data={data} />);

    expect(screen.getByText('No Description')).toBeInTheDocument();
    expect(screen.queryByText(/Description:/)).not.toBeInTheDocument();
  });
});

describe('SettlementPopupContent', () => {
  it('should render settlement data with all fields', () => {
    const data: SettlementPopupData = {
      type: 'settlement',
      id: 'settlement-1',
      name: 'Test Settlement',
      level: 3,
      kingdomId: 'kingdom-1',
      typedVariables: {
        population: 1000,
        wealth: 500,
      },
      coordinates: [30.5, 40.5],
    };

    render(<SettlementPopupContent data={data} />);

    expect(screen.getByText('Test Settlement')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('kingdom-1')).toBeInTheDocument();

    // Check variables section exists
    const variablesSection = screen.getByText('Variables:').parentElement;
    expect(variablesSection).toBeInTheDocument();

    // Check individual variables
    expect(within(variablesSection!).getByText(/population:/)).toBeInTheDocument();
    expect(within(variablesSection!).getByText(/1000/)).toBeInTheDocument();
    expect(within(variablesSection!).getByText(/wealth:/)).toBeInTheDocument();

    // Verify 500 appears as wealth value (not just in coordinates)
    const variableValues = within(variablesSection!).getAllByText(/500/);
    expect(variableValues.length).toBeGreaterThan(0);
  });

  it('should handle missing optional fields', () => {
    const data: SettlementPopupData = {
      type: 'settlement',
      id: 'settlement-2',
      name: 'Minimal Settlement',
      level: 1,
      coordinates: [0, 0],
    };

    render(<SettlementPopupContent data={data} />);

    expect(screen.getByText('Minimal Settlement')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.queryByText(/Kingdom ID/)).not.toBeInTheDocument();
    expect(screen.queryByText('Variables:')).not.toBeInTheDocument();
  });

  it('should handle empty typedVariables', () => {
    const data: SettlementPopupData = {
      type: 'settlement',
      id: 'settlement-3',
      name: 'Empty Variables',
      level: 2,
      typedVariables: {},
      coordinates: [10, 20],
    };

    render(<SettlementPopupContent data={data} />);

    expect(screen.queryByText('Variables:')).not.toBeInTheDocument();
  });

  it('should stringify object values in typedVariables', () => {
    const data: SettlementPopupData = {
      type: 'settlement',
      id: 'settlement-4',
      name: 'Object Variables',
      level: 2,
      typedVariables: {
        config: { enabled: true, value: 42 },
      },
      coordinates: [10, 20],
    };

    render(<SettlementPopupContent data={data} />);

    expect(screen.getByText(/config/)).toBeInTheDocument();
    expect(screen.getByText(/"enabled":true/)).toBeInTheDocument();
  });
});

describe('StructurePopupContent', () => {
  it('should render structure data with all fields', () => {
    const data: StructurePopupData = {
      type: 'structure',
      id: 'structure-1',
      name: 'Test Structure',
      structureType: 'BARRACKS',
      level: 2,
      settlementId: 'settlement-1',
      typedVariables: {
        capacity: 100,
        training: 'ADVANCED',
      },
      coordinates: [50.5, 60.5],
    };

    render(<StructurePopupContent data={data} />);

    expect(screen.getByText('Test Structure')).toBeInTheDocument();
    expect(screen.getByText('BARRACKS')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('settlement-1')).toBeInTheDocument();
    expect(screen.getByText('Variables:')).toBeInTheDocument();
    expect(screen.getByText(/capacity/)).toBeInTheDocument();
    expect(screen.getByText(/100/)).toBeInTheDocument();
  });

  it('should handle missing optional fields', () => {
    const data: StructurePopupData = {
      type: 'structure',
      id: 'structure-2',
      name: 'Minimal Structure',
      structureType: 'FARM',
      level: 1,
      coordinates: [0, 0],
    };

    render(<StructurePopupContent data={data} />);

    expect(screen.getByText('Minimal Structure')).toBeInTheDocument();
    expect(screen.getByText('FARM')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.queryByText(/Settlement ID/)).not.toBeInTheDocument();
    expect(screen.queryByText('Variables:')).not.toBeInTheDocument();
  });

  it('should handle empty typedVariables', () => {
    const data: StructurePopupData = {
      type: 'structure',
      id: 'structure-3',
      name: 'Empty Variables',
      structureType: 'MINE',
      level: 3,
      typedVariables: {},
      coordinates: [10, 20],
    };

    render(<StructurePopupContent data={data} />);

    expect(screen.queryByText('Variables:')).not.toBeInTheDocument();
  });
});
