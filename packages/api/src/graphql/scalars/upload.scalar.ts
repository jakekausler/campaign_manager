/**
 * Upload Scalar
 * Handles file uploads in GraphQL via graphql-upload
 */

import { Scalar } from '@nestjs/graphql';
import GraphQLUpload from 'graphql-upload/GraphQLUpload.mjs';

/**
 * File upload details from graphql-upload
 */
export interface FileUpload {
  filename: string;
  mimetype: string;
  encoding: string;
  createReadStream: () => NodeJS.ReadableStream;
}

@Scalar('Upload')
export class UploadScalar {
  description = 'File upload scalar type';

  // Use graphql-upload's implementation directly
  // These methods handle the Upload class from graphql-upload
  parseValue = GraphQLUpload.parseValue;
  serialize = GraphQLUpload.serialize;
  parseLiteral = GraphQLUpload.parseLiteral;
}
