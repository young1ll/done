import { Module, Global } from '@nestjs/common';
import { DatabaseService } from './database.service.js';

/**
 * DatabaseModule provides the DatabaseService globally
 * so all other modules can inject it without importing DatabaseModule
 */
@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
