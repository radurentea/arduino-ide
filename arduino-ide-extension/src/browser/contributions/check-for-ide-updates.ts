import { LocalStorageService } from '@theia/core/lib/browser/storage-service';
import { inject, injectable } from '@theia/core/shared/inversify';
import { SKIP_IDE_VERSION } from '../../common/protocol/ide-updater';
import { IDEUpdaterDialog } from '../dialogs/ide-updater/ide-updater-dialog';
import { Contribution } from './contribution';
import { IDEUpdaterService } from '../ide-updater/ide-updater-service';

@injectable()
export class CheckForIDEUpdates extends Contribution {
  @inject(IDEUpdaterService)
  private readonly updater: IDEUpdaterService;

  @inject(IDEUpdaterDialog)
  private readonly updaterDialog: IDEUpdaterDialog;

  @inject(LocalStorageService)
  private readonly localStorage: LocalStorageService;

  override onReady(): void {
    const checkForUpdates = this.preferences['arduino.checkForUpdates'];
    if (!checkForUpdates) {
      return;
    }
    this.updater.checkForUpdates(true).then(async (updateInfo) => {
      if (!updateInfo) return;
      const versionToSkip = await this.localStorage.getData<string>(
        SKIP_IDE_VERSION
      );
      if (versionToSkip === updateInfo.version) return;
      this.updaterDialog.open(updateInfo);
    });
  }
}
