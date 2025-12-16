import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from 'src/generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    // 1. Validate that the URL exists before crashing
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not defined in environment variables');
    }

    // 2. Create the PG Pool explicitly
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const pool = new Pool({
      connectionString,
    });

    // 3. Create the Adapter
    const adapter = new PrismaPg(pool);

    // 4. Instantiate PrismaClient with the 'adapter' Option
    super({
      adapter,
      // Add other global options here if needed
      // log: ['query', 'info', 'warn', 'error'],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Prisma connected successfully with PG Adapter');
    } catch (error) {
      this.logger.error('Failed to connect to DB', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
