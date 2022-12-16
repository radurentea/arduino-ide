import { inject, injectable } from '@theia/core/shared/inversify';
import URI from '@theia/core/lib/common/uri';
import { open } from '@theia/core/lib/browser/opener-service';
import { FileStat } from '@theia/filesystem/lib/common/files';
import {
  CommandRegistry,
  CommandService,
} from '@theia/core/lib/common/command';
import {
  WorkspaceCommandContribution as TheiaWorkspaceCommandContribution,
  WorkspaceCommands,
} from '@theia/workspace/lib/browser/workspace-commands';
import { Sketch, SketchesService } from '../../../common/protocol';
import { WorkspaceInputDialog } from './workspace-input-dialog';
import {
  CurrentSketch,
  SketchesServiceClientImpl,
} from '../../../common/protocol/sketches-service-client-impl';
import { SaveAsSketch } from '../../contributions/save-as-sketch';
import { nls } from '@theia/core/lib/common';

@injectable()
export class WorkspaceCommandContribution extends TheiaWorkspaceCommandContribution {
  @inject(SketchesServiceClientImpl)
  protected readonly sketchesServiceClient: SketchesServiceClientImpl;

  @inject(CommandService)
  protected readonly commandService: CommandService;

  @inject(SketchesService)
  protected readonly sketchService: SketchesService;

  override registerCommands(registry: CommandRegistry): void {
    super.registerCommands(registry);
    registry.unregisterCommand(WorkspaceCommands.NEW_FILE);
    registry.registerCommand(
      WorkspaceCommands.NEW_FILE,
      this.newWorkspaceRootUriAwareCommandHandler({
        execute: (uri) => this.newFile(uri),
      })
    );
    registry.unregisterCommand(WorkspaceCommands.FILE_RENAME);
    registry.registerCommand(
      WorkspaceCommands.FILE_RENAME,
      this.newUriAwareCommandHandler({
        execute: (uri) => this.renameFile(uri),
      })
    );
  }

  protected async newFile(uri: URI | undefined): Promise<void> {
    if (!uri) {
      return;
    }
    const parent = await this.getDirectory(uri);
    if (!parent) {
      return;
    }

    const parentUri = parent.resource;
    const dialog = new WorkspaceInputDialog(
      {
        title: nls.localize('theia/workspace/fileNewName', 'Name for new file'),
        parentUri,
        validate: (name) => this.validateFileName(name, parent, true),
      },
      this.labelProvider
    );

    const name = await dialog.open();
    const nameWithExt = this.maybeAppendInoExt(name);
    if (nameWithExt) {
      const fileUri = parentUri.resolve(nameWithExt);
      await this.fileService.createFile(fileUri);
      this.fireCreateNewFile({ parent: parentUri, uri: fileUri });
      open(this.openerService, fileUri);
    }
  }

  protected override async validateFileName(
    name: string,
    parent: FileStat,
    recursive = false
  ): Promise<string> {
    // In the Java IDE the followings are the rules:
    //  - `name` without an extension should default to `name.ino`.
    //  - `name` with a single trailing `.` also defaults to `name.ino`.
    const nameWithExt = this.maybeAppendInoExt(name);
    const errorMessage = await super.validateFileName(
      nameWithExt,
      parent,
      recursive
    );
    if (errorMessage) {
      return errorMessage;
    }
    const extension = nameWithExt.split('.').pop();
    if (!extension) {
      return nls.localize(
        'theia/workspace/invalidFilename',
        'Invalid filename.'
      ); // XXX: this should not happen as we forcefully append `.ino` if it's not there.
    }
    if (Sketch.Extensions.ALL.indexOf(`.${extension}`) === -1) {
      return nls.localize(
        'theia/workspace/invalidExtension',
        '.{0} is not a valid extension',
        extension
      );
    }
    return '';
  }

  protected maybeAppendInoExt(name: string | undefined): string {
    if (!name) {
      return '';
    }
    if (name.trim().length) {
      if (name.indexOf('.') === -1) {
        return `${name}.ino`;
      }
      if (name.lastIndexOf('.') === name.length - 1) {
        return `${name.slice(0, -1)}.ino`;
      }
    }
    return name;
  }

  protected async renameFile(uri: URI | undefined): Promise<void> {
    if (!uri) {
      return;
    }
    const sketch = await this.sketchesServiceClient.currentSketch();
    if (!CurrentSketch.isValid(sketch)) {
      return;
    }

    // file belongs to another sketch, do not allow rename
    const parentSketch = await this.sketchService.getSketchFolder(
      uri.toString()
    );
    if (parentSketch && parentSketch.uri !== sketch.uri) {
      return;
    }

    if (uri.toString() === sketch.mainFileUri) {
      const options = {
        execOnlyIfTemp: false,
        openAfterMove: true,
        wipeOriginal: true,
      };
      await this.commandService.executeCommand(
        SaveAsSketch.Commands.SAVE_AS_SKETCH.id,
        options
      );
      return;
    }
    const parent = await this.getParent(uri);
    if (!parent) {
      return;
    }
    const initialValue = uri.path.base;
    const parentUri = parent.resource;

    const dialog = new WorkspaceInputDialog(
      {
        title: nls.localize('theia/workspace/newFileName', 'New name for file'),
        initialValue,
        parentUri,
        initialSelectionRange: {
          start: 0,
          end: uri.path.name.length,
        },
        validate: (name, mode) => {
          if (initialValue === name && mode === 'preview') {
            return false;
          }
          return this.validateFileName(name, parent, false);
        },
      },
      this.labelProvider
    );
    const newName = await dialog.open();
    const newNameWithExt = this.maybeAppendInoExt(newName);
    if (newNameWithExt) {
      const oldUri = uri;
      const newUri = uri.parent.resolve(newNameWithExt);
      this.fileService.move(oldUri, newUri);
    }
  }
}
