import URI from '@theia/core/lib/common/uri';
import {
  inject,
  injectable,
  postConstruct,
} from '@theia/core/shared/inversify';
import { Diagnostic } from '@theia/core/shared/vscode-languageserver-types';
import { ProblemManager as TheiaProblemManager } from '@theia/markers/lib/browser/problem/problem-manager';
import { Marker } from '@theia/markers/lib/common/marker';
import { ConfigServiceClient } from '../../config/config-service-client';
import debounce = require('lodash.debounce');

@injectable()
export class ProblemManager extends TheiaProblemManager {
  @inject(ConfigServiceClient)
  private readonly configService: ConfigServiceClient;

  private dataDirUri: URI | undefined;

  @postConstruct()
  protected override init(): void {
    super.init();
    this.dataDirUri = this.configService.tryGetDataDirUri();
    this.configService.onDidChangeDataDirUri((uri) => (this.dataDirUri = uri));
  }

  override setMarkers(
    uri: URI,
    owner: string,
    data: Diagnostic[]
  ): Marker<Diagnostic>[] {
    if (this.dataDirUri && this.dataDirUri.isEqualOrParent(uri)) {
      return [];
    }
    return super.setMarkers(uri, owner, data);
  }

  private readonly debouncedFireOnDidChangeMakers = debounce(
    (uri: URI) => this.onDidChangeMarkersEmitter.fire(uri),
    500
  );
  protected override fireOnDidChangeMarkers(uri: URI): void {
    this.debouncedFireOnDidChangeMakers(uri);
  }
}
