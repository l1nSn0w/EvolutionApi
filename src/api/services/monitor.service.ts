import { execSync } from 'child_process';
import EventEmitter2 from 'eventemitter2';
import { existsSync, mkdirSync, opendirSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';

import {
  Auth,
  CacheConf,
  Chatwoot,
  ConfigService,
  Database,
  DelInstance,
  HttpServer,
  ProviderSession,
} from '../../config/env.config';
import { Logger } from '../../config/logger.config';
import { INSTANCE_DIR, STORE_DIR } from '../../config/path.config';
import { NotFoundException } from '../../exceptions';
import { ProviderFiles } from '../provider/sessions';
import { PrismaRepository } from '../repository/repository.service';
import { Integration } from '../types/wa.types';
import { CacheService } from './cache.service';
import { BaileysStartupService } from './channels/whatsapp.baileys.service';
import { BusinessStartupService } from './channels/whatsapp.business.service';

export class WAMonitoringService {
  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly prismaRepository: PrismaRepository,
    private readonly providerFiles: ProviderFiles,
    private readonly cache: CacheService,
    private readonly chatwootCache: CacheService,
    private readonly baileysCache: CacheService,
  ) {
    this.removeInstance();
    this.noConnection();

    Object.assign(this.db, configService.get<Database>('DATABASE'));
    Object.assign(this.redis, configService.get<CacheConf>('CACHE'));
  }

  private readonly db: Partial<Database> = {};
  private readonly redis: Partial<CacheConf> = {};

  private readonly logger = new Logger(WAMonitoringService.name);
  public readonly waInstances: Record<string, BaileysStartupService | BusinessStartupService> = {};

  private readonly providerSession = Object.freeze(this.configService.get<ProviderSession>('PROVIDER'));

  public delInstanceTime(instance: string) {
    const time = this.configService.get<DelInstance>('DEL_INSTANCE');
    if (typeof time === 'number' && time > 0) {
      setTimeout(async () => {
        if (this.waInstances[instance]?.connectionStatus?.state !== 'open') {
          if (this.waInstances[instance]?.connectionStatus?.state === 'connecting') {
            if ((await this.waInstances[instance].findIntegration()).integration === Integration.WHATSAPP_BAILEYS) {
              await this.waInstances[instance]?.client?.logout('Log out instance: ' + instance);
              this.waInstances[instance]?.client?.ws?.close();
              this.waInstances[instance]?.client?.end(undefined);
            }
            this.waInstances[instance]?.removeRabbitmqQueues();
            delete this.waInstances[instance];
          } else {
            this.waInstances[instance]?.removeRabbitmqQueues();
            delete this.waInstances[instance];
            this.eventEmitter.emit('remove.instance', instance, 'inner');
          }
        }
      }, 1000 * 60 * time);
    }
  }

  public async instanceInfo(instanceName?: string, arrayReturn = false) {
    if (instanceName && !this.waInstances[instanceName]) {
      throw new NotFoundException(`Instance "${instanceName}" not found`);
    }

    const instances: any[] = [];

    for await (const [key, value] of Object.entries(this.waInstances)) {
      if (value) {
        let chatwoot: any;
        const urlServer = this.configService.get<HttpServer>('SERVER').URL;

        if (this.configService.get<Chatwoot>('CHATWOOT').ENABLED) {
          const findChatwoot = await this.waInstances[key].findChatwoot();

          if (findChatwoot && findChatwoot.enabled) {
            chatwoot = {
              ...findChatwoot,
              webhook_url: `${urlServer}/chatwoot/webhook/${encodeURIComponent(key)}`,
            };
          }
        }

        const findIntegration = await this.waInstances[key].findIntegration();

        let integration: any;
        if (findIntegration) {
          integration = {
            ...findIntegration,
            webhookWaBusiness: `${urlServer}/webhook/whatsapp/${encodeURIComponent(key)}`,
          };
        }

        if (value.connectionStatus.state === 'open') {
          const instanceData = {
            instance: {
              instanceName: key,
              instanceId: this.waInstances[key].instanceId,
              owner: value.wuid,
              profileName: (await value.getProfileName()) || 'not loaded',
              profilePictureUrl: value.profilePictureUrl,
              profileStatus: (await value.getProfileStatus()) || '',
              status: value.connectionStatus.state,
            },
          };

          if (this.configService.get<Auth>('AUTHENTICATION').EXPOSE_IN_FETCH_INSTANCES) {
            instanceData.instance['serverUrl'] = this.configService.get<HttpServer>('SERVER').URL;

            instanceData.instance['apikey'] = (
              await this.prismaRepository.auth.findFirst({
                where: { instanceId: this.waInstances[key].instanceId },
              })
            )?.apikey;

            if (this.configService.get<Chatwoot>('CHATWOOT').ENABLED) instanceData.instance['chatwoot'] = chatwoot;

            instanceData.instance['integration'] = integration;
          }

          instances.push(instanceData);
        } else {
          const instanceData = {
            instance: {
              instanceName: key,
              instanceId: this.waInstances[key].instanceId,
              status: value.connectionStatus.state,
            },
          };

          if (this.configService.get<Auth>('AUTHENTICATION').EXPOSE_IN_FETCH_INSTANCES) {
            instanceData.instance['serverUrl'] = this.configService.get<HttpServer>('SERVER').URL;

            instanceData.instance['apikey'] = (
              await this.prismaRepository.auth.findFirst({
                where: { instanceId: this.waInstances[key].instanceId },
              })
            )?.apikey;

            if (this.configService.get<Chatwoot>('CHATWOOT').ENABLED) instanceData.instance['chatwoot'] = chatwoot;

            instanceData.instance['integration'] = integration;
          }

          instances.push(instanceData);
        }
      }
    }

    if (arrayReturn) {
      return [instances.find((i) => i.instance.instanceName === instanceName) ?? instances];
    }
    return instances.find((i) => i.instance.instanceName === instanceName) ?? instances;
  }

  public async instanceInfoById(instanceId?: string, number?: string) {
    let instanceName: string;
    if (instanceId) {
      instanceName = await this.prismaRepository.instance.findFirst({ where: { id: instanceId } }).then((r) => r?.name);
      if (!instanceName) {
        throw new NotFoundException(`Instance "${instanceId}" not found`);
      }
    } else if (number) {
      const id = await this.prismaRepository.integration.findFirst({ where: { number } }).then((r) => r?.instanceId);

      instanceName = await this.prismaRepository.instance.findFirst({ where: { id } }).then((r) => r?.name);
      if (!instanceName) {
        throw new NotFoundException(`Instance "${number}" not found`);
      }
    }

    if (!instanceName) {
      throw new NotFoundException(`Instance "${instanceId}" not found`);
    }

    if (instanceName && !this.waInstances[instanceName]) {
      throw new NotFoundException(`Instance "${instanceName}" not found`);
    }

    return this.instanceInfo(instanceName);
  }

  public async cleaningUp(instanceName: string) {
    if (this.db.ENABLED && this.db.SAVE_DATA.INSTANCE) {
      await this.prismaRepository.instance.update({
        where: { name: instanceName },
        data: { connectionStatus: 'close' },
      });

      await this.prismaRepository.session.deleteMany({ where: { sessionId: instanceName } });
      return;
    }

    if (this.redis.REDIS.ENABLED && this.redis.REDIS.SAVE_INSTANCES) {
      await this.cache.delete(instanceName);
      return;
    }

    if (this.providerSession?.ENABLED) {
      await this.providerFiles.removeSession(instanceName);
    }
    rmSync(join(INSTANCE_DIR, instanceName), { recursive: true, force: true });
  }

  public async cleaningStoreFiles(instanceName: string) {
    if (!this.db.ENABLED) {
      if (this.providerSession?.ENABLED) {
        await this.providerFiles.removeSession(instanceName);
      }
      rmSync(join(INSTANCE_DIR, instanceName), { recursive: true, force: true });

      execSync(`rm -rf ${join(STORE_DIR, 'chats', instanceName)}`);
      execSync(`rm -rf ${join(STORE_DIR, 'contacts', instanceName)}`);
      execSync(`rm -rf ${join(STORE_DIR, 'message-up', instanceName)}`);
      execSync(`rm -rf ${join(STORE_DIR, 'messages', instanceName)}`);

      execSync(`rm -rf ${join(STORE_DIR, 'auth', 'apikey', instanceName + '.json')}`);
      execSync(`rm -rf ${join(STORE_DIR, 'webhook', instanceName + '.json')}`);
      execSync(`rm -rf ${join(STORE_DIR, 'chatwoot', instanceName + '*')}`);
      execSync(`rm -rf ${join(STORE_DIR, 'proxy', instanceName + '*')}`);
      execSync(`rm -rf ${join(STORE_DIR, 'rabbitmq', instanceName + '*')}`);
      execSync(`rm -rf ${join(STORE_DIR, 'typebot', instanceName + '*')}`);
      execSync(`rm -rf ${join(STORE_DIR, 'websocket', instanceName + '*')}`);
      execSync(`rm -rf ${join(STORE_DIR, 'settings', instanceName + '*')}`);
      execSync(`rm -rf ${join(STORE_DIR, 'labels', instanceName + '*')}`);

      return;
    }

    await this.prismaRepository.session.deleteMany({ where: { sessionId: instanceName } });

    await this.prismaRepository.chat.deleteMany({ where: { instanceId: instanceName } });
    await this.prismaRepository.contact.deleteMany({ where: { instanceId: instanceName } });
    await this.prismaRepository.messageUpdate.deleteMany({ where: { instanceId: instanceName } });
    await this.prismaRepository.message.deleteMany({ where: { instanceId: instanceName } });

    await this.prismaRepository.integration.deleteMany({ where: { instanceId: instanceName } });
    await this.prismaRepository.auth.deleteMany({ where: { instanceId: instanceName } });
    await this.prismaRepository.webhook.deleteMany({ where: { instanceId: instanceName } });
    await this.prismaRepository.chatwoot.deleteMany({ where: { instanceId: instanceName } });
    await this.prismaRepository.proxy.deleteMany({ where: { instanceId: instanceName } });
    await this.prismaRepository.rabbitmq.deleteMany({ where: { instanceId: instanceName } });
    await this.prismaRepository.sqs.deleteMany({ where: { instanceId: instanceName } });
    await this.prismaRepository.typebotSession.deleteMany({ where: { instanceId: instanceName } });
    await this.prismaRepository.typebot.deleteMany({ where: { instanceId: instanceName } });
    await this.prismaRepository.websocket.deleteMany({ where: { instanceId: instanceName } });
    await this.prismaRepository.setting.deleteMany({ where: { instanceId: instanceName } });
    await this.prismaRepository.label.deleteMany({ where: { instanceId: instanceName } });

    await this.prismaRepository.instance.delete({ where: { name: instanceName } });
  }

  public async loadInstance() {
    try {
      if (this.providerSession.ENABLED) {
        await this.loadInstancesFromProvider();
      } else if (this.redis.REDIS.ENABLED && this.redis.REDIS.SAVE_INSTANCES) {
        await this.loadInstancesFromRedis();
      } else if (this.db.ENABLED && this.db.SAVE_DATA.INSTANCE) {
        await this.loadInstancesFromDatabasePostgres();
      } else {
        await this.loadInstancesFromFiles();
      }
    } catch (error) {
      this.logger.error(error);
    }
  }

  public async saveInstance(data: any) {
    try {
      const msgParsed = JSON.parse(JSON.stringify(data));
      if (this.db.ENABLED && this.db.SAVE_DATA.INSTANCE) {
        await this.prismaRepository.instance.create({
          data: {
            id: data.instanceId,
            name: data.instanceName,
            connectionStatus: 'close',
          },
        });

        await this.prismaRepository.integration.create({
          data: {
            instanceId: data.instanceId,
            integration: data.integration,
            number: data.number,
            token: data.token,
          },
        });
      } else {
        const path = join(INSTANCE_DIR, data.instanceName);
        if (!existsSync(path)) mkdirSync(path, { recursive: true });
        writeFileSync(path + '/integration.json', JSON.stringify(msgParsed));
      }
    } catch (error) {
      this.logger.error(error);
    }
  }

  private async setInstance(id: string, name: string) {
    const integration = await this.prismaRepository.integration.findUnique({
      where: { instanceId: id },
    });

    let instance: BaileysStartupService | BusinessStartupService;
    if (integration && integration.integration === Integration.WHATSAPP_BUSINESS) {
      instance = new BusinessStartupService(
        this.configService,
        this.eventEmitter,
        this.prismaRepository,
        this.cache,
        this.chatwootCache,
        this.baileysCache,
        this.providerFiles,
      );

      instance.instanceName = name;
      instance.instanceId = id;
    } else {
      instance = new BaileysStartupService(
        this.configService,
        this.eventEmitter,
        this.prismaRepository,
        this.cache,
        this.chatwootCache,
        this.baileysCache,
        this.providerFiles,
      );

      instance.instanceName = name;
      instance.instanceId = id;

      if (!integration) {
        await instance.setIntegration({ integration: Integration.WHATSAPP_BAILEYS, number: '', token: '' });
      }
    }

    await instance.connectToWhatsapp();

    this.waInstances[name] = instance;
  }

  private async loadInstancesFromRedis() {
    const keys = await this.cache.keys();

    if (keys?.length > 0) {
      await Promise.all(keys.map((k) => this.setInstance(k.split(':')[1], k.split(':')[2])));
    }
  }

  private async loadInstancesFromDatabasePostgres() {
    const instances = await this.prismaRepository.instance.findMany();

    if (instances.length === 0) {
      return;
    }

    await Promise.all(instances.map(async (instance) => this.setInstance(instance.id, instance.name)));
  }

  private async loadInstancesFromProvider() {
    const [instances] = await this.providerFiles.allInstances();

    if (!instances?.data) {
      return;
    }

    await Promise.all(instances?.data?.map(async (instanceName: string) => this.setInstance('', instanceName)));
  }

  private async loadInstancesFromFiles() {
    const dir = opendirSync(INSTANCE_DIR, { encoding: 'utf-8' });
    const instanceDirs = [];

    for await (const dirent of dir) {
      if (dirent.isDirectory()) {
        instanceDirs.push(dirent.name);
      }
    }

    await Promise.all(
      instanceDirs.map(async (instanceName) => {
        const files = readdirSync(join(INSTANCE_DIR, instanceName), { encoding: 'utf-8' });

        if (files.length === 0) {
          rmSync(join(INSTANCE_DIR, instanceName), { recursive: true, force: true });
        } else {
          await this.setInstance('', instanceName);
        }
      }),
    );
  }

  private removeInstance() {
    this.eventEmitter.on('remove.instance', async (instanceName: string) => {
      try {
        this.waInstances[instanceName] = undefined;
      } catch (error) {
        this.logger.error(error);
      }

      try {
        this.cleaningUp(instanceName);
        this.cleaningStoreFiles(instanceName);
      } finally {
        this.logger.warn(`Instance "${instanceName}" - REMOVED`);
      }
    });
    this.eventEmitter.on('logout.instance', async (instanceName: string) => {
      try {
        if (this.configService.get<Chatwoot>('CHATWOOT').ENABLED) this.waInstances[instanceName]?.clearCacheChatwoot();
        this.cleaningUp(instanceName);
      } finally {
        this.logger.warn(`Instance "${instanceName}" - LOGOUT`);
      }
    });
  }

  private noConnection() {
    this.eventEmitter.on('no.connection', async (instanceName) => {
      try {
        await this.waInstances[instanceName]?.client?.logout('Log out instance: ' + instanceName);

        this.waInstances[instanceName]?.client?.ws?.close();

        this.waInstances[instanceName].instance.qrcode = { count: 0 };
        this.waInstances[instanceName].stateConnection.state = 'close';
      } catch (error) {
        this.logger.error({
          localError: 'noConnection',
          warn: 'Error deleting instance from memory.',
          error,
        });
      } finally {
        this.logger.warn(`Instance "${instanceName}" - NOT CONNECTION`);
      }
    });
  }

  private delInstanceFiles() {
    setInterval(async () => {
      const dir = opendirSync(INSTANCE_DIR, { encoding: 'utf-8' });
      for await (const dirent of dir) {
        if (dirent.isDirectory()) {
          const files = readdirSync(join(INSTANCE_DIR, dirent.name), {
            encoding: 'utf-8',
          });
          files.forEach(async (file) => {
            if (file.match(/^app.state.*/) || file.match(/^session-.*/)) {
              rmSync(join(INSTANCE_DIR, dirent.name, file), {
                recursive: true,
                force: true,
              });
            }
          });
        }
      }
    }, 3600 * 1000 * 2);
  }

  private async deleteTempInstances() {
    const shouldDelete = this.configService.get<boolean>('DEL_TEMP_INSTANCES');
    if (!shouldDelete) {
      return;
    }
    const instancesClosed = await this.prismaRepository.instance.findMany({ where: { connectionStatus: 'close' } });

    let tempInstances = 0;
    instancesClosed.forEach((instance) => {
      tempInstances++;
      this.eventEmitter.emit('remove.instance', instance.id, 'inner');
    });
    this.logger.log('Temp instances removed: ' + tempInstances);
  }
}
