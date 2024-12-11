import { Component } from 'react';
import { connect } from 'react-redux';
import IsManager from './is_manager';
import Table from "tables/clusters-list-table";
import TornjakApi from './tornjak-api-helpers';
import {
  serverSelectedFunc,
  agentsListUpdateFunc,
  tornjakServerInfoUpdateFunc,
  serverInfoUpdateFunc,
  selectorInfoFunc,
  tornjakMessageFunc,
  workloadSelectorInfoFunc,
  agentworkloadSelectorInfoFunc,
  clustersListUpdateFunc,
} from 'redux/actions';
import { RootState } from 'redux/reducers';
import { ClustersList, ServerInfo, TornjakServerInfo } from './types';

type ClusterListProp = {
  clustersListUpdateFunc: (globalClustersList: ClustersList[]) => void,
  tornjakMessageFunc: (globalErrorMessage: string) => void,
  serverInfoUpdateFunc: (globalServerInfo: ServerInfo) => void,
  globalServerSelected: string,
  globalErrorMessage: string,
  globalTornjakServerInfo: TornjakServerInfo,
  globalClustersList: ClustersList[],
};

type ClusterListState = {
  message: string,
};

/**
 * Renders a single cluster in a table row.
 */
const Cluster = (props: { cluster: ClustersList }) => {
  const { cluster } = props;
  return (
    <tr>
      <td>{cluster.name}</td>
      <td>{cluster.platformType}</td>
      <td>{cluster.domainName}</td>
      <td>{cluster.managedBy}</td>
      <td>
        <div style={{ overflowX: 'auto', width: "400px" }}>
          <pre>{JSON.stringify(cluster.agentsList, null, ' ')}</pre>
        </div>
      </td>
    </tr>
  );
};

/**
 * ClusterList component displays a list of clusters for the selected server.
 * It fetches cluster data from Tornjak either in manager mode or locally.
 */
class ClusterList extends Component<ClusterListProp, ClusterListState> {
  TornjakApi: TornjakApi;

  constructor(props: ClusterListProp) {
    super(props);
    this.TornjakApi = new TornjakApi(props);
    this.state = { message: "" };

    this.loadClusters = this.loadClusters.bind(this);
    this.loadServerInfo = this.loadServerInfo.bind(this);
    this.clusterList = this.clusterList.bind(this);
  }

  /**
   * On mount, load clusters depending on manager mode. Also load server info if available.
   */
  componentDidMount() {
    if (IsManager) {
      if (this.props.globalServerSelected) {
        this.loadClusters(this.props.globalServerSelected);
      }
    } else {
      this.loadClusters(""); // local mode
      if (this.props.globalTornjakServerInfo && Object.keys(this.props.globalTornjakServerInfo).length) {
        this.loadServerInfo();
      }
    }
  }

  /**
   * On update, if server selection changes in manager mode, reload clusters.
   * If Tornjak server info changes in local mode, reload server info.
   */
  componentDidUpdate(prevProps: ClusterListProp) {
    const { globalServerSelected, globalTornjakServerInfo } = this.props;

    if (IsManager && prevProps.globalServerSelected !== globalServerSelected) {
      this.loadClusters(globalServerSelected);
    } else if (!IsManager && prevProps.globalTornjakServerInfo !== globalTornjakServerInfo) {
      this.loadServerInfo();
    }
  }

  /**
   * Load clusters based on the current mode.
   * @param serverName - The selected server name if in manager mode, otherwise empty for local mode.
   */
  private loadClusters(serverName: string): void {
    const { clustersListUpdateFunc, tornjakMessageFunc } = this.props;

    if (IsManager && serverName) {
      this.TornjakApi.populateClustersUpdate(serverName, clustersListUpdateFunc, tornjakMessageFunc);
    } else if (!IsManager) {
      this.TornjakApi.populateLocalClustersUpdate(clustersListUpdateFunc, tornjakMessageFunc);
    }
  }

  /**
   * Load server info if Tornjak server info is available.
   */
  private loadServerInfo(): void {
    const { globalTornjakServerInfo, serverInfoUpdateFunc } = this.props;
    if (globalTornjakServerInfo && Object.keys(globalTornjakServerInfo).length) {
      this.TornjakApi.populateServerInfo(globalTornjakServerInfo, serverInfoUpdateFunc);
    }
  }

  /**
   * Create a list of Cluster components from the globalClustersList.
   */
  private clusterList() {
    const { globalClustersList } = this.props;
    if (!globalClustersList || globalClustersList.length === 0) {
      return "";
    }
    return globalClustersList.map((currentCluster: ClustersList) => (
      <Cluster key={currentCluster.name} cluster={currentCluster} />
    ));
  }

  render() {
    const { globalErrorMessage } = this.props;

    return (
      <div data-test="cluster-list">
        <h3>Clusters List</h3>
        {globalErrorMessage !== "OK" &&
          <div className="alert-primary" role="alert">
            <pre>{globalErrorMessage}</pre>
          </div>
        }
        <br /><br />
        <div className="indvidual-list-table">
          <Table data={this.clusterList()} id="table-1" />
        </div>
      </div>
    );
  }
}

const mapStateToProps = (state: RootState) => ({
  globalServerSelected: state.servers.globalServerSelected,
  globalClustersList: state.clusters.globalClustersList,
  globalTornjakServerInfo: state.servers.globalTornjakServerInfo,
  globalErrorMessage: state.tornjak.globalErrorMessage,
});

export default connect(
  mapStateToProps,
  {
    serverSelectedFunc,
    agentsListUpdateFunc,
    tornjakServerInfoUpdateFunc,
    serverInfoUpdateFunc,
    selectorInfoFunc,
    tornjakMessageFunc,
    workloadSelectorInfoFunc,
    agentworkloadSelectorInfoFunc,
    clustersListUpdateFunc,
  }
)(ClusterList);

export { ClusterList };
