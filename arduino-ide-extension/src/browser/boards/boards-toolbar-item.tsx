import * as React from '@theia/core/shared/react';
import * as ReactDOM from '@theia/core/shared/react-dom';
import { CommandRegistry } from '@theia/core/lib/common/command';
import { DisposableCollection } from '@theia/core/lib/common/disposable';
import { Port } from '../../common/protocol';
import { OpenBoardsConfig } from '../contributions/open-boards-config';
import {
  BoardsServiceProvider,
  AvailableBoard,
} from './boards-service-provider';
import { nls } from '@theia/core/lib/common';
import classNames from 'classnames';
import { BoardsConfig } from './boards-config';

export interface BoardsDropDownListCoords {
  readonly top: number;
  readonly left: number;
  readonly width: number;
}

export namespace BoardsDropDown {
  export interface Props {
    readonly coords: BoardsDropDownListCoords | 'hidden';
    readonly items: Array<AvailableBoard & { onClick: () => void; port: Port }>;
    readonly listRef: React.RefObject<HTMLUListElement>;
    readonly openBoardsConfig: () => void;
  }
}

export class BoardsDropDown extends React.Component<BoardsDropDown.Props> {
  protected dropdownElement: HTMLElement;

  constructor(props: BoardsDropDown.Props) {
    super(props);

    let list = document.getElementById('boards-dropdown-container');
    if (!list) {
      list = document.createElement('div');
      list.id = 'boards-dropdown-container';
      document.body.appendChild(list);
      this.dropdownElement = list;
    }
  }

  override componentDidUpdate(prevProps: BoardsDropDown.Props): void {
    if (prevProps.coords === 'hidden' && this.props.listRef?.current) {
      this.props.listRef.current.focus();
    }
  }

  override render(): React.ReactNode {
    return ReactDOM.createPortal(this.renderNode(), this.dropdownElement);
  }

  protected renderNode(): React.ReactNode {
    const { coords, items } = this.props;
    if (coords === 'hidden') {
      return '';
    }
    const footerLabel = nls.localize(
      'arduino/board/openBoardsConfig',
      'Select other board and port…'
    );

    return (
      <ul
        className="arduino-boards-dropdown-list"
        style={{
          position: 'absolute',
          ...coords,
        }}
        ref={this.props.listRef}
        tabIndex={0}
      >
        <div className="arduino-boards-dropdown-list--items-container">
          {items.map((item, index) => (
            <li key={`board-item--${index}-${item.name}-${item.port.address}`}>
              {this.renderItem(item)}
            </li>
          ))}
        </div>
        <li className="arduino-board-dropdown-footer">
          <button
            className="arduino-boards-dropdown-item"
            onClick={() => this.props.openBoardsConfig()}
          >
            {footerLabel}
          </button>
        </li>
      </ul>
    );
  }

  protected renderItem({
    name,
    port,
    selected,
    onClick,
  }: {
    name: string;
    port: Port;
    selected?: boolean;
    onClick: () => void;
  }): React.ReactNode {
    const protocolIcon = iconNameFromProtocol(port.protocol);
    return (
      <button
        className={classNames('arduino-boards-dropdown-item', {
          'arduino-boards-dropdown-item--selected': selected,
        })}
        onClick={onClick}
        tabIndex={0}
      >
        <div
          className={classNames(
            'arduino-boards-dropdown-item--protocol',
            'fa',
            protocolIcon
          )}
        />
        <div
          className="arduino-boards-dropdown-item--label"
          title={`${name}\n${port.address}`}
        >
          <div className="arduino-boards-dropdown-item--board-label noWrapInfo noselect">
            {name}
          </div>
          <div className="arduino-boards-dropdown-item--port-label noWrapInfo noselect">
            {port.addressLabel}
          </div>
        </div>
        {selected ? <div className="fa fa-check" /> : ''}
      </button>
    );
  }
}

export class BoardsToolBarItem extends React.Component<
  BoardsToolBarItem.Props,
  BoardsToolBarItem.State
> {
  static TOOLBAR_ID: 'boards-toolbar';

  protected readonly toDispose: DisposableCollection =
    new DisposableCollection();
  private activatorRef: React.RefObject<HTMLButtonElement>;
  private listRef: React.RefObject<HTMLUListElement>;

  constructor(props: BoardsToolBarItem.Props) {
    super(props);

    const { availableBoards } = props.boardsServiceProvider;
    this.state = {
      availableBoards,
      coords: 'hidden',
    };
    this.activatorRef = React.createRef();
    this.listRef = React.createRef();
  }

  override componentDidMount(): void {
    this.props.boardsServiceProvider.onAvailableBoardsChanged(
      (availableBoards) => this.setState({ availableBoards })
    );
  }

  override componentDidUpdate(
    _: Readonly<BoardsToolBarItem.Props>,
    prevState: Readonly<BoardsToolBarItem.State>
  ): void {
    if (prevState.coords === 'hidden' && this.state.coords !== 'hidden') {
      document.addEventListener('mouseup', this.handleClickOutside.bind(this));
      this.listRef.current?.querySelector('a')?.focus();
    } else {
      document.removeEventListener(
        'mouseup',
        this.handleClickOutside.bind(this)
      );
    }
  }

  override componentWillUnmount(): void {
    document.removeEventListener('mouseup', this.handleClickOutside.bind(this));
    this.toDispose.dispose();
  }

  private handleClickActivator(): void {
    if (this.state.coords === 'hidden') {
      this.show();
    } else {
      this.hide();
    }
  }

  private handleClickOutside(event: Event) {
    const target = event.target as HTMLElement;
    const isClickInside =
      this.activatorRef.current?.contains(target) ||
      this.listRef.current?.contains(target);
    if (isClickInside) {
      return;
    }
    this.hide();
  }

  private handleWrapKeyUp(event: React.KeyboardEvent<HTMLElement>): void {
    if (event.key === 'Escape' && this.state.coords !== 'hidden') {
      this.hide();
      this.activatorRef.current?.focus();
    }
  }

  private show(): void {
    const rect = this.activatorRef.current?.getBoundingClientRect();
    if (rect) {
      this.setState({
        coords: {
          top: rect.top + rect.height,
          left: rect.left,
          width: rect.width,
        },
      });
    }
  }

  private hide(): void {
    this.setState({ coords: 'hidden' });
  }

  override render(): React.ReactNode {
    const { coords, availableBoards } = this.state;
    const { selectedBoard, selectedPort } =
      this.props.boardsServiceProvider.boardsConfig;

    const name =
      selectedBoard?.name ||
      nls.localize('arduino/board/selectBoard', 'Select Board');
    const selectedPortLabel = portLabel(selectedPort?.address);

    const isConnected = Boolean(selectedBoard && selectedPort);
    const protocolIcon = isConnected
      ? iconNameFromProtocol(selectedPort?.protocol || '')
      : null;
    const protocolIconClassNames = classNames(
      'arduino-boards-toolbar-item--protocol',
      'fa',
      protocolIcon
    );

    return (
      <div
        className="arduino-boards-toolbar-item-wrapper"
        onKeyUp={this.handleWrapKeyUp.bind(this)}
      >
        <button
          ref={this.activatorRef}
          className="arduino-boards-toolbar-item-activator"
          title={selectedPortLabel}
          onClick={this.handleClickActivator.bind(this)}
        >
          {protocolIcon && <div className={protocolIconClassNames} />}
          <div
            className={classNames(
              'arduino-boards-toolbar-item--label',
              'noWrapInfo',
              'noselect',
              { 'arduino-boards-toolbar-item--label-connected': isConnected }
            )}
          >
            {name}
          </div>
          <div className="fa fa-caret-down caret" />
        </button>
        <BoardsDropDown
          listRef={this.listRef}
          coords={coords}
          items={availableBoards
            .filter(AvailableBoard.hasPort)
            .map((board) => ({
              ...board,
              onClick: () => {
                if (!board.fqbn) {
                  const previousBoardConfig =
                    this.props.boardsServiceProvider.boardsConfig;
                  this.props.boardsServiceProvider.boardsConfig = {
                    selectedPort: board.port,
                  };
                  this.openDialog(previousBoardConfig);
                } else {
                  this.props.boardsServiceProvider.boardsConfig = {
                    selectedBoard: board,
                    selectedPort: board.port,
                  };
                }
                this.setState({ coords: 'hidden' });
              },
            }))}
          openBoardsConfig={this.openDialog}
        ></BoardsDropDown>
      </div>
    );
  }

  protected openDialog = async (
    previousBoardConfig?: BoardsConfig.Config
  ): Promise<void> => {
    const selectedBoardConfig =
      await this.props.commands.executeCommand<BoardsConfig.Config>(
        OpenBoardsConfig.Commands.OPEN_DIALOG.id
      );
    if (
      previousBoardConfig &&
      (!selectedBoardConfig?.selectedPort ||
        !selectedBoardConfig?.selectedBoard)
    ) {
      this.props.boardsServiceProvider.boardsConfig = previousBoardConfig;
    }
  };
}
export namespace BoardsToolBarItem {
  export interface Props {
    readonly boardsServiceProvider: BoardsServiceProvider;
    readonly commands: CommandRegistry;
  }

  export interface State {
    availableBoards: AvailableBoard[];
    coords: BoardsDropDownListCoords | 'hidden';
  }
}

function iconNameFromProtocol(protocol: string): string {
  switch (protocol) {
    case 'serial':
      return 'fa-arduino-technology-usb';
    case 'network':
      return 'fa-arduino-technology-connection';
    /* 
      Bluetooth ports are not listed yet from the CLI;
      Not sure about the naming ('bluetooth'); make sure it's correct before uncommenting the following lines
    */
    // case 'bluetooth':
    //   return 'fa-arduino-technology-bluetooth';
    default:
      return 'fa-arduino-technology-3dimensionscube';
  }
}

function portLabel(portName?: string): string {
  return portName
    ? nls.localize('arduino/board/portLabel', 'Port: {0}', portName)
    : nls.localize('arduino/board/disconnected', 'Disconnected');
}
