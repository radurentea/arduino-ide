import { CommandHandler } from '@theia/core/lib/common/command';
import { Disposable } from '@theia/core/lib/common/disposable';
import { nls } from '@theia/core/lib/common/nls';
import { injectable } from '@theia/core/shared/inversify';
import { SketchesError } from '../../common/protocol';
import { ArduinoMenus } from '../menu/arduino-menus';
import { Examples } from './examples';
import { OpenSketch } from './open-sketch';

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
