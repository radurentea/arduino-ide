import * as React from '@theia/core/shared/react';
import {
  Disposable,
  DisposableCollection,
} from '@theia/core/lib/common/disposable';
import { CloudSketchbookTreeModel } from './cloud-sketchbook-tree-model';
import { AuthenticationClientService } from '../../auth/authentication-client-service';
import { nls } from '@theia/core/lib/common';

export class CloudStatus extends React.Component<
  UserStatus.Props,
  UserStatus.State
> {
  protected readonly toDispose = new DisposableCollection();

  constructor(props: UserStatus.Props) {
    super(props);
    this.state = {
      status: this.status,
      refreshing: false,
    };
  }

  override componentDidMount(): void {
    const statusListener = () => this.setState({ status: this.status });
    window.addEventListener('online', statusListener);
    window.addEventListener('offline', statusListener);
    this.toDispose.pushAll([
      Disposable.create(() =>
        window.removeEventListener('online', statusListener)
      ),
      Disposable.create(() =>
        window.removeEventListener('offline', statusListener)
      ),
    ]);
  }

  override componentWillUnmount(): void {
    this.toDispose.dispose();
  }

  override render(): React.ReactNode {
    if (!this.props.authenticationService.session) {
      return null;
    }
    return (
      <div className="cloud-connection-status flex-line">
        <div className="status item flex-line">
          <div
            className={`${
              this.state.status === 'connected'
                ? 'connected-status-icon'
                : 'offline-status-icon'
            }`}
          />
          {this.state.status === 'connected'
            ? nls.localize('arduino/cloud/connected', 'Connected')
            : nls.localize('arduino/cloud/offline', 'Offline')}
        </div>
        <div className="actions item flex-line">
          <div
            title={nls.localize('arduino/cloud/sync', 'Sync')}
            className={`fa fa-reload ${
              (this.state.refreshing && 'rotating') || ''
            }`}
            style={{ cursor: 'pointer' }}
            onClick={this.onDidClickRefresh}
          />
        </div>
      </div>
    );
  }

  private onDidClickRefresh = () => {
    this.setState({ refreshing: true });
    Promise.all([
      this.props.model.updateRoot(),
      new Promise((resolve) => setTimeout(() => resolve(true), 1000)),
    ]).then(() => {
      this.props.model.sketchbookTree().refresh();
      this.setState({ refreshing: false });
    });
  };

  private get status(): 'connected' | 'offline' {
    return window.navigator.onLine ? 'connected' : 'offline';
  }
}

export namespace UserStatus {
  export interface Props {
    readonly model: CloudSketchbookTreeModel;
    readonly authenticationService: AuthenticationClientService;
  }
  export interface State {
    status: 'connected' | 'offline';
    refreshing?: boolean;
  }
}
