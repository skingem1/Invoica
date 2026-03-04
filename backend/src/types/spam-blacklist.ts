/**
 * Spam Blacklist Type Definitions
 * TypeScript interfaces and types for the spam blacklist API
 */

import type { RequestWithAdmin } from '../middleware/auth.js';

/**
 * Enum representing the type of spam entry
 */
export enum SpamEntryType {
  EMAIL = 'email',
  IP = 'ip',
}

/**
 * Interface representing a spam blacklist entry in the system
 */
export interface SpamBlacklistEntry {
  id: string;
  type: SpamEntryType;
  value: string;
  reason: string;
  created_by: string;
  created_at: string;
}

/**
 * Input type for creating a new spam blacklist entry
 */
export interface SpamBlacklistCreateInput {
  type: SpamEntryType;
  value: string;
  reason: string;
}

/**
 * Generic API response wrapper for consistent responses across the API
 */
export interface ApiResponse<T> {
  data: T;
}

// Re-export the RequestWithAdmin type from auth middleware for use in spam blacklist routes
export type { RequestWithAdmin };