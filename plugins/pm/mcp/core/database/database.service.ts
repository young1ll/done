import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { DatabaseManager } from '../../lib/db.js';
import type Database from 'better-sqlite3';

/**
 * DatabaseService wraps the existing DatabaseManager
 * and provides it as a NestJS injectable service
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private dbManager: DatabaseManager;

  constructor() {
    const dbPath = process.env.PM_DB_PATH || '.claude/pm.db';
    this.dbManager = new DatabaseManager(dbPath);
    this.dbManager.initSchema();
  }

  /**
   * Get the underlying DatabaseManager instance
   */
  getManager(): DatabaseManager {
    return this.dbManager;
  }

  /**
   * Query multiple rows
   */
  query<T = any>(sql: string, params?: any[]): T[] {
    return this.dbManager.query<T>(sql, params);
  }

  /**
   * Query single row
   */
  queryOne<T = any>(sql: string, params?: any[]): T | undefined {
    return this.dbManager.queryOne<T>(sql, params);
  }

  /**
   * Execute a statement (INSERT, UPDATE, DELETE)
   */
  execute(sql: string, params?: any[]): Database.RunResult {
    return this.dbManager.execute(sql, params);
  }

  /**
   * Run multiple statements in a transaction
   */
  transaction<T>(fn: () => T): T {
    return this.dbManager.transaction(fn);
  }

  /**
   * Cleanup on module destroy
   */
  onModuleDestroy() {
    this.dbManager.close();
  }
}
