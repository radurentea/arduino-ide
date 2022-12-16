import { inject, injectable } from '@theia/core/shared/inversify';
import URI from '@theia/core/lib/common/uri';
import { EditorWidget } from '@theia/editor/lib/browser';
import type { NavigatableWidgetOptions } from '@theia/core/lib/browser';
import { EditorWidgetFactory as TheiaEditorWidgetFactory } from '@theia/editor/lib/browser/editor-widget-factory';
import {
  CurrentSketch,
  SketchesServiceClientImpl,
} from '../../../common/protocol/sketches-service-client-impl';
import { SketchesService, Sketch } from '../../../common/protocol';
import { nls } from '@theia/core/lib/common';

@injectable()
export class EditorWidgetFactory extends TheiaEditorWidgetFactory {
  @inject(SketchesService)
  private readonly sketchesService: SketchesService;

  @inject(SketchesServiceClientImpl)
  private readonly sketchesServiceClient: SketchesServiceClientImpl;

  protected override async createEditor(
    uri: URI,
    options?: NavigatableWidgetOptions
  ): Promise<EditorWidget> {
    const widget = await super.createEditor(uri, options);
    return this.maybeUpdateCaption(widget);
  }

  protected async maybeUpdateCaption(
    widget: EditorWidget
  ): Promise<EditorWidget> {
    const sketch = await this.sketchesServiceClient.currentSketch();
    const { uri } = widget.editor;
    if (CurrentSketch.isValid(sketch) && Sketch.isInSketch(uri, sketch)) {
      const isTemp = await this.sketchesService.isTemp(sketch);
      if (isTemp) {
        widget.title.caption = nls.localize(
          'theia/editor/unsavedTitle',
          'Unsaved – {0}',
          this.labelProvider.getName(uri)
        );
      }
    }
    return widget;
  }
}
