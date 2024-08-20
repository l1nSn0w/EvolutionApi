import { PrismaRepository } from '@api/repository/repository.service';
import { WAMonitoringService } from '@api/services/monitor.service';
import { wa } from '@api/types/wa.types';
import { configService, Log, Webhook, Websocket } from '@config/env.config';
import { Logger } from '@config/logger.config';
import { BadRequestException, NotFoundException } from '@exceptions';
import axios from 'axios';
import { isURL } from 'class-validator';

import { EventController } from '../../event.controller';
import { WebhookDto } from '../dto/webhook.dto';

export class WebhookController extends EventController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(prismaRepository: PrismaRepository, waMonitor: WAMonitoringService) {
    super(prismaRepository, waMonitor);
  }

  public async set(instanceName: string, data: WebhookDto): Promise<wa.LocalWebHook> {
    if (!isURL(data.url, { require_tld: false })) {
      throw new BadRequestException('Invalid "url" property');
    }

    if (!data.enabled) {
      data.events = [];
    } else {
      if (0 === data.events.length) {
        data.events = this.events;
      }
    }

    try {
      await this.get(instanceName);

      return this.prisma.webhook.update({
        where: {
          instanceId: this.monitor.waInstances[instanceName].instanceId,
        },
        data,
      });
    } catch (err) {
      return this.prisma.webhook.create({
        data: {
          enabled: data.enabled,
          events: data.events,
          instanceId: this.monitor.waInstances[instanceName].instanceId,
          url: data.url,
          webhookBase64: data.webhookBase64,
          webhookByEvents: data.webhookByEvents,
        },
      });
    }
  }

  public async get(instanceName: string): Promise<wa.LocalWebHook> {
    if (undefined === this.monitor.waInstances[instanceName]) {
      throw new NotFoundException('Instance not found');
    }

    const data = await this.prisma.webhook.findUnique({
      where: {
        instanceId: this.monitor.waInstances[instanceName].instanceId,
      },
    });

    if (!data) {
      return null;
    }

    return data;
  }

  public async emit({
    instanceName,
    origin,
    event,
    data,
    serverUrl,
    dateTime,
    sender,
    apiKey,
    local,
  }: {
    instanceName: string;
    origin: string;
    event: string;
    data: Object;
    serverUrl: string;
    dateTime: string;
    sender: string;
    apiKey?: string;
    local?: boolean;
  }): Promise<void> {
    if (!configService.get<Websocket>('WEBSOCKET')?.ENABLED) {
      return;
    }

    const instanceWebhook = await this.get(instanceName);
    const webhookGlobal = configService.get<Webhook>('WEBHOOK');
    const webhookLocal = instanceWebhook?.events;
    const we = event.replace(/[.-]/gm, '_').toUpperCase();
    const transformedWe = we.replace(/_/gm, '-').toLowerCase();
    const enabledLog = configService.get<Log>('LOG').LEVEL.includes('WEBHOOKS');

    const webhookData = {
      event,
      instance: instanceName,
      data,
      destination: instanceWebhook?.url,
      date_time: dateTime,
      sender,
      server_url: serverUrl,
      apikey: apiKey,
    };
    if (local) {
      if (Array.isArray(webhookLocal) && webhookLocal.includes(we)) {
        let baseURL: string;

        if (instanceWebhook?.webhookByEvents) {
          baseURL = `${instanceWebhook?.url}/${transformedWe}`;
        } else {
          baseURL = instanceWebhook?.url;
        }

        if (enabledLog) {
          const logData = {
            local: `${origin}.sendData-Webhook`,
            url: baseURL,
            ...webhookData,
          };

          this.logger.log(logData);
        }

        try {
          if (instanceWebhook?.enabled && isURL(instanceWebhook.url, { require_tld: false })) {
            const httpService = axios.create({ baseURL });

            await httpService.post('', webhookData);
          }
        } catch (error) {
          this.logger.error({
            local: `${origin}.sendData-Webhook`,
            message: error?.message,
            hostName: error?.hostname,
            syscall: error?.syscall,
            code: error?.code,
            error: error?.errno,
            stack: error?.stack,
            name: error?.name,
            url: baseURL,
            server_url: serverUrl,
          });
        }
      }
    }

    if (webhookGlobal.GLOBAL?.ENABLED) {
      if (webhookGlobal.EVENTS[we]) {
        const globalWebhook = configService.get<Webhook>('WEBHOOK').GLOBAL;

        let globalURL;

        if (webhookGlobal.GLOBAL.WEBHOOK_BY_EVENTS) {
          globalURL = `${globalWebhook.URL}/${transformedWe}`;
        } else {
          globalURL = globalWebhook.URL;
        }

        if (enabledLog) {
          const logData = {
            local: `${origin}.sendData-Webhook-Global`,
            url: globalURL,
            ...webhookData,
          };

          this.logger.log(logData);
        }

        try {
          if (globalWebhook && globalWebhook?.ENABLED && isURL(globalURL)) {
            const httpService = axios.create({ baseURL: globalURL });

            await httpService.post('', webhookData);
          }
        } catch (error) {
          this.logger.error({
            local: `${origin}.sendData-Webhook-Global`,
            message: error?.message,
            hostName: error?.hostname,
            syscall: error?.syscall,
            code: error?.code,
            error: error?.errno,
            stack: error?.stack,
            name: error?.name,
            url: globalURL,
            server_url: serverUrl,
          });
        }
      }
    }
  }

  public async receiveWebhook(data: any) {
    if (data.object === 'whatsapp_business_account') {
      if (data.entry[0]?.changes[0]?.field === 'message_template_status_update') {
        const template = await this.prismaRepository.template.findFirst({
          where: { templateId: `${data.entry[0].changes[0].value.message_template_id}` },
        });

        if (!template) {
          console.log('template not found');
          return;
        }

        const { webhookUrl } = template;

        await axios.post(webhookUrl, data.entry[0].changes[0].value, {
          headers: {
            'Content-Type': 'application/json',
          },
        });
        return;
      }

      data.entry?.forEach(async (entry: any) => {
        const numberId = entry.changes[0].value.metadata.phone_number_id;

        if (!numberId) {
          this.logger.error('WebhookService -> receiveWebhook -> numberId not found');
          return;
        }

        const instance = await this.prismaRepository.instance.findFirst({
          where: { number: numberId },
        });

        if (!instance) {
          this.logger.error('WebhookService -> receiveWebhook -> instance not found');
          return;
        }

        await this.waMonitor.waInstances[instance.name].connectToWhatsapp(data);

        return;
      });
    }

    return;
  }
}
