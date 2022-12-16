import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application';
import { FrontendApplicationStateService } from '@theia/core/lib/browser/frontend-application-state';
import { DisposableCollection } from '@theia/core/lib/common/disposable';
import { Emitter, Event } from '@theia/core/lib/common/event';
import { MessageService } from '@theia/core/lib/common/message-service';
import { deepClone } from '@theia/core/lib/common/objects';
import URI from '@theia/core/lib/common/uri';
import {
  inject,
  injectable,
  postConstruct,
} from '@theia/core/shared/inversify';
import { Config, ConfigService, ConfigState } from '../../common/protocol';
import { NotificationCenter } from '../notification-center';

@injectable()
export class ConfigServiceClient implements FrontendApplicationContribution {
  @inject(ConfigService)
  private readonly delegate: ConfigService;
  @inject(NotificationCenter)
  private readonly notificationCenter: NotificationCenter;
  @inject(FrontendApplicationStateService)
  private readonly appStateService: FrontendApplicationStateService;
  @inject(MessageService)
  private readonly messageService: MessageService;

  private readonly didChangeSketchDirUriEmitter = new Emitter<
    URI | undefined
  >();
  private readonly didChangeDataDirUriEmitter = new Emitter<URI | undefined>();
  private readonly toDispose = new DisposableCollection(
    this.didChangeSketchDirUriEmitter,
    this.didChangeDataDirUriEmitter
  );

  private _config: ConfigState | undefined;

  @postConstruct()
  protected init(): void {
    this.appStateService.reachedState('ready').then(async () => {
      const config = await this.fetchConfig();
      this.use(config);
    });
  }

  onStart(): void {
    this.notificationCenter.onConfigDidChange((config) => this.use(config));
  }

  onStop(): void {
    this.toDispose.dispose();
  }

  get onDidChangeSketchDirUri(): Event<URI | undefined> {
    return this.didChangeSketchDirUriEmitter.event;
  }

  get onDidChangeDataDirUri(): Event<URI | undefined> {
    return this.didChangeSketchDirUriEmitter.event;
  }

  async fetchConfig(): Promise<ConfigState> {
    return this.delegate.getConfiguration();
  }

  tryGetConfig(): Config | undefined {
    return this._config?.config;
  }

  tryGetMessages(): string[] | undefined {
    return this._config?.messages;
  }

  /**
   * `directories.user`
   */
  tryGetSketchDirUri(): URI | undefined {
    return this._config?.config?.sketchDirUri
      ? new URI(this._config?.config?.sketchDirUri)
      : undefined;
  }

  /**
   * `directories.data`
   */
  tryGetDataDirUri(): URI | undefined {
    return this._config?.config?.dataDirUri
      ? new URI(this._config?.config?.dataDirUri)
      : undefined;
  }

  private use(config: ConfigState): void {
    const oldConfig = deepClone(this._config);
    this._config = config;
    if (oldConfig?.config?.dataDirUri !== this._config?.config?.dataDirUri) {
      this.didChangeDataDirUriEmitter.fire(
        this._config.config?.dataDirUri
          ? new URI(this._config.config.dataDirUri)
          : undefined
      );
    }
    if (
      oldConfig?.config?.sketchDirUri !== this._config?.config?.sketchDirUri
    ) {
      this.didChangeSketchDirUriEmitter.fire(
        this._config.config?.sketchDirUri
          ? new URI(this._config.config.sketchDirUri)
          : undefined
      );
    }
    if (this._config.messages?.length) {
      const message = this._config.messages.join(' ');
      // toast the error later otherwise it might not show up in IDE2
      setTimeout(() => this.messageService.error(message), 1_000);
    }
  }
}
