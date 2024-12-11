import React, { Component } from 'react';
import { connect } from 'react-redux';
import axios from 'axios';
import GetApiServerUri from './helpers';
import IsManager from './is_manager';
import TornjakApi from './tornjak-api-helpers';
import './style.css';
import { Dropdown } from 'carbon-components-react';

import {
  serverSelectedFunc,
  serversListUpdateFunc,
  tornjakServerInfoUpdateFunc,
  serverInfoUpdateFunc,
  agentsListUpdateFunc,
  tornjakMessageFunc
} from 'redux/actions';

import { RootState } from 'redux/reducers';
import {
  AgentsList,
  ServersList,
  ServerInfo,
  TornjakServerInfo,
  DebugServerInfo,
} from './types';
import { showResponseToast } from './error-api';

type SelectServerProp = {
  globalDebugServerInfo: DebugServerInfo,
  serversListUpdateFunc: (globalServersList: ServersList[]) => void,
  serverSelectedFunc: (globalServerSelected: string) => void,
  serverInfoUpdateFunc: (globalServerInfo: ServerInfo) => void,
  tornjakServerInfoUpdateFunc: (globalTornjakServerInfo: TornjakServerInfo) => void,
  agentsListUpdateFunc: (globalAgentsList: AgentsList[]) => void,
  tornjakMessageFunc: (globalErrorMessage: string) => void,
  globalServerSelected: string,
  globalTornjakServerInfo: TornjakServerInfo,
  globalServersList: ServersList[],
  globalErrorMessage: string,
}

type SelectServerState = {}

/**
 * SelectServer component provides a dropdown for choosing a server in manager mode.
 * Once a server is selected, it fetches associated data (server info, agents, etc.)
 * and updates the Redux store.
 */
class SelectServer extends Component<SelectServerProp, SelectServerState> {
  TornjakApi: TornjakApi;

  constructor(props: SelectServerProp) {
    super(props);
    this.TornjakApi = new TornjakApi(props);

    this.onServerSelect = this.onServerSelect.bind(this);
    this.populateServers = this.populateServers.bind(this);
    this.loadServerData = this.loadServerData.bind(this);
    this.loadServers = this.loadServers.bind(this);
  }

  /**
   * On mount, if in manager mode, load the list of servers.
   * Also, if a server is already selected and no errors, load related server data.
   */
  componentDidMount() {
    if (IsManager) {
      this.loadServers();
      if (this.props.globalServerSelected && (this.props.globalErrorMessage === "OK" || this.props.globalErrorMessage === "")) {
        this.loadServerData(this.props.globalServerSelected);
      }
    }
  }

  /**
   * On update, if the selected server changes in manager mode, reload its data.
   */
  componentDidUpdate(prevProps: SelectServerProp) {
    if (IsManager && prevProps.globalServerSelected !== this.props.globalServerSelected) {
      this.loadServerData(this.props.globalServerSelected);
    }
  }

  /**
   * Fetch the list of servers from the manager API and update Redux store.
   */
  private populateServers(): void {
    axios.get(GetApiServerUri("/manager-api/server/list"))
      .then(response => {
        this.props.serversListUpdateFunc(response.data["servers"]);
      })
      .catch(error => showResponseToast(error, { caption: "Could not populate servers." }));
  }

  /**
   * Load the list of servers if in manager mode.
   */
  private loadServers(): void {
    if (!IsManager) return;
    this.populateServers();
  }

  /**
   * Load server-specific data including tornjak server info, server info, and agents list.
   * This method should only be called after a server is successfully selected and no major errors are present.
   * @param serverName - The name of the selected server.
   */
  private loadServerData(serverName: string): void {
    const { tornjakServerInfoUpdateFunc, tornjakMessageFunc, serverInfoUpdateFunc, agentsListUpdateFunc, globalTornjakServerInfo } = this.props;

    if (!serverName) return;

    // Populate tornjak server info
    this.TornjakApi.populateTornjakServerInfo(serverName, tornjakServerInfoUpdateFunc, tornjakMessageFunc);

    // Once tornjak server info is available, populate server info and agents
    // Note: Ensure that globalTornjakServerInfo is updated before calling populateServerInfo and populateAgents
    this.TornjakApi.populateServerInfo(globalTornjakServerInfo, serverInfoUpdateFunc);
    this.TornjakApi.populateAgentsUpdate(serverName, agentsListUpdateFunc, tornjakMessageFunc);
  }

  /**
   * On server selection from the dropdown, update the Redux store with the selected server.
   * @param selectedItem - The selected server name.
   */
  onServerSelect({ selectedItem }: { selectedItem: string }) {
    if (selectedItem) {
      this.props.serverSelectedFunc(selectedItem);
    }
  }

  /**
   * Render the server selection dropdown if in manager mode.
   */
  render() {
    if (!IsManager) {
      return null;
    }

    const { globalServersList, globalServerSelected } = this.props;
    const items = globalServersList ? globalServersList.map((server) => server.name) : [];

    return (
      <div className="server-select-dropdown">
        <Dropdown
          id="server-dropdown"
          titleText="Choose a Server"
          label="Select an Option"
          items={items}
          selectedItem={globalServerSelected}
          onChange={this.onServerSelect}
          style={{ width: '230px' }}
        />
      </div>
    );
  }
}

const mapStateToProps = (state: RootState) => ({
  globalServerSelected: state.servers.globalServerSelected,
  globalServersList: state.servers.globalServersList,
  globalTornjakServerInfo: state.servers.globalTornjakServerInfo,
  globalErrorMessage: state.tornjak.globalErrorMessage,
  globalDebugServerInfo: state.servers.globalDebugServerInfo,
});

export default connect(
  mapStateToProps,
  { 
    serverSelectedFunc,
    serversListUpdateFunc,
    tornjakServerInfoUpdateFunc,
    serverInfoUpdateFunc,
    agentsListUpdateFunc,
    tornjakMessageFunc 
  }
)(SelectServer);

export { SelectServer };
