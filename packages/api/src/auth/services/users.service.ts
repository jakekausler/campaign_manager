/**
 * User management service.
 *
 * Provides core user CRUD operations including creation, retrieval, updates,
 * and soft deletion. This service handles user data persistence through Prisma
 * and is used by the authentication system for user account management.
 */

import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

interface CreateUserData {
  email: string;
  password: string;
  name: string;
}

/**
 * Service for managing user accounts and user data operations.
 *
 * Handles all user-related database operations including user creation,
 * retrieval by email/ID, updates, and soft deletion. Works in conjunction
 * with the authentication service for user account management.
 *
 * @remarks
 * All query operations automatically exclude soft-deleted users (deletedAt !== null).
 * Password hashing should be handled by the authentication service before
 * calling the create method.
 */
@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Creates a new user account.
   *
   * @param data - User creation data including email, password, and name
   * @returns The newly created user record
   *
   * @throws PrismaClientKnownRequestError with code P2002 if email already exists
   *
   * @remarks
   * Password should be hashed before calling this method. This service does not
   * handle password hashing - that responsibility lies with the authentication service.
   * Email uniqueness is enforced at the database level.
   */
  async create(data: CreateUserData): Promise<User> {
    return this.prisma.user.create({
      data,
    });
  }

  /**
   * Finds a user by their email address.
   *
   * @param email - The email address to search for
   * @returns The user record if found, null otherwise
   *
   * @remarks
   * Only returns active (non-deleted) users. Soft-deleted users are automatically
   * excluded from the query. This method is commonly used during authentication
   * to look up users by their login email.
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: {
        email,
        deletedAt: null,
      },
    });
  }

  /**
   * Finds a user by their unique ID.
   *
   * @param id - The user's unique identifier (UUID)
   * @returns The user record if found, null otherwise
   *
   * @remarks
   * Only returns active (non-deleted) users. Soft-deleted users are automatically
   * excluded from the query. This method is used to retrieve user details after
   * authentication or when referencing users in other parts of the system.
   */
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: {
        id,
        deletedAt: null,
      },
    });
  }

  /**
   * Retrieves all active users.
   *
   * @returns Array of all active user records
   *
   * @remarks
   * Only returns active (non-deleted) users. Soft-deleted users are automatically
   * excluded from the query. This method should be used with caution in production
   * environments as it may return large datasets. Consider adding pagination for
   * large user bases.
   */
  async findAll(): Promise<User[]> {
    return this.prisma.user.findMany({
      where: {
        deletedAt: null,
      },
    });
  }

  /**
   * Updates an existing user's information.
   *
   * @param id - The unique identifier of the user to update
   * @param data - Partial user data to update (email, password, and/or name)
   * @returns The updated user record
   *
   * @throws PrismaClientKnownRequestError with code P2025 if user not found
   * @throws PrismaClientKnownRequestError with code P2002 if email already exists
   *
   * @remarks
   * This method performs a partial update - only provided fields will be modified.
   * If updating the password, ensure it is hashed before calling this method.
   * Email uniqueness is enforced at the database level. This method does not
   * check if the user is soft-deleted before updating.
   */
  async update(id: string, data: Partial<CreateUserData>): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  /**
   * Soft-deletes a user by setting their deletedAt timestamp.
   *
   * @param id - The unique identifier of the user to delete
   * @returns The updated user record with deletedAt set
   *
   * @throws PrismaClientKnownRequestError with code P2025 if user not found
   *
   * @remarks
   * This performs a soft delete by setting the deletedAt timestamp to the current date/time.
   * The user record is not physically removed from the database and can potentially be
   * restored by setting deletedAt back to null. Soft-deleted users are automatically
   * excluded from all query operations (findByEmail, findById, findAll) but will still
   * exist in the database for audit purposes. This maintains referential integrity for
   * any related records that reference this user.
   *
   * @security
   * Consider implications for email uniqueness - a soft-deleted user's email remains
   * in the database and will prevent new registrations with that email address unless
   * the unique constraint is updated to include deletedAt.
   */
  async softDelete(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }
}
