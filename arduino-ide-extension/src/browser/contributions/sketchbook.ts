import { injectable } from '@theia/core/shared/inversify';
import { Disposable } from '@theia/core/lib/common/disposable';
import { CommandHandler } from '@theia/core/lib/common/command';
import { ArduinoMenus } from '../menu/arduino-menus';
import { Examples } from './examples';
import { SketchesError } from '../../common/protocol';
import { OpenSketch } from './open-sketch';
import { nls } from '@theia/core/lib/common/nls';

@injectable()
export class Sketchbook extends Examples {
  override onStart(): void {
    this.sketchServiceClient.onSketchbookDidChange(() => this.update());
    this.configService.onDidChangeSketchDirUri(() => this.update());
  }

  override async onReady(): Promise<void> {
    this.update();
  }

  protected override update(): void {
    this.toDispose.dispose();
    this.menuRegistry.registerSubmenu(
      ArduinoMenus.FILE__SKETCHBOOK_SUBMENU,
      nls.localize('arduino/sketch/sketchbook', 'Sketchbook'),
      { order: '3' }
    );
    this.toDispose.push(
      Disposable.create(() =>
        this.menuRegistry.unregisterMenuNode(
          ArduinoMenus.FILE__SKETCHBOOK_SUBMENU[
            ArduinoMenus.FILE__SKETCHBOOK_SUBMENU.length - 1
          ]
          // It's not possible to unregister submenu in Theia https://github.com/eclipse-theia/theia/issues/7300
          // This workaround relies on how Theia calculates menu ID from the menu path.
        )
      )
    );
    const sketchDirUri = this.configService.tryGetSketchDirUri();
    const messages = this.configService.tryGetMessages();
    if (!sketchDirUri || messages?.length) {
      this.menuManager.update();
      return;
    }
    this.sketchService
      .getSketches({ uri: sketchDirUri?.toString() })
      .then((container) => {
        this.registerRecursively(
          [...container.children, ...container.sketches],
          ArduinoMenus.FILE__SKETCHBOOK_SUBMENU,
          this.toDispose
        );
        this.menuManager.update();
      });
  }

  protected override createHandler(uri: string): CommandHandler {
    return {
      execute: async () => {
        try {
          await this.commandService.executeCommand(
            OpenSketch.Commands.OPEN_SKETCH.id,
            uri
          );
        } catch (err) {
          if (SketchesError.NotFound.is(err)) {
            // Force update the menu items to remove the absent sketch.
            this.update();
          } else {
            throw err;
          }
        }
      },
    };
  }
}
