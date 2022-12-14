import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application';
import { FrontendApplicationStateService } from '@theia/core/lib/browser/frontend-application-state';
import { DisposableCollection } from '@theia/core/lib/common/disposable';
import { Emitter, Event } from '@theia/core/lib/common/event';
import { MessageService } from '@theia/core/lib/common/message-service';
import { Deferred } from '@theia/core/lib/common/promise-util';
import URI from '@theia/core/lib/common/uri';
import { inject, injectable } from '@theia/core/shared/inversify';
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

  private configFileUri: Deferred<URI> | undefined;
  private _config: ConfigState | undefined;
  private _dataDirUri: string | undefined;
  private _sketchDirUri: string | undefined;

  onStart(): void {
    this.appStateService.reachedState('ready').then(async () => {
      const config = await this.fetchConfig();
      this.use(config);
    });
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

  async getCliConfigFileUri(): Promise<URI> {
    if (!this.configFileUri) {
      this.configFileUri = new Deferred();
      setTimeout(async () => {
        try {
          const uri = await this.delegate.configFileUri();
          this.configFileUri?.resolve(new URI(uri));
        } catch (err) {
          console.error(
            `Could not retrieve the URI of the CLI configuration file`,
            err
          );
          this.configFileUri?.reject(err);
          this.configFileUri = undefined;
        }
      });
    }
    return this.configFileUri.promise;
  }

  async fetchConfig(): Promise<ConfigState> {
    return this.delegate.config();
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
    return this._sketchDirUri ? new URI(this._sketchDirUri) : undefined;
  }

  /**
   * `directories.data`
   */
  tryGetDataDirUri(): URI | undefined {
    return this._dataDirUri ? new URI(this._dataDirUri) : undefined;
  }

  private use(config: ConfigState): void {
    this._config = config;
    if (this._dataDirUri !== this._config?.config?.dataDirUri) {
      this._dataDirUri = this._config?.config?.dataDirUri;
      this.didChangeDataDirUriEmitter.fire(
        this._dataDirUri ? new URI(this._dataDirUri) : undefined
      );
    }
    if (this._sketchDirUri !== this._config?.config?.sketchDirUri) {
      this._sketchDirUri = this._config?.config?.sketchDirUri;
      this.didChangeSketchDirUriEmitter.fire(
        this._sketchDirUri ? new URI(this._sketchDirUri) : undefined
      );
    }
    if (this._config.messages?.length) {
      this.messageService.error(this._config.messages.join(' '));
    }
  }
}
