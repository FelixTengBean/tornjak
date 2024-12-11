import React, { Component } from 'react';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from '@carbon/react';
import { connect } from 'react-redux';
import { toast } from 'react-toastify';

import ClusterCreate from './cluster-create';
import ClusterEdit from './cluster-edit';
import IsManager from './is_manager';
import TornjakApi from './tornjak-api-helpers';
import './style.css';

import {
  clusterTypeInfoFunc,
  serverSelectedFunc,
  selectorInfoFunc,
  agentsListUpdateFunc,
  tornjakMessageFunc,
  tornjakServerInfoUpdateFunc,
  serverInfoUpdateFunc
} from 'redux/actions';
import { RootState } from 'redux/reducers';
import {
  AgentLabels,
  AgentsList,
  ServerInfo,
  TornjakServerInfo,
  DebugServerInfo
} from './types';

// Type definitions for props and state
type ClusterManagementProp = {
  globalDebugServerInfo: DebugServerInfo,
  agentsListUpdateFunc: (globalAgentsList: AgentsList[]) => void,
  tornjakMessageFunc: (globalErrorMessage: string) => void,
  tornjakServerInfoUpdateFunc: (globalTornjakServerInfo: TornjakServerInfo) => void,
  serverInfoUpdateFunc: (globalServerInfo: ServerInfo) => void,
  globalServerSelected: string,
  globalErrorMessage: string,
  globalTornjakServerInfo: TornjakServerInfo,
  globalServerInfo: ServerInfo,
  globalClusterTypeInfo: string[],
  globalAgentsList: AgentsList[],
};

type ClusterManagementState = {
  clusterTypeList: string[],
  agentsList: AgentLabels[],
  agentsListDisplay: string,
  clusterTypeManualEntryOption: string,
  selectedServer: string,
};

class ClusterManagement extends Component<ClusterManagementProp, ClusterManagementState> {
  TornjakApi: TornjakApi;

  constructor(props: ClusterManagementProp) {
    super(props);
    this.TornjakApi = new TornjakApi(props);

    this.state = {
      clusterTypeList: [],
      agentsList: [],
      agentsListDisplay: "Select Agents",
      clusterTypeManualEntryOption: "----Select this option and Enter Custom Cluster Type Below----",
      selectedServer: "",
    };

    this.handleTabSelect = this.handleTabSelect.bind(this);
    this.prepareClusterTypeList = this.prepareClusterTypeList.bind(this);
    this.prepareAgentsList = this.prepareAgentsList.bind(this);
    this.loadData = this.loadData.bind(this);
  }

  componentDidMount() {
    // Initial data load when the component mounts
    this.loadData();
  }

  componentDidUpdate(prevProps: ClusterManagementProp) {
    // If server selection changes in manager mode or debug info changes, we may need to reload data
    if (IsManager && prevProps.globalServerSelected !== this.props.globalServerSelected) {
      this.setState({ selectedServer: this.props.globalServerSelected }, this.loadData);
    }

    if (prevProps.globalDebugServerInfo !== this.props.globalDebugServerInfo) {
      this.prepareAgentsList();
    }
  }

  /**
   * Loads data from Tornjak server or local environment depending on manager mode.
   * After data is loaded or updated, also updates cluster type and agents list for display.
   */
  loadData(): void {
    const { globalServerSelected, globalErrorMessage } = this.props;

    // If in manager mode, ensure server is selected and no major errors
    if (IsManager) {
      if (globalServerSelected !== "" && (globalErrorMessage === "OK" || globalErrorMessage === "")) {
        this.TornjakApi.populateAgentsUpdate(globalServerSelected, this.props.agentsListUpdateFunc, this.props.tornjakMessageFunc);
        this.TornjakApi.populateTornjakServerInfo(globalServerSelected, this.props.tornjakServerInfoUpdateFunc, this.props.tornjakMessageFunc);
        this.setState({ selectedServer: globalServerSelected }, () => {
          this.TornjakApi.populateServerInfo(this.props.globalTornjakServerInfo, this.props.serverInfoUpdateFunc);
          this.prepareClusterTypeList();
          this.prepareAgentsList();
        });
      }
    } else {
      // Local mode
      this.TornjakApi.populateLocalAgentsUpdate(this.props.agentsListUpdateFunc, this.props.tornjakMessageFunc);
      this.TornjakApi.populateLocalTornjakServerInfo(this.props.tornjakServerInfoUpdateFunc, this.props.tornjakMessageFunc);
      this.TornjakApi.populateServerInfo(this.props.globalTornjakServerInfo, this.props.serverInfoUpdateFunc);
      this.prepareClusterTypeList();
      this.prepareAgentsList();
    }
  }

  /**
   * Prepare the list of cluster types for display, including a manual entry option.
   */
  prepareClusterTypeList(): void {
    const { globalClusterTypeInfo } = this.props;
    const { clusterTypeManualEntryOption } = this.state;

    let localClusterTypeList = [clusterTypeManualEntryOption];
    for (let i = 0; i < globalClusterTypeInfo.length; i++) {
      localClusterTypeList.push(globalClusterTypeInfo[i]);
    }

    this.setState({ clusterTypeList: localClusterTypeList });
  }

  /**
   * Prepare the list of agent labels for display using the global agents list.
   */
  prepareAgentsList(): void {
    const prefix = "spiffe://";
    const { globalAgentsList } = this.props;

    if (!globalAgentsList) {
      return;
    }

    let localAgentsIdList: AgentLabels[] = globalAgentsList.map(agent => ({
      label: prefix + agent.id.trust_domain + agent.id.path
    }));

    this.setState({ agentsList: localAgentsIdList });
  }

  /**
   * Handle selection of tabs. Clears any existing toast messages.
   */
  handleTabSelect(): void {
    toast.dismiss();
  }

  render() {
    const { clusterTypeList, agentsList } = this.state;

    return (
      <div className="cluster-management-tabs" data-test="cluster-management">
        <Tabs>
          <TabList aria-label='Cluster Management Tabs'>
            <Tab
              className="cluster-management-tab1"
              id="tab-1"
              onClick={this.handleTabSelect}
            >
              Create Cluster
            </Tab>
            <Tab
              id="tab-2"
              onClick={this.handleTabSelect}
            >
              Edit Cluster
            </Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <ClusterCreate
                clusterTypeList={clusterTypeList}
                agentsList={agentsList}
              />
            </TabPanel>
            <TabPanel>
              <ClusterEdit
                clusterTypeList={clusterTypeList}
                agentsList={agentsList}
              />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    );
  }
}

// Map Redux state to component props
const mapStateToProps = (state: RootState) => ({
  globalClusterTypeInfo: state.clusters.globalClusterTypeInfo,
  globalServerSelected: state.servers.globalServerSelected,
  globalAgentsList: state.agents.globalAgentsList,
  globalServerInfo: state.servers.globalServerInfo,
  globalTornjakServerInfo: state.servers.globalTornjakServerInfo,
  globalErrorMessage: state.tornjak.globalErrorMessage,
  globalDebugServerInfo: state.servers.globalDebugServerInfo,
});

export default connect(
  mapStateToProps,
  { 
    clusterTypeInfoFunc, 
    serverSelectedFunc, 
    selectorInfoFunc, 
    agentsListUpdateFunc, 
    tornjakMessageFunc, 
    tornjakServerInfoUpdateFunc, 
    serverInfoUpdateFunc 
  }
)(ClusterManagement);

export { ClusterManagement };
