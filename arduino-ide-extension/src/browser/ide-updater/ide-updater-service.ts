import { Command, CommandRegistry, MaybePromise, nls } from '@theia/core';
import { Deferred } from '@theia/core/lib/common/promise-util';
import { injectable, inject } from '@theia/core/shared/inversify';
import { IDEUpdater, UpdateInfo } from '../../common/protocol/ide-updater';
import { Contribution } from '../contributions/contribution';
import { IDEUpdaterDialog } from '../dialogs/ide-updater/ide-updater-dialog';

@injectable()
export class IDEUpdaterService extends Contribution {
  @inject(IDEUpdater)
  private readonly updater: IDEUpdater;
  @inject(IDEUpdaterDialog)
  private readonly updaterDialog: IDEUpdaterDialog;

  private initialized = new Deferred<void>();

  override onStart(): void {
    this.preferences.onPreferenceChanged(
      ({ preferenceName, newValue, oldValue }) => {
        if (newValue !== oldValue) {
          switch (preferenceName) {
            case 'arduino.ide.updateChannel':
            case 'arduino.ide.updateBaseUrl':
              this.updater.init(
                this.preferences.get('arduino.ide.updateChannel'),
                this.preferences.get('arduino.ide.updateBaseUrl')
              );
          }
        }
      }
    );
  }

  override onReady(): MaybePromise<void> {
    this.updater
      .init(
        this.preferences.get('arduino.ide.updateChannel'),
        this.preferences.get('arduino.ide.updateBaseUrl')
      )
      .finally(() => {
        this.initialized.resolve();
      });
  }

  override registerCommands(registry: CommandRegistry): void {
    registry.registerCommand(IDEUpdaterService.CHECK_FOR_UPDATES, {
      execute: this.checkForUpdates.bind(this),
    });
  }

  async checkForUpdates(initialCheck?: boolean): Promise<UpdateInfo | void> {
    await this.initialized;
    try {
      const updateInfo = await this.updater.checkForUpdates(initialCheck);
      if (!!updateInfo) {
        this.updaterDialog.open(updateInfo);
      } else {
        this.messageService.info(
          nls.localize(
            'arduino/ide-updater/noUpdatesAvailable',
            'There are no recent updates available for the Arduino IDE'
          )
        );
      }
      return updateInfo;
    } catch (e) {
      /*
        Check if there was a network error. If there is, show an error only
        if the update check was triggered by the user
        TODO: check if this is enough to recognize if there was a network error
      */
      if (e.message.indexOf('net::') >= 0) {
        if (!initialCheck) {
          this.messageService.error(
            nls.localize(
              'arduino/ide-updater/errorNoInternet',
              'You appear to be offline. Without an Internet connection, the Arduino IDE is not able to check for software updates.'
            )
          );
        }
        return;
      }
      this.messageService.error(
        nls.localize(
          'arduino/ide-updater/errorCheckingForUpdates',
          'Error while checking for Arduino IDE updates.\n{0}',
          e.message
        )
      );
    }
  }
}
export namespace IDEUpdaterService {
  export const CHECK_FOR_UPDATES: Command = Command.toLocalizedCommand(
    {
      id: 'arduino-check-for-ide-updates',
      label: 'Check for Arduino IDE Updates',
      category: 'Arduino',
    },
    'arduino/ide-updater/checkForUpdates'
  );
}
