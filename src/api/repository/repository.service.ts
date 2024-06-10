import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import { join } from 'path';

import { ConfigService } from '../../config/env.config';
import { Logger } from '../../config/logger.config';

export class Query<T> {
  where?: T;
  sort?: 'asc' | 'desc';
  page?: number;
  offset?: number;
}

export class PrismaRepository extends PrismaClient {
  constructor(private readonly configService: ConfigService) {
    super();

    this.initStoreFolders();
  }

  private async initStoreFolders() {
    try {
      const storePath = join(process.cwd(), 'store');

      this.logger.verbose('creating store path: ' + storePath);

      const tempDir = join(storePath, 'temp');
      const chatwootDir = join(storePath, 'chatwoot');

      if (!fs.existsSync(chatwootDir)) {
        this.logger.verbose('creating chatwoot dir: ' + chatwootDir);
        fs.mkdirSync(chatwootDir, { recursive: true });
      }
      if (!fs.existsSync(tempDir)) {
        this.logger.verbose('creating temp dir: ' + tempDir);
        fs.mkdirSync(tempDir, { recursive: true });
      }
    } catch (error) {
      this.logger.error(error);
    }
  }

  private readonly logger = new Logger(PrismaRepository.name);

  public async onModuleInit() {
    await this.$connect();
    this.logger.info('Repository:Prisma - ON');
  }

  public async onModuleDestroy() {
    await this.$disconnect();
    this.logger.warn('Repository:Prisma - OFF');
  }
}
