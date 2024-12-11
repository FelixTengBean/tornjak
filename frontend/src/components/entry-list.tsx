import React, { Component } from 'react';
import { connect } from 'react-redux';
import IsManager from './is_manager';
import Table from "tables/entries-list-table";
import TornjakApi from "./tornjak-api-helpers";
import {
  serverSelectedFunc,
  entriesListUpdateFunc,
  tornjakMessageFunc,
} from 'redux/actions';
import { RootState } from 'redux/reducers';
import {
  EntriesList,
  TornjakServerInfo,
  DebugServerInfo,
} from './types';

type EntryListProp = {
  globalDebugServerInfo: DebugServerInfo,
  serverSelectedFunc: (globalServerSelected: string) => void,
  entriesListUpdateFunc: (globalEntriesList: EntriesList[]) => void,
  tornjakMessageFunc: (globalErrorMessage: string) => void,
  globalServerSelected: string,
  globalErrorMessage: string,
  globalEntriesList: EntriesList[],
  globalTornjakServerInfo: TornjakServerInfo,
};

type EntryListState = {};

/**
 * Renders a single entry row in the entries table.
 * @param props.entry - The entry object containing SPIFFE IDs and associated data.
 */
const Entry = (props: { entry: EntriesList }) => {
  const { entry } = props;
  const spiffeId = "spiffe://" + entry.spiffe_id.trust_domain + entry.spiffe_id.path;
  const parentId = "spiffe://" + entry.parent_id.trust_domain + entry.parent_id.path;
  const selectors = entry.selectors.map(s => s.type + ":" + s.value).join(', ');

  return (
    <tr>
      <td>{entry.id}</td>
      <td>{spiffeId}</td>
      <td>{parentId}</td>
      <td>{selectors}</td>
      <td>
        <div style={{ overflowX: 'auto', width: "400px" }}>
          <pre>{JSON.stringify(entry, null, ' ')}</pre>
        </div>
      </td>
    </tr>
  );
};

/**
 * EntryList component displays a list of SPIRE entries in a table.
 * It fetches entries from the server (or locally) depending on the environment and updates the Redux store.
 */
class EntryList extends Component<EntryListProp, EntryListState> {
  TornjakApi: TornjakApi;

  constructor(props: EntryListProp) {
    super(props);
    this.TornjakApi = new TornjakApi(props);
    this.state = {};
    this.loadEntries = this.loadEntries.bind(this);
  }

  /**
   * On mount, load the initial entries depending on manager mode and selected server.
   */
  componentDidMount() {
    this.loadEntries();
  }

  /**
   * On update, if the selected server changes in manager mode or if debug info changes in local mode, 
   * re-fetch entries.
   */
  componentDidUpdate(prevProps: EntryListProp) {
    const serverChanged = prevProps.globalServerSelected !== this.props.globalServerSelected;
    const debugInfoChanged = prevProps.globalDebugServerInfo !== this.props.globalDebugServerInfo;

    if (IsManager && serverChanged) {
      this.loadEntries();
    } else if (!IsManager && debugInfoChanged) {
      this.loadEntries();
    }
  }

  /**
   * Load entries from the Tornjak server or locally, depending on the current mode.
   * - In manager mode, requires a selected server.
   * - Otherwise, loads local entries.
   */
  private loadEntries(): void {
    const { globalServerSelected, entriesListUpdateFunc, tornjakMessageFunc } = this.props;
    if (IsManager) {
      if (globalServerSelected !== "") {
        this.TornjakApi.populateEntriesUpdate(globalServerSelected, entriesListUpdateFunc, tornjakMessageFunc);
      }
    } else {
      this.TornjakApi.populateLocalEntriesUpdate(entriesListUpdateFunc, tornjakMessageFunc);
    }
  }

  /**
   * Generates a list of Entry components for rendering in the table.
   */
  private entryList() {
    const { globalEntriesList } = this.props;
    if (!globalEntriesList || globalEntriesList.length === 0) return "";
    return globalEntriesList.map((currentEntry: EntriesList) => {
      return <Entry key={currentEntry.id} entry={currentEntry} />;
    });
  }

  render() {
    const { globalErrorMessage } = this.props;

    return (
      <div data-test="entry-list">
        <h3>Entries List</h3>
        {globalErrorMessage !== "OK" && 
          <div className="alert-primary" role="alert">
            <pre>{globalErrorMessage}</pre>
          </div>
        }
        <br /><br />
        <div className="indvidual-list-table">
          <Table data={this.entryList()} id="table-1" />
        </div>
      </div>
    );
  }
}

const mapStateToProps = (state: RootState) => ({
  globalServerSelected: state.servers.globalServerSelected,
  globalEntriesList: state.entries.globalEntriesList,
  globalErrorMessage: state.tornjak.globalErrorMessage,
  globalTornjakServerInfo: state.servers.globalTornjakServerInfo,
  globalDebugServerInfo: state.servers.globalDebugServerInfo,
});

export default connect(
  mapStateToProps,
  { serverSelectedFunc, entriesListUpdateFunc, tornjakMessageFunc }
)(EntryList);

export { EntryList };
