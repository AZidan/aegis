import { execFile } from 'node:child_process';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ContainerRuntimePreflightService implements OnModuleInit {
  private readonly logger = new Logger(ContainerRuntimePreflightService.name);
  private readonly commandTimeoutMs = 10_000;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const runtime = this.configService.get<string>('container.runtime', 'mock');

    if (runtime === 'mock') {
      this.logger.log('Container preflight skipped for mock runtime');
      return;
    }

    if (runtime === 'docker') {
      await this.verifyDocker();
      this.logger.log('Container preflight passed for docker runtime');
      return;
    }

    if (runtime === 'kubernetes') {
      await this.verifyKubernetes();
      this.logger.log('Container preflight passed for kubernetes runtime');
      return;
    }
  }

  private async verifyDocker(): Promise<void> {
    const dockerHost = this.configService.get<string>('container.dockerHost');
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      // Negotiate older API version to avoid mismatch between CLI and daemon
      DOCKER_API_VERSION: process.env.DOCKER_API_VERSION || '1.43',
    };
    if (dockerHost) {
      env.DOCKER_HOST = dockerHost;
    }

    await this.runCommand('docker', ['info', '--format', '{{.ServerVersion}}'], env);
  }

  private async verifyKubernetes(): Promise<void> {
    const context = this.configService.get<string>(
      'container.kubernetes.context',
      '',
    );
    const namespace = this.configService.get<string>(
      'container.kubernetes.namespace',
      'aegis-tenants',
    );
    const contextArgs = context ? ['--context', context] : [];

    await this.runCommand('kubectl', [...contextArgs, 'version', '--client=true']);
    await this.runCommand('kubectl', [
      ...contextArgs,
      'get',
      'namespace',
      namespace,
    ]);
  }

  private runCommand(
    command: string,
    args: string[],
    env: NodeJS.ProcessEnv = process.env,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      execFile(
        command,
        args,
        {
          env,
          timeout: this.commandTimeoutMs,
          maxBuffer: 1024 * 1024,
        },
        (error, _stdout, stderr) => {
          if (error) {
            const message = stderr?.trim() || error.message;
            reject(
              new Error(
                `Container runtime preflight failed: ${command} ${args.join(' ')} -> ${message}`,
              ),
            );
            return;
          }
          resolve();
        },
      );
    });
  }
}
