/**
 * Spatial Input Types
 * DTOs for spatial queries and geometry mutations
 */

import { InputType, Field, ID, Float, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsInt,
  IsDate,
  IsArray,
  ValidateNested,
  IsString,
  IsBoolean,
} from 'class-validator';

import { GeoJSONScalar } from '../scalars/geojson.scalar';

/**
 * Bounding box for map viewport queries
 */
@InputType()
export class BoundingBoxInput {
  @Field(() => Float, { description: 'Western longitude' })
  @IsNumber()
  @IsNotEmpty()
  west!: number;

  @Field(() => Float, { description: 'Southern latitude' })
  @IsNumber()
  @IsNotEmpty()
  south!: number;

  @Field(() => Float, { description: 'Eastern longitude' })
  @IsNumber()
  @IsNotEmpty()
  east!: number;

  @Field(() => Float, { description: 'Northern latitude' })
  @IsNumber()
  @IsNotEmpty()
  north!: number;
}

/**
 * Point coordinates for spatial queries
 */
@InputType()
export class PointInput {
  @Field(() => Float, { description: 'Longitude' })
  @IsNumber()
  @IsNotEmpty()
  longitude!: number;

  @Field(() => Float, { description: 'Latitude' })
  @IsNumber()
  @IsNotEmpty()
  latitude!: number;
}

/**
 * Map layer filter options
 */
@InputType()
export class MapFilterInput {
  @Field(() => [String], { nullable: true, description: 'Filter by entity types' })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  entityTypes?: string[];

  @Field(() => Boolean, { nullable: true, description: 'Filter by availability' })
  @IsBoolean()
  @IsOptional()
  availableOnly?: boolean;

  @Field(() => [String], { nullable: true, description: 'Filter by tags' })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  tags?: string[];

  @Field(() => [String], {
    nullable: true,
    description: 'Filter by location types (point, region)',
  })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  locationTypes?: string[];
}

/**
 * Input for updating location geometry
 */
@InputType()
export class UpdateLocationGeometryInput {
  @Field(() => GeoJSONScalar, { description: 'GeoJSON geometry (Point, Polygon, or MultiPolygon)' })
  @IsNotEmpty()
  geoJson!: unknown; // Using unknown to accept any GeoJSON geometry type

  @Field(() => Int, { nullable: true, description: 'Custom SRID (defaults to campaign SRID)' })
  @IsInt()
  @IsOptional()
  srid?: number;

  @Field(() => ID, { description: 'Branch ID for versioning' })
  @IsUUID()
  @IsNotEmpty()
  branchId!: string;

  @Field(() => Int, { description: 'Expected version for optimistic locking' })
  @IsInt()
  @IsNotEmpty()
  expectedVersion!: number;

  @Field(() => String, { nullable: true, description: 'World time for time-travel' })
  @IsDate()
  @IsOptional()
  @Type(() => Date)
  worldTime?: Date;
}

/**
 * Input for querying locations near a point
 */
@InputType()
export class LocationsNearInput {
  @Field(() => PointInput, { description: 'Center point' })
  @ValidateNested()
  @Type(() => PointInput)
  @IsNotEmpty()
  point!: PointInput;

  @Field(() => Float, { description: 'Radius in meters' })
  @IsNumber()
  @IsNotEmpty()
  radius!: number;

  @Field(() => Int, {
    nullable: true,
    description: 'SRID for point coordinates (defaults to 3857)',
  })
  @IsInt()
  @IsOptional()
  srid?: number;

  @Field(() => ID, { nullable: true, description: 'Filter by world ID' })
  @IsUUID()
  @IsOptional()
  worldId?: string;
}

/**
 * Input for querying settlements near a point
 */
@InputType()
export class SettlementsNearInput {
  @Field(() => PointInput, { description: 'Center point' })
  @ValidateNested()
  @Type(() => PointInput)
  @IsNotEmpty()
  point!: PointInput;

  @Field(() => Float, { description: 'Radius in meters' })
  @IsNumber()
  @IsNotEmpty()
  radius!: number;

  @Field(() => Int, {
    nullable: true,
    description: 'SRID for point coordinates (defaults to 3857)',
  })
  @IsInt()
  @IsOptional()
  srid?: number;

  @Field(() => ID, { nullable: true, description: 'Filter by world ID' })
  @IsUUID()
  @IsOptional()
  worldId?: string;
}
