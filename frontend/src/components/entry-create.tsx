import React, { Component } from 'react';
import { connect } from 'react-redux';
import axios from 'axios';
import {
  Dropdown,
  TextInput,
  FilterableMultiSelect,
  Checkbox,
  TextArea,
  NumberInput,
  Accordion,
  AccordionItem,
  ToastNotification
} from 'carbon-components-react';
import { Button } from '@mui/material';
import GetApiServerUri from './helpers';
import IsManager from './is_manager';
import TornjakApi from './tornjak-api-helpers';
import './style.css';
import SpiffeHelper from './spiffe-helper';
import {
  serverSelectedFunc,
  selectorInfoFunc,
  agentsListUpdateFunc,
  entriesListUpdateFunc,
  tornjakMessageFunc,
  tornjakServerInfoUpdateFunc,
  serverInfoUpdateFunc,
  agentworkloadSelectorInfoFunc,
  newEntriesUpdateFunc,
} from 'redux/actions';
import { RootState } from 'redux/reducers';
import {
  EntriesList,
  AgentsList,
  AgentsWorkLoadAttestorInfo,
  ServerInfo,
  TornjakServerInfo,
  SelectorLabels,
  SelectorInfoLabels,
  WorkloadSelectorInfoLabels,
  DebugServerInfo
} from './types';
import EntryExpiryFeatures from './entry-expiry-features';
import CreateEntryJson from './entry-create-json';
import { ToastContainer } from "react-toastify"
import { showResponseToast, showToast } from './error-api';
import apiEndpoints from './apiConfig';

type CreateEntryProp = {
  globalDebugServerInfo: DebugServerInfo,
  globalEntryExpiryTime: number,
  serverSelectedFunc: (globalServerSelected: string) => void,
  agentsListUpdateFunc: (globalAgentsList: AgentsList[]) => void,
  tornjakServerInfoUpdateFunc: (globalTornjakServerInfo: TornjakServerInfo) => void,
  serverInfoUpdateFunc: (globalServerInfo: ServerInfo) => void,
  entriesListUpdateFunc: (globalEntriesList: EntriesList[]) => void,
  newEntriesUpdateFunc: (globalNewEntries: EntriesList[]) => void,
  selectorInfoFunc: (globalSelectorInfo: SelectorInfoLabels) => void,
  tornjakMessageFunc: (globalErrorMessage: string) => void,
  agentworkloadSelectorInfoFunc: (globalAgentsWorkLoadAttestorInfo: AgentsWorkLoadAttestorInfo[]) => void,
  globalServerSelected: string,
  globalErrorMessage: string,
  globalTornjakServerInfo: TornjakServerInfo,
  globalSelectorInfo: SelectorInfoLabels,
  globalAgentsList: AgentsList[],
  globalEntriesList: EntriesList[],
  globalNewEntries: EntriesList[],
  globalWorkloadSelectorInfo: WorkloadSelectorInfoLabels,
  globalAgentsWorkLoadAttestorInfo: AgentsWorkLoadAttestorInfo[],
  globalServerInfo: ServerInfo,
}

type CreateEntryState = {
  name: string,
  spiffeId: string,
  spiffeIdTrustDomain: string,
  spiffeIdPath: string,
  parentId: string,
  parentIdTrustDomain: string,
  parentIdPath: string,
  selectors: string,
  selectorsRecommendationList: string,
  adminFlag: boolean,
  jwt_svid_ttl: number,
  x509_svid_ttl: number,
  expiresAt: number,
  dnsNames: string,
  federatesWith: string,
  downstream: boolean,
  message: string,
  statusOK: string,
  successNumEntries: { success: number, fail: number },
  successJsonMessege: string,
  selectedServer: string,
  agentsIdList: string[],
  agentsIdList_noManualOption: string[],
  spiffeIdPrefix: string,
  parentIdManualEntryOption: string,
  parentIDManualEntry: boolean,
  selectorsList: SelectorLabels[],
  selectorsListDisplay: string,
}

/**
 * The CreateEntry component allows users to create new SPIRE entries either
 * by uploading a JSON file or by filling out a custom entry form. It handles
 * data loading (agents, entries, server info, selectors), input validation,
 * and displaying success/failure messages upon creation attempts.
 */
class CreateEntry extends Component<CreateEntryProp, CreateEntryState> {
  TornjakApi: TornjakApi;
  SpiffeHelper: SpiffeHelper;

  constructor(props: CreateEntryProp) {
    super(props);
    this.TornjakApi = new TornjakApi(props);
    this.SpiffeHelper = new SpiffeHelper(props);

    this.state = {
      name: "",
      spiffeId: "",
      spiffeIdTrustDomain: "",
      spiffeIdPath: "",
      parentId: "",
      parentIdTrustDomain: "",
      parentIdPath: "",
      selectors: "",
      selectorsRecommendationList: "",
      adminFlag: false,
      x509_svid_ttl: 0,
      jwt_svid_ttl: 0,
      expiresAt: 0,
      dnsNames: "",
      federatesWith: "",
      downstream: false,
      message: "",
      statusOK: "",
      successNumEntries: { success: 0, fail: 0 },
      successJsonMessege: "",
      selectedServer: "",
      agentsIdList: [],
      agentsIdList_noManualOption: [],
      spiffeIdPrefix: "",
      parentIdManualEntryOption: "----Select this option and Enter Custom Parent ID Below----",
      parentIDManualEntry: false,
      selectorsList: [],
      selectorsListDisplay: "Select Selectors",
    };

    this.onChangeSelectors = this.onChangeSelectors.bind(this);
    this.onChangeSpiffeId = this.onChangeSpiffeId.bind(this);
    this.onChangeParentId = this.onChangeParentId.bind(this);
    this.onChangeManualParentId = this.onChangeManualParentId.bind(this);
    this.onChangeAdminFlag = this.onChangeAdminFlag.bind(this);
    this.onChangeSelectorsRecommended = this.onChangeSelectorsRecommended.bind(this);
    this.onChangeJwtTtl = this.onChangeJwtTtl.bind(this);
    this.onChangex509Ttl = this.onChangex509Ttl.bind(this);
    this.onChangeExpiresAt = this.onChangeExpiresAt.bind(this);
    this.onChangeFederatesWith = this.onChangeFederatesWith.bind(this);
    this.onChangeDownStream = this.onChangeDownStream.bind(this);
    this.onChangeDnsNames = this.onChangeDnsNames.bind(this);
    this.onSubmit = this.onSubmit.bind(this);
    this.onYAMLEntryCreate = this.onYAMLEntryCreate.bind(this);
    this.loadData = this.loadData.bind(this);
    this.prepareParentIdAgentsList = this.prepareParentIdAgentsList.bind(this);
    this.prepareSelectorsList = this.prepareSelectorsList.bind(this);
  }

  /**
   * On mount, load initial data from Tornjak server or locally depending on manager mode.
   */
  componentDidMount() {
    this.loadData();
  }

  /**
   * On update, if the server selection changes or new data is available, re-prepare the parent ID and selectors lists.
   */
  componentDidUpdate(prevProps: CreateEntryProp, prevState: CreateEntryState) {
    if (IsManager && prevProps.globalServerSelected !== this.props.globalServerSelected) {
      this.setState({ selectedServer: this.props.globalServerSelected }, this.loadData);
    }

    const dataChanged =
      prevProps.globalDebugServerInfo !== this.props.globalDebugServerInfo ||
      prevProps.globalAgentsList !== this.props.globalAgentsList ||
      prevProps.globalEntriesList !== this.props.globalEntriesList;

    if (dataChanged && this.props.globalAgentsList && this.props.globalEntriesList) {
      this.prepareParentIdAgentsList();
      this.prepareSelectorsList();
    }

    // Re-prepare selectors if parentId changes
    if (prevState.parentId !== this.state.parentId) {
      this.prepareSelectorsList();
    }
  }

  /**
   * Loads data depending on whether the component is in manager mode or local mode.
   * Populates agents, entries, and selectors information as needed.
   */
  private loadData(): void {
    const { globalServerSelected, globalErrorMessage } = this.props;

    if (IsManager) {
      if (globalServerSelected !== "" && (globalErrorMessage === "OK" || globalErrorMessage === "")) {
        this.TornjakApi.populateAgentsUpdate(globalServerSelected, this.props.agentsListUpdateFunc, this.props.tornjakMessageFunc);
        this.TornjakApi.populateEntriesUpdate(globalServerSelected, this.props.entriesListUpdateFunc, this.props.tornjakMessageFunc);
        this.TornjakApi.refreshSelectorsState(globalServerSelected, this.props.agentworkloadSelectorInfoFunc);
        this.setState({ selectedServer: globalServerSelected });
      }
    } else {
      // Local mode
      this.TornjakApi.populateLocalAgentsUpdate(this.props.agentsListUpdateFunc, this.props.tornjakMessageFunc);
      this.TornjakApi.populateLocalEntriesUpdate(this.props.entriesListUpdateFunc, this.props.tornjakMessageFunc);
      this.TornjakApi.populateLocalTornjakServerInfo(this.props.tornjakServerInfoUpdateFunc, this.props.tornjakMessageFunc);
      this.TornjakApi.populateServerInfo(this.props.globalTornjakServerInfo, this.props.serverInfoUpdateFunc);
      this.props.newEntriesUpdateFunc([]);
    }
  }

  /**
   * Checks if a SPIFFE ID is valid and returns trustDomain and path if so.
   * @param sid The SPIFFE ID string
   */
  private parseSpiffeId(sid: string): [boolean, string, string] {
    if (sid.startsWith('spiffe://')) {
      const sub = sid.slice("spiffe://".length);
      const spIndex = sub.indexOf("/");
      if (spIndex > 0 && spIndex !== sub.length - 1) {
        const trustDomain = sub.substring(0, spIndex);
        const path = sub.substring(spIndex);
        return [true, trustDomain, path];
      }
    }
    return [false, "", ""];
  }

  /**
   * Returns true if the provided SID is a valid SPIFFE ID.
   */
  private isValidSpiffeId(sid: string): boolean {
    const [valid] = this.parseSpiffeId(sid);
    return valid;
  }

  /**
   * Prepare a list of parent IDs for the dropdown, including a manual entry option and associated agent/entry-based IDs.
   */
  private prepareParentIdAgentsList(): void {
    if (Object.keys(this.props.globalDebugServerInfo).length === 0) return;

    const prefix = "spiffe://";
    let localAgentsIdList: string[] = [];
    let localAgentsIdList_noManualOption: string[] = [];

    // Manual entry and default server options
    localAgentsIdList[0] = this.state.parentIdManualEntryOption;
    localAgentsIdList[1] = prefix + this.props.globalServerInfo.trustDomain + "/spire/server";

    // Retrieve dictionary of agent-related entries
    const agentEntriesDict = this.SpiffeHelper.getAgentsEntries(this.props.globalAgentsList, this.props.globalEntriesList);
    if (!agentEntriesDict) return;

    // Populate additional agents and their entries
    let idx = 2;
    for (const agent of this.props.globalAgentsList) {
      const agentSpiffeId = this.SpiffeHelper.getAgentSpiffeid(agent);
      localAgentsIdList[idx++] = agentSpiffeId;

      const agentEntries = agentEntriesDict[agentSpiffeId];
      if (agentEntries) {
        for (const entry of agentEntries) {
          localAgentsIdList[idx++] = this.SpiffeHelper.getEntrySpiffeid(entry);
        }
      }
    }

    localAgentsIdList_noManualOption = [...localAgentsIdList];
    localAgentsIdList_noManualOption.shift(); // remove manual option for non-manual cases

    this.setState({
      agentsIdList: localAgentsIdList,
      agentsIdList_noManualOption: localAgentsIdList_noManualOption,
    });
  }

  /**
   * Prepare the selectors list based on the chosen parent ID. If parent is a server node,
   * use server selectors; if parent is an agent, determine selectors from workload attestor info.
   */
  private prepareSelectorsList(): void {
    const { globalDebugServerInfo, globalAgentsList, globalEntriesList, globalServerInfo, globalSelectorInfo, globalWorkloadSelectorInfo, globalAgentsWorkLoadAttestorInfo } = this.props;
    if (!globalDebugServerInfo || !globalAgentsList || !globalEntriesList) return;

    const parentId = this.state.parentId;
    if (!parentId) return;

    const prefix = "spiffe://";
    const defaultServer = prefix + globalDebugServerInfo.svid_chain[0].id.trust_domain + "/spire/server";

    // If parent is the default server, load its node attestor selectors
    if (parentId === defaultServer) {
      const serverNodeAtt = globalServerInfo.nodeAttestorPlugin;
      const selectors = serverNodeAtt && globalSelectorInfo[serverNodeAtt] ? globalSelectorInfo[serverNodeAtt] : [];
      this.setState({ selectorsList: selectors, selectorsListDisplay: selectors.length ? this.state.selectorsListDisplay : "Select Selectors" });
      return;
    }

    // Otherwise, handle case for agent workload selectors
    let agentId = parentId;
    if (!globalAgentsList.map(e => this.SpiffeHelper.getAgentSpiffeid(e)).includes(parentId)) {
      // If parentId is not a canonical agent ID, try to find an associated agent via entries
      const fEntries = globalEntriesList.filter(e => this.SpiffeHelper.getEntrySpiffeid(e) === parentId);
      if (fEntries.length > 0) {
        const entry = fEntries[0];
        const canonicalAgentId = this.SpiffeHelper.getCanonicalAgentSpiffeid(entry, globalAgentsList);
        if (canonicalAgentId !== "") {
          agentId = canonicalAgentId;
        }
      }
    }

    // Match the agent with workload attestor info
    let agentSelectorSet = false;
    for (const info of globalAgentsWorkLoadAttestorInfo) {
      if (agentId === info.spiffeid) {
        const assignedPlugin = info.plugin;
        const selectors = assignedPlugin && globalWorkloadSelectorInfo[assignedPlugin] ? globalWorkloadSelectorInfo[assignedPlugin] : [];
        this.setState({ selectorsList: selectors, selectorsListDisplay: selectors.length ? this.state.selectorsListDisplay : "Select Selectors" });
        agentSelectorSet = true;
        break;
      }
    }

    if (!agentSelectorSet) {
      // No suitable selectors found
      this.setState({ selectorsList: [], selectorsListDisplay: "Select Selectors" });
    }
  }

  /**
   * Parse selector strings into a structured format [{type: string, value: string}, ...].
   * Returns null if any selector is invalid.
   */
  private parseSelectorStrings(selectorString: string): {type: string, value: string}[] | null {
    if (!selectorString) return [];
    const selectorItems = selectorString.split(',').map(x => x.trim());
    const selectorEntries = selectorItems.map(item => {
      const idx = item.indexOf(":");
      if (idx <= 0) return null;
      const type = item.substr(0, idx);
      const value = item.substr(idx + 1);
      if (!type || !value) return null;
      return { type, value };
    });

    return selectorEntries.includes(null) ? null : (selectorEntries as {type: string, value: string}[]);
  }

  onChangex509Ttl(e: any): void {
    this.setState({ x509_svid_ttl: Number(e.target.value) });
  }

  onChangeJwtTtl(e: any): void {
    this.setState({ jwt_svid_ttl: Number(e.target.value) });
  }

  onChangeExpiresAt(e: any): void {
    this.setState({ expiresAt: Number(e.target.value) });
  }

  onChangeDownStream(selected: boolean): void {
    this.setState({ downstream: selected });
  }

  onChangeDnsNames(e?: { target: { value: string } }): void {
    if (!e) return;
    this.setState({ dnsNames: e.target.value });
  }

  onChangeFederatesWith(e?: { target: { value: string } }): void {
    if (!e) return;
    this.setState({ federatesWith: e.target.value });
  }

  onChangeSelectorsRecommended(selected?: { selectedItems: SelectorLabels[] }): void {
    if (!selected) return;
    const sid = selected.selectedItems;
    let selectors = "";
    let selectorsDisplay = "";

    sid.forEach((item, i) => {
      if (i < sid.length - 1) {
        selectors += item.label + ":\n";
        selectorsDisplay += item.label + ",";
      } else {
        selectors += item.label + ":";
        selectorsDisplay += item.label;
      }
    });

    if (!selectorsDisplay) {
      selectorsDisplay = "Select Selectors";
    }

    this.setState({
      selectorsRecommendationList: selectors,
      selectorsListDisplay: selectorsDisplay,
    });
  }

  onChangeSelectors(e: { target: { value: string } }): void {
    const sid = e.target.value;
    const selectors = sid.replace(/\n/g, ",");
    this.setState({ selectors });
  }

  onChangeAdminFlag(selected: boolean): void {
    this.setState({ adminFlag: selected });
  }

  onChangeSpiffeId(e: { target: { value: string } }): void {
    const sid = e.target.value;
    if (!sid) {
      // Empty input resets state
      this.setState({
        spiffeId: sid,
        spiffeIdTrustDomain: "",
        spiffeIdPath: "",
        message: "",
      });
      return;
    }

    const [valid, trustDomain, path] = this.parseSpiffeId(sid);
    if (valid) {
      this.setState({
        message: "",
        spiffeId: sid,
        spiffeIdTrustDomain: trustDomain,
        spiffeIdPath: path,
      });
    } else {
      this.setState({
        spiffeId: sid,
        message: "Invalid Spiffe ID",
        spiffeIdTrustDomain: "",
        spiffeIdPath: "",
      });
    }
  }

  onChangeParentId(selected: { selectedItem: string }): void {
    const sid = selected.selectedItem;

    if (!sid) {
      this.setState({
        parentId: sid,
        parentIdTrustDomain: "",
        parentIdPath: "",
        message: "",
      });
      return;
    }

    if (sid === this.state.parentIdManualEntryOption) {
      this.setState({ parentIDManualEntry: true, spiffeIdPrefix: "", parentId: sid });
      return;
    }

    this.setState({ parentIDManualEntry: false });
    const [valid, trustDomain, path] = this.parseSpiffeId(sid);
    const prefix = "spiffe://" + trustDomain + "/";
    if (valid) {
      this.setState({
        message: "",
        parentId: sid,
        parentIdTrustDomain: trustDomain,
        parentIdPath: path,
        spiffeIdPrefix: prefix,
      });
    } else {
      this.setState({
        parentId: sid,
        message: "Invalid Parent ID",
        parentIdTrustDomain: "",
        parentIdPath: "",
      });
    }
  }

  onChangeManualParentId(e: { target: { value: string } }): void {
    const sid = e.target.value;
    if (!sid) {
      this.setState({
        parentId: sid,
        parentIdTrustDomain: "",
        parentIdPath: "",
        message: "",
      });
      return;
    }

    const [valid, trustDomain, path] = this.parseSpiffeId(sid);
    const prefix = "spiffe://" + trustDomain + "/";
    if (valid) {
      this.setState({
        message: "",
        parentId: sid,
        parentIdTrustDomain: trustDomain,
        parentIdPath: path,
        spiffeIdPrefix: prefix,
      });
    } else {
      this.setState({
        parentId: sid,
        message: "Invalid Parent ID",
        parentIdTrustDomain: "",
        parentIdPath: "",
      });
    }
  }

  private getApiEntryCreateEndpoint(): string {
    if (!IsManager) {
      return GetApiServerUri(apiEndpoints.spireEntriesApi);
    }
    if (IsManager && this.state.selectedServer) {
      return GetApiServerUri('/manager-api/entry/create') + "/" + this.state.selectedServer;
    }
    showToast({ caption: "No server selected." });
    return "";
  }

  /**
   * Handles submitting a single entry creation request from the custom form.
   */
  onSubmit(e: { preventDefault: () => void }): void {
    e.preventDefault();

    if (!this.state.parentId) {
      showToast({ caption: "The parent SPIFFE id cannot be empty." });
      return;
    }

    if (!this.state.spiffeId) {
      showToast({ caption: "The SPIFFE id cannot be empty." });
      return;
    }

    if (!this.isValidSpiffeId(this.state.parentId)) {
      showToast({ caption: "The parent SPIFFE id is invalid." });
      return;
    }

    if (!this.isValidSpiffeId(this.state.spiffeId)) {
      showToast({ caption: "The SPIFFE id is invalid." });
      return;
    }

    const selectorEntries = this.parseSelectorStrings(this.state.selectors);
    if (selectorEntries === null || selectorEntries.length === 0) {
      showToast({ caption: "The selectors must be non-empty and formatted 'type:value'." });
      return;
    }

    let federatedWithList: string[] = [];
    if (this.state.federatesWith) {
      federatedWithList = this.state.federatesWith.split(',').map(x => x.trim());
    }

    let dnsNamesWithList: string[] = [];
    if (this.state.dnsNames) {
      dnsNamesWithList = this.state.dnsNames.split(',').map(x => x.trim());
    }

    const cjtData = {
      entries: [{
        spiffe_id: {
          trust_domain: this.state.spiffeIdTrustDomain,
          path: this.state.spiffeIdPath,
        },
        parent_id: {
          trust_domain: this.state.parentIdTrustDomain,
          path: this.state.parentIdPath,
        },
        selectors: selectorEntries,
        admin: this.state.adminFlag,
        x509_svid_ttl: this.state.x509_svid_ttl,
        jwt_svid_ttl: this.state.jwt_svid_ttl,
        expires_at: this.props.globalEntryExpiryTime,
        downstream: this.state.downstream,
        federates_with: federatedWithList,
        dns_names: dnsNamesWithList,
      }]
    };

    const endpoint = this.getApiEntryCreateEndpoint();
    if (!endpoint) return;

    axios.post(endpoint, cjtData)
      .then(res => {
        this.setState({
          message: "Request:" + JSON.stringify(cjtData, null, ' ') + "\n\nSuccess:" + JSON.stringify(res.data, null, ' '),
          statusOK: "OK",
          successJsonMessege: res.data.results[0].status.message
        })
      })
      .catch(err => showResponseToast(err, { caption: "Could not create entry." }));
  }

  /**
   * Handles creating multiple entries from uploaded YAML (converted to JSON) entries.
   */
  onYAMLEntryCreate(): void {
    if (!this.props.globalNewEntries || this.props.globalNewEntries.length === 0) return;

    const endpoint = this.getApiEntryCreateEndpoint();
    if (!endpoint) return;

    const entriesPayload = { entries: this.props.globalNewEntries };
    axios.post(endpoint, entriesPayload)
      .then(res => {
        let successCount = 0;
        res.data.results.forEach((r: any) => {
          if (r.status.message === "OK") successCount++;
        });

        this.setState({
          message: "REQUEST:" + JSON.stringify(entriesPayload, null, ' ') + "\n\nRESPONSE:" + JSON.stringify(res.data, null, ' '),
          successNumEntries: { success: successCount, fail: entriesPayload.entries.length - successCount },
          statusOK: "Multiple",
        });
      })
      .catch(err => showResponseToast(err, { caption: "Could not create entries from YAML." }));
  }

  render() {
    const { agentsIdList, agentsIdList_noManualOption } = this.state;

    return (
      <div data-test="create-entry">
        <div className="create-entry-title" data-test="create-entry-title">
          <h3>Create New Entry/ Entries</h3>
        </div>
        <br /><br />
        {this.state.message !== "" &&
          <div>
            <ToastNotification
              className="toast-entry-creation-notification"
              kind="info"
              iconDescription="close notification"
              subtitle={
                <span>
                  <br />
                  <div role="alert" data-test="success-message">
                    {this.state.statusOK === "Multiple" &&
                      <div>
                        <p className="success-message">{"-- " + this.state.successNumEntries.success + " ENTRY/ ENTRIES SUCCESSFULLY CREATED --"}</p>
                        {this.state.successNumEntries.fail !== 0 &&
                          <p className="failed-message">{"-- " + this.state.successNumEntries.fail + " ENTRY/ ENTRIES FAILED TO BE CREATED --"}</p>
                        }
                      </div>
                    }
                    {this.state.statusOK === "OK" && this.state.successJsonMessege === "OK" &&
                      <p className="success-message">--ENTRY SUCCESSFULLY CREATED--</p>
                    }
                    {(this.state.statusOK === "ERROR" || (this.state.successJsonMessege !== "OK" && this.state.successJsonMessege !== "")) &&
                      <p className="failed-message">--ALL ENTRIES CREATION FAILED--</p>
                    }
                  </div>
                  <br />
                  <div className="toast-messege" data-test="alert-primary">
                    <pre className="toast-messege-color">
                      {this.state.message}
                    </pre>
                  </div>
                </span>
              }
              timeout={0}
              title="Entry Creation Notification"
            />
            {window.scrollTo({ top: 0, behavior: 'smooth' })}
          </div>
        }
        <Accordion className="accordion-entry-form">
          <AccordionItem title={<h5>Upload New Entry/ Entries</h5>} open>
            <div className="entry-form">
              <CreateEntryJson ParentIdList={agentsIdList_noManualOption} />
              <br />
              {this.props.globalNewEntries.length === 0 &&
                <div>
                  <Button
                    size="medium"
                    color="primary"
                    variant="contained"
                    disabled
                  >
                    Create Entries
                  </Button>
                  <p style={{ fontSize: 13 }}>(Upload JSON File to Enable)</p>
                </div>
              }
              {this.props.globalNewEntries.length !== 0 &&
                <Button
                  size="medium"
                  color="primary"
                  variant="contained"
                  onClick={this.onYAMLEntryCreate}>
                  Create Entries
                </Button>
              }
            </div>
          </AccordionItem>
          <AccordionItem
            title={
              <div>
                <h5 className="custom-entry-form-title">Custom Entry Form</h5>
                <p>(click to expand)</p>
              </div>}
          >
            <form onSubmit={this.onSubmit} data-test="entry-create-form">
              <br /><br />
              <div className="entry-form">
                <div className="parentId-drop-down" data-test="parentId-drop-down">
                  <Dropdown
                    aria-required="true"
                    ariaLabel="parentId-drop-down"
                    id="parentId-drop-down"
                    items={agentsIdList}
                    label="Select Parent ID"
                    titleText="Parent ID [*required]"
                    onChange={this.onChangeParentId}
                  />
                  <p className="parentId-helper">
                    e.g. spiffe://example.org/agent/myagent1  
                    For node entries, select spiffe server as parent e.g. spiffe://example.org/spire/server
                  </p>
                </div>
                {this.state.parentIDManualEntry &&
                  <div className="parentId-manual-input-field" data-test="parentId-manual-input-field">
                    <TextInput
                      aria-required="true"
                      helperText="For node entries, specify spiffe://example.org/spire/server"
                      id="parentIdManualInputField"
                      invalidText="A valid value is required"
                      labelText="Parent ID - Manual Entry [*required]"
                      placeholder="Enter Parent ID"
                      onChange={this.onChangeManualParentId}
                    />
                  </div>}
                <div className="spiffeId-input-field" data-test="spiffeId-input-field">
                  <TextInput
                    aria-required="true"
                    helperText="e.g. spiffe://example.org/sample/spiffe/id"
                    id="spiffeIdInputField"
                    invalidText="A valid value is required"
                    labelText="SPIFFE ID [*required]"
                    placeholder="Enter SPIFFE ID"
                    defaultValue={this.state.spiffeIdPrefix}
                    onChange={(e: { target: { value: string } }) => {
                      const input = e.target.value;
                      e.target.value = this.state.spiffeIdPrefix + input.substr(this.state.spiffeIdPrefix.length);
                      this.onChangeSpiffeId(e);
                    }}
                  />
                </div>
                <div className="selectors-multiselect" data-test="selectors-multiselect">
                  <FilterableMultiSelect
                    aria-required="true"
                    titleText="Selectors Recommendation [*required]"
                    helperText="e.g. k8s_sat:cluster,..."
                    placeholder={this.state.selectorsListDisplay}
                    id="selectors-multiselect"
                    items={this.state.selectorsList}
                    label={this.state.selectorsListDisplay}
                    onChange={this.onChangeSelectorsRecommended}
                  />
                </div>
                <div className="selectors-textArea" data-test="selectors-textArea">
                  <TextArea
                    cols={50}
                    helperText="e.g. k8s_sat:cluster:demo-cluster,..."
                    id="selectors-textArea"
                    invalidText="A valid value is required"
                    labelText="Selectors"
                    placeholder="Enter selectors in 'type:value' format. Refer to Selectors Recommendation."
                    defaultValue={this.state.selectorsRecommendationList}
                    rows={8}
                    onChange={this.onChangeSelectors}
                  />
                </div>
                <div className="advanced">
                  <fieldset className="bx--fieldset">
                    <legend className="bx--label">Advanced</legend>
                    <div className="ttl-input" data-test="ttl-input">
                      <NumberInput
                        helperText="x509 SVID TTL (in seconds)"
                        id="x509-ttl-input"
                        invalidText="Number is not valid"
                        label="x509 Time to Live (TTL)"
                        min={0}
                        step={1}
                        value={this.state.x509_svid_ttl}
                        onChange={this.onChangex509Ttl}
                      />
                    </div>
                    <div className="ttl-input" data-test="ttl-input">
                      <NumberInput
                        helperText="JWT SVID TTL (in seconds)"
                        id="jwt-ttl-input"
                        invalidText="Number is not valid"
                        label="JWT Time to Live (TTL)"
                        min={0}
                        step={1}
                        value={this.state.jwt_svid_ttl}
                        onChange={this.onChangeJwtTtl}
                      />
                    </div>
                    <div className="expiresAt-input" data-test="expiresAt-input">
                      <EntryExpiryFeatures />
                    </div>
                    <div className="federates-with-input-field" data-test="federates-with-input-field">
                      <TextInput
                        helperText="e.g. example.org,abc.com (Comma-separated)"
                        id="federates-with-input-field"
                        invalidText="A valid value is required"
                        labelText="Federates With"
                        placeholder="Enter trust domains this identity federates with"
                        onChange={this.onChangeFederatesWith}
                      />
                    </div>
                    <div className="dnsnames-input-field" data-test="dnsnames-input-field">
                      <TextInput
                        helperText="e.g. example.org,abc.com (Comma-separated)"
                        id="dnsnames-input-field"
                        invalidText="A valid value is required"
                        labelText="DNS Names"
                        placeholder="Enter DNS Names associated with this identity"
                        onChange={this.onChangeDnsNames}
                      />
                    </div>
                    <div className="admin-flag-checkbox" data-test="admin-flag-checkbox">
                      <Checkbox
                        labelText="Admin Flag"
                        id="admin-flag"
                        onChange={this.onChangeAdminFlag}
                      />
                    </div>
                    <div className="down-stream-checkbox" data-test="down-stream-checkbox">
                      <Checkbox
                        labelText="Downstream"
                        id="downstream"
                        onChange={this.onChangeDownStream}
                      />
                    </div>
                  </fieldset>
                </div>
                <div className="form-group">
                  <input type="submit" value="CREATE ENTRY" className="btn btn-primary" />
                </div>
              </div>
            </form>
          </AccordionItem>
        </Accordion>
        <ToastContainer
          className="carbon-toast"
          containerId="notifications"
          draggable={false}
        />
      </div>
    );
  }
}

const mapStateToProps = (state: RootState) => ({
  globalServerSelected: state.servers.globalServerSelected,
  globalSelectorInfo: state.servers.globalSelectorInfo,
  globalAgentsList: state.agents.globalAgentsList,
  globalEntriesList: state.entries.globalEntriesList,
  globalEntryExpiryTime: state.entries.globalEntryExpiryTime,
  globalNewEntries: state.entries.globalNewEntries,
  globalServerInfo: state.servers.globalServerInfo,
  globalTornjakServerInfo: state.servers.globalTornjakServerInfo,
  globalErrorMessage: state.tornjak.globalErrorMessage,
  globalWorkloadSelectorInfo: state.servers.globalWorkloadSelectorInfo,
  globalAgentsWorkLoadAttestorInfo: state.agents.globalAgentsWorkLoadAttestorInfo,
  globalDebugServerInfo: state.servers.globalDebugServerInfo,
});

export default connect(
  mapStateToProps,
  {
    serverSelectedFunc,
    agentworkloadSelectorInfoFunc,
    selectorInfoFunc,
    agentsListUpdateFunc,
    entriesListUpdateFunc,
    tornjakMessageFunc,
    tornjakServerInfoUpdateFunc,
    serverInfoUpdateFunc,
    newEntriesUpdateFunc
  }
)(CreateEntry);

export { CreateEntry };
