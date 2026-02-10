import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { AlertService } from './alert.service';
import { AlertRulesEngine } from './alert-rules.engine';
import { EvaluateEventJob, SendWebhookJob } from './interfaces/alert.interface';
import { ALERT_QUEUE_NAME, WEBHOOK_MAX_RETRIES } from './alert.constants';

@Processor(ALERT_QUEUE_NAME)
export class AlertProcessor extends WorkerHost {
  private readonly logger = new Logger(AlertProcessor.name);

  constructor(
    private readonly alertService: AlertService,
    private readonly rulesEngine: AlertRulesEngine,
    @InjectQueue(ALERT_QUEUE_NAME) private readonly alertQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<EvaluateEventJob | SendWebhookJob>): Promise<void> {
    try {
      if (job.name === 'evaluate-event') {
        await this.handleEvaluateEvent(job as Job<EvaluateEventJob>);
      } else if (job.name === 'send-webhook') {
        await this.handleSendWebhook(job as Job<SendWebhookJob>);
      }
    } catch (error) {
      this.logger.error(
        `Alert processor error (${job.name}): ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async handleEvaluateEvent(job: Job<EvaluateEventJob>): Promise<void> {
    const { event } = job.data;
    const conditions = await this.rulesEngine.evaluateEvent(event);

    for (const condition of conditions) {
      if (!condition.matched) continue;

      const rule = this.rulesEngine.getRuleById(condition.ruleId);
      if (!rule) continue;

      const title = rule.name;
      const message = this.buildAlertMessage(rule.name, condition, event);

      const alert = await this.alertService.createAlert({
        severity: rule.severity,
        title,
        message,
        tenantId: event.tenantId ?? undefined,
        ruleId: condition.ruleId,
      });

      // If alert was created (not suppressed) and severity is critical, enqueue webhook
      if (alert && rule.severity === 'critical') {
        const webhookUrl = process.env.ALERT_WEBHOOK_URL;
        if (webhookUrl) {
          await this.alertQueue.add(
            'send-webhook',
            {
              payload: {
                alertId: alert.id,
                severity: rule.severity,
                title,
                message,
                tenantId: event.tenantId,
                ruleId: condition.ruleId,
                timestamp: alert.createdAt.toISOString(),
              },
              webhookUrl,
            },
            {
              attempts: WEBHOOK_MAX_RETRIES,
              backoff: { type: 'exponential', delay: 5000 },
            },
          );
        }
      }
    }
  }

  private async handleSendWebhook(job: Job<SendWebhookJob>): Promise<void> {
    const { payload, webhookUrl } = job.data;

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `Webhook failed: ${response.status} ${response.statusText}`,
      );
    }

    this.logger.log(`Webhook sent for alert ${payload.alertId}`);
  }

  private buildAlertMessage(
    ruleName: string,
    condition: {
      entityKey: string;
      currentCount?: number;
      threshold?: number;
    },
    event: { action: string; actorId: string; tenantId?: string | null },
  ): string {
    const parts = [
      `Rule: ${ruleName}`,
      `Action: ${event.action}`,
      `Actor: ${event.actorId}`,
    ];
    if (event.tenantId) parts.push(`Tenant: ${event.tenantId}`);
    if (condition.currentCount !== undefined) {
      parts.push(`Count: ${condition.currentCount}/${condition.threshold}`);
    }
    return parts.join(' | ');
  }
}
