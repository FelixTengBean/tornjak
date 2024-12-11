import React, { Component } from 'react';
import { connect } from 'react-redux';
import axios from 'axios';
import { Dropdown, TextInput, FilterableMultiSelect, TextArea, InlineNotification } from 'carbon-components-react';
import GetApiServerUri from './helpers';
import IsManager from './is_manager';
import TornjakApi from './tornjak-api-helpers';
import { clusterType } from '../data/data';
import { ToastContainer } from 'react-toastify';
import './style.css';
import {
  clusterTypeInfoFunc,
  agentsListUpdateFunc,
  tornjakMessageFunc,
  tornjakServerInfoUpdateFunc,
  serverInfoUpdateFunc
} from 'redux/actions';
import { RootState } from 'redux/reducers';
import { AgentLabels, AgentsList, ServerInfo, TornjakServerInfo } from './types';
import { showResponseToast, showToast } from './error-api';
import apiEndpoints from './apiConfig';

type ClusterCreateProps = {
  serverInfoUpdateFunc: (globalServerInfo: ServerInfo) => void;
  agentsListUpdateFunc: (globalAgentsList: AgentsList[]) => void;
  tornjakMessageFunc: (globalErrorMessage: string) => void;
  tornjakServerInfoUpdateFunc: (globalTornjakServerInfo: TornjakServerInfo) => void;
  clusterTypeInfoFunc: (globalClusterTypeInfo: string[]) => void;
  agentsList: AgentLabels[];
  clusterTypeList: string[];
  globalServerSelected: string;
  globalErrorMessage: string;
  globalTornjakServerInfo: TornjakServerInfo;
};

type ClusterCreateState = {
  clusterName: string;
  clusterType: string;
  clusterDomainName: string;
  clusterManagedBy: string;
  clusterAgentsList: string[];
  clusterTypeList: string[];
  clusterTypeManualEntryOption: string;
  clusterTypeManualEntry: boolean;
  message: string;
  statusOK: string;
  selectedServer: string;
  agentsListDisplay: string;
  assignedAgentsListDisplay: string;
};

class ClusterCreate extends Component<ClusterCreateProps, ClusterCreateState> {
  TornjakApi: TornjakApi;

  constructor(props: ClusterCreateProps) {
    super(props);
    this.TornjakApi = new TornjakApi(props);

    this.state = {
      clusterName: "",
      clusterType: "",
      clusterDomainName: "",
      clusterManagedBy: "",
      clusterAgentsList: [],
      clusterTypeList: this.props.clusterTypeList,
      clusterTypeManualEntryOption: "----Select this option and Enter Custom Cluster Type Below----",
      clusterTypeManualEntry: false,
      message: "",
      statusOK: "",
      selectedServer: "",
      agentsListDisplay: "Select Agents",
      assignedAgentsListDisplay: "",
    };
  }

  componentDidMount() {
    this.props.clusterTypeInfoFunc(clusterType); // Initialize cluster type info
    if (IsManager) {
      if (this.props.globalServerSelected !== "" && (this.props.globalErrorMessage === "OK" || this.props.globalErrorMessage === "")) {
        this.TornjakApi.populateAgentsUpdate(this.props.globalServerSelected, this.props.agentsListUpdateFunc, this.props.tornjakMessageFunc);
        this.TornjakApi.populateTornjakServerInfo(this.props.globalServerSelected, this.props.tornjakServerInfoUpdateFunc, this.props.tornjakMessageFunc);
        this.setState({ selectedServer: this.props.globalServerSelected });
      }
    } else {
      this.TornjakApi.populateLocalAgentsUpdate(this.props.agentsListUpdateFunc, this.props.tornjakMessageFunc);
      this.TornjakApi.populateLocalTornjakServerInfo(this.props.tornjakServerInfoUpdateFunc, this.props.tornjakMessageFunc);
      this.TornjakApi.populateServerInfo(this.props.globalTornjakServerInfo, this.props.serverInfoUpdateFunc);
    }
  }

  componentDidUpdate(prevProps: ClusterCreateProps) {
    if (IsManager && prevProps.globalServerSelected !== this.props.globalServerSelected) {
      this.setState({ selectedServer: this.props.globalServerSelected });
    }
  }

  handleChange = (field: string, value: string) => {
    this.setState({ [field]: value } as Pick<ClusterCreateState, keyof ClusterCreateState>);
  };

  handleSelectChange = (field: string, selectedItem: string) => {
    if (field === 'clusterType' && selectedItem === this.state.clusterTypeManualEntryOption) {
      this.setState({ clusterTypeManualEntry: true, clusterType: selectedItem });
    } else {
      this.setState({ clusterType: selectedItem, clusterTypeManualEntry: false });
    }
  };

  handleAgentsListChange = (selected: { selectedItems: AgentLabels[] } | undefined): void => {
    if (!selected) return;
    const agents = selected.selectedItems.map((item) => item.label);
    const agentsDisplay = agents.join(', ') || "Select Agents";
    const assignedAgentsListDisplay = agents.join("\n");
    this.setState({
      clusterAgentsList: agents,
      agentsListDisplay: agentsDisplay,
      assignedAgentsListDisplay,
    });
  };

  generateClusterName = (): string => {
    if (!this.state.clusterName) {
      return `cluster-${Date.now()}`; // Generate a name if empty
    }
    return this.state.clusterName;
  };

  getApiEntryCreateEndpoint(): string {
    const { selectedServer } = this.state;
    if (!IsManager) {
      return GetApiServerUri(apiEndpoints.tornjakClustersApi);
    } else if (IsManager && selectedServer) {
      return GetApiServerUri(`/manager-api/tornjak/clusters/create/${selectedServer}`);
    }
    this.setState({ message: "Error: No server selected" });
    return "";
  }

  onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { clusterName, clusterType, clusterDomainName, clusterManagedBy, clusterAgentsList } = this.state;

    // Validation
    if (!clusterName) {
      showToast({ caption: "The cluster name cannot be empty." });
      return;
    }
    if (!clusterType || clusterType === this.state.clusterTypeManualEntryOption) {
      showToast({ caption: "The cluster type cannot be empty." });
      return;
    }

    const cjtData = {
      cluster: {
        name: this.generateClusterName(),
        platformType: clusterType,
        domainName: clusterDomainName,
        managedBy: clusterManagedBy,
        agentsList: clusterAgentsList,
      },
    };

    const endpoint = this.getApiEntryCreateEndpoint();
    if (!endpoint) return;

    try {
      const response = await axios.post(endpoint, cjtData);
      this.setState({
        message: `Request: ${JSON.stringify(cjtData, null, ' ')}\n\nSuccess: ${JSON.stringify(response.data, null, ' ')}`,
        statusOK: "OK",
      });
    } catch (err) {
      showResponseToast(err);
    }

    // Scroll to the bottom of the page after submission
    setTimeout(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }), 100);
  };

  render() {
    const { clusterTypeList, agentsList } = this.props;
    const { clusterTypeManualEntryOption, clusterTypeManualEntry, agentsListDisplay, assignedAgentsListDisplay, message, statusOK } = this.state;

    return (
      <div>
        <div className="cluster-create" data-test="cluster-create">
          <div className="create-create-title" data-test="create-title">
            <h3>Create Cluster</h3>
          </div>
          <form onSubmit={this.onSubmit}>
            <br />
            <div className="entry-form">
              <TextInput
                labelText="Cluster Name [*required]"
                placeholder="Enter CLUSTER NAME"
                onChange={(e) => this.handleChange('clusterName', e.target.value)}
                helperText="i.e. exampleabc"
                invalidText="A valid value is required - refer to helper text below"
                value={this.state.clusterName}
              />
              <Dropdown
                items={clusterTypeList}
                label="Select Cluster Type"
                titleText="Cluster Type [*required]"
                onChange={(e) => this.handleSelectChange('clusterType', e.selectedItem)}
                helperText="i.e. Kubernetes, VMs..."
              />
              {clusterTypeManualEntry && (
                <TextInput
                  labelText="Cluster Type - Manual Entry"
                  placeholder="Enter Cluster Type"
                  onChange={(e) => this.handleChange('clusterType', e.target.value)}
                  helperText="i.e. Kubernetes, VMs..."
                />
              )}
              <TextInput
                labelText="Cluster Domain Name/ URL"
                placeholder="Enter CLUSTER DOMAIN NAME/ URL"
                onChange={(e) => this.handleChange('clusterDomainName', e.target.value)}
                helperText="i.e. example.org"
              />
              <TextInput
                labelText="Cluster Managed By"
                placeholder="Enter CLUSTER MANAGED BY"
                onChange={(e) => this.handleChange('clusterManagedBy', e.target.value)}
                helperText="i.e. person-A"
              />
              <FilterableMultiSelect
                titleText="Assign Agents To Cluster"
                helperText="i.e. spiffe://example.org/agent/myagent1..."
                placeholder={agentsListDisplay}
                items={agentsList}
                onChange={this.handleAgentsListChange}
              />
              <TextArea
                cols={50}
                rows={8}
                helperText="Assigned agents will be populated here"
                labelText="Assigned Agents"
                placeholder="Assigned agents will be populated here - Refer to Assign Agents To Cluster"
                defaultValue={assignedAgentsListDisplay}
                disabled
              />
              <div className="form-group" data-test="create-cluster-button">
                <input type="submit" value="CREATE CLUSTER" className="btn btn-primary" />
              </div>
            </div>
          </form>
          {statusOK && (
            <InlineNotification
              kind={statusOK === "OK" ? "success" : "error"}
              hideCloseButton
              title={statusOK === "OK" ? "CLUSTER SUCCESSFULLY CREATED" : "CLUSTER CREATION FAILED"}
              subtitle={<pre className="toast-message-color">{message}</pre>}
            />
          )}
        </div>
        <ToastContainer className="carbon-toast" containerId="notifications" draggable={false} />
      </div>
    );
  }
}

const mapStateToProps = (state: RootState) => ({
  globalClusterTypeInfo: state.clusters.globalClusterTypeInfo,
  globalServerSelected: state.servers.globalServerSelected,
  globalErrorMessage: state.tornjak.globalErrorMessage,
  globalTornjakServerInfo: state.servers.globalTornjakServerInfo,
  globalAgentsList: state.agents.globalAgentsList,
});

export default connect(mapStateToProps, {
  clusterTypeInfoFunc,
  agentsListUpdateFunc,
  tornjakMessageFunc,
  tornjakServerInfoUpdateFunc,
  serverInfoUpdateFunc,
})(ClusterCreate);

export { ClusterCreate };
  