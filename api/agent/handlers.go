package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	trustdomain "github.com/spiffe/spire-api-sdk/proto/spire/api/server/trustdomain/v1"
	"google.golang.org/protobuf/encoding/protojson"
)

// readRequestJSON reads and unmarshals JSON input from the request body into the provided input struct.
// It returns the number of bytes read and any error encountered.
func readRequestJSON(r *http.Request, input interface{}) (int64, error) {
	buf := new(strings.Builder)
	n, err := io.Copy(buf, r.Body)
	if err != nil {
		return n, fmt.Errorf("error reading request body: %v", err)
	}

	data := buf.String()
	if n == 0 {
		return n, nil // Indicates no data provided
	}

	if err := json.Unmarshal([]byte(data), input); err != nil {
		return n, fmt.Errorf("error unmarshaling JSON: %v", err)
	}

	return n, nil
}

// readRequestProtoJSON reads and unmarshals JSON input using protojson (for protobuf messages).
func readRequestProtoJSON(r *http.Request, input protojson.Message) (int64, error) {
	buf := new(strings.Builder)
	n, err := io.Copy(buf, r.Body)
	if err != nil {
		return n, fmt.Errorf("error reading request body: %v", err)
	}

	data := buf.String()
	if n == 0 {
		return n, nil
	}

	if err := protojson.Unmarshal([]byte(data), input); err != nil {
		return n, fmt.Errorf("error unmarshaling proto JSON: %v", err)
	}

	return n, nil
}

// writeResponseJSON writes the given data structure as JSON to the response writer.
func writeResponseJSON(w http.ResponseWriter, r *http.Request, v interface{}) error {
	cors(w, r)
	je := json.NewEncoder(w)
	if err := je.Encode(v); err != nil {
		return fmt.Errorf("error encoding response JSON: %v", err)
	}
	return nil
}

// writeSuccessResponse writes a simple "SUCCESS" message to the response.
func writeSuccessResponse(w http.ResponseWriter, r *http.Request) error {
	cors(w, r)
	_, err := w.Write([]byte("SUCCESS"))
	if err != nil {
		return fmt.Errorf("error writing success response: %v", err)
	}
	return nil
}

// healthcheck handles health check requests.
func (s *Server) healthcheck(w http.ResponseWriter, r *http.Request) {
	var input HealthcheckRequest
	n, err := readRequestJSON(r, &input)
	if err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
		return
	}

	// If no data, input stays empty (default)
	if n == 0 {
		input = HealthcheckRequest{}
	}

	ret, err := s.SPIREHealthcheck(input)
	if err != nil {
		retError(w, fmt.Sprintf("Error: %v", err.Error()), http.StatusInternalServerError)
		return
	}

	if err := writeResponseJSON(w, r, ret); err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
	}
}

// debugServer retrieves debug server information.
func (s *Server) debugServer(w http.ResponseWriter, r *http.Request) {
	input := DebugServerRequest{} // no fields to parse

	ret, err := s.DebugServer(input)
	if err != nil {
		retError(w, fmt.Sprintf("Error: %v", err.Error()), http.StatusInternalServerError)
		return
	}

	if err := writeResponseJSON(w, r, ret); err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
	}
}

// agentList lists agents.
func (s *Server) agentList(w http.ResponseWriter, r *http.Request) {
	var input ListAgentsRequest
	n, err := readRequestJSON(r, &input)
	if err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if n == 0 {
		input = ListAgentsRequest{}
	}

	ret, err := s.ListAgents(input)
	if err != nil {
		retError(w, fmt.Sprintf("Error: %v", err.Error()), http.StatusInternalServerError)
		return
	}

	if err := writeResponseJSON(w, r, ret); err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
	}
}

// agentBan bans an agent.
func (s *Server) agentBan(w http.ResponseWriter, r *http.Request) {
	var input BanAgentRequest
	n, err := readRequestJSON(r, &input)
	if err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if n == 0 {
		retError(w, "Error: no data provided", http.StatusBadRequest)
		return
	}

	if err := s.BanAgent(input); err != nil {
		retError(w, fmt.Sprintf("Error listing agents: %v", err.Error()), http.StatusInternalServerError)
		return
	}

	if err := writeSuccessResponse(w, r); err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
	}
}

// agentDelete deletes an agent (and potentially its metadata).
func (s *Server) agentDelete(w http.ResponseWriter, r *http.Request) {
	var input DeleteAgentRequest
	n, err := readRequestJSON(r, &input)
	if err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if n == 0 {
		retError(w, "Error: no data provided", http.StatusBadRequest)
		return
	}

	if err := s.DeleteAgent(input); err != nil {
		retError(w, fmt.Sprintf("Error listing agents: %v", err.Error()), http.StatusInternalServerError)
		return
	}

	if err := writeSuccessResponse(w, r); err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
	}
}

// agentCreateJoinToken creates a join token for an agent.
func (s *Server) agentCreateJoinToken(w http.ResponseWriter, r *http.Request) {
	var input CreateJoinTokenRequest
	n, err := readRequestJSON(r, &input)
	if err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if n == 0 {
		input = CreateJoinTokenRequest{}
	}

	ret, err := s.CreateJoinToken(input)
	if err != nil {
		retError(w, fmt.Sprintf("Error: %v", err.Error()), http.StatusInternalServerError)
		return
	}

	if err := writeResponseJSON(w, r, ret); err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
	}
}

// entryList lists entries.
func (s *Server) entryList(w http.ResponseWriter, r *http.Request) {
	var input ListEntriesRequest
	n, err := readRequestJSON(r, &input)
	if err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if n == 0 {
		input = ListEntriesRequest{}
	}

	ret, err := s.ListEntries(input)
	if err != nil {
		retError(w, fmt.Sprintf("Error: %v", err.Error()), http.StatusInternalServerError)
		return
	}

	if err := writeResponseJSON(w, r, ret); err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
	}
}

// entryCreate creates one or more entries.
func (s *Server) entryCreate(w http.ResponseWriter, r *http.Request) {
	var input BatchCreateEntryRequest
	n, err := readRequestJSON(r, &input)
	if err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if n == 0 {
		input = BatchCreateEntryRequest{}
	}

	ret, err := s.BatchCreateEntry(input)
	if err != nil {
		retError(w, fmt.Sprintf("Error: %v", err.Error()), http.StatusInternalServerError)
		return
	}

	if err := writeResponseJSON(w, r, ret); err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
	}
}

// entryDelete deletes entries.
func (s *Server) entryDelete(w http.ResponseWriter, r *http.Request) {
	var input BatchDeleteEntryRequest
	n, err := readRequestJSON(r, &input)
	if err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if n == 0 {
		input = BatchDeleteEntryRequest{}
	}

	ret, err := s.BatchDeleteEntry(input)
	if err != nil {
		retError(w, fmt.Sprintf("Error: %v", err.Error()), http.StatusInternalServerError)
		return
	}

	if err := writeResponseJSON(w, r, ret); err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
	}
}

// bundleGet retrieves a bundle.
func (s *Server) bundleGet(w http.ResponseWriter, r *http.Request) {
	var input GetBundleRequest
	n, err := readRequestJSON(r, &input)
	if err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if n == 0 {
		input = GetBundleRequest{}
	}

	ret, err := s.GetBundle(input)
	if err != nil {
		retError(w, fmt.Sprintf("Error: %v", err.Error()), http.StatusInternalServerError)
		return
	}

	if err := writeResponseJSON(w, r, ret); err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
	}
}

// federatedBundleList lists federated bundles.
func (s *Server) federatedBundleList(w http.ResponseWriter, r *http.Request) {
	var input ListFederatedBundlesRequest
	n, err := readRequestJSON(r, &input)
	if err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if n == 0 {
		input = ListFederatedBundlesRequest{}
	}

	ret, err := s.ListFederatedBundles(input)
	if err != nil {
		retError(w, fmt.Sprintf("Error: %v", err.Error()), http.StatusInternalServerError)
		return
	}

	if err := writeResponseJSON(w, r, ret); err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
	}
}

// federatedBundleCreate creates a federated bundle.
func (s *Server) federatedBundleCreate(w http.ResponseWriter, r *http.Request) {
	var input CreateFederatedBundleRequest
	n, err := readRequestJSON(r, &input)
	if err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if n == 0 {
		input = CreateFederatedBundleRequest{}
	}

	ret, err := s.CreateFederatedBundle(input)
	if err != nil {
		retError(w, fmt.Sprintf("Error: %v", err.Error()), http.StatusInternalServerError)
		return
	}

	if err := writeResponseJSON(w, r, ret); err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
	}
}

// federatedBundleUpdate updates a federated bundle.
func (s *Server) federatedBundleUpdate(w http.ResponseWriter, r *http.Request) {
	var input UpdateFederatedBundleRequest
	n, err := readRequestJSON(r, &input)
	if err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if n == 0 {
		input = UpdateFederatedBundleRequest{}
	}

	ret, err := s.UpdateFederatedBundle(input)
	if err != nil {
		retError(w, fmt.Sprintf("Error: %v", err.Error()), http.StatusInternalServerError)
		return
	}

	if err := writeResponseJSON(w, r, ret); err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
	}
}

// federatedBundleDelete deletes a federated bundle.
func (s *Server) federatedBundleDelete(w http.ResponseWriter, r *http.Request) {
	var input DeleteFederatedBundleRequest
	n, err := readRequestJSON(r, &input)
	if err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if n == 0 {
		input = DeleteFederatedBundleRequest{}
	}

	ret, err := s.DeleteFederatedBundle(input)
	if err != nil {
		retError(w, fmt.Sprintf("Error: %v", err.Error()), http.StatusInternalServerError)
		return
	}

	if err := writeResponseJSON(w, r, ret); err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
	}
}

// federationList lists federation relationships.
func (s *Server) federationList(w http.ResponseWriter, r *http.Request) {
	var input ListFederationRelationshipsRequest
	n, err := readRequestJSON(r, &input)
	if err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if n == 0 {
		input = ListFederationRelationshipsRequest{}
	}

	ret, err := s.ListFederationRelationships(input)
	if err != nil {
		retError(w, fmt.Sprintf("Error: %v", err.Error()), http.StatusInternalServerError)
		return
	}

	if err := writeResponseJSON(w, r, ret); err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
	}
}

// federationCreate creates a federation relationship.
func (s *Server) federationCreate(w http.ResponseWriter, r *http.Request) {
	var rawInput trustdomain.BatchCreateFederationRelationshipRequest
	n, err := readRequestProtoJSON(r, &rawInput)
	if err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
		return
	}

	input := CreateFederationRelationshipRequest(rawInput)
	if n == 0 {
		input = CreateFederationRelationshipRequest{}
	}

	ret, err := s.CreateFederationRelationship(input)
	if err != nil {
		retError(w, fmt.Sprintf("Error: %v", err.Error()), http.StatusInternalServerError)
		return
	}

	if err := writeResponseJSON(w, r, ret); err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
	}
}

// federationUpdate updates a federation relationship.
func (s *Server) federationUpdate(w http.ResponseWriter, r *http.Request) {
	var rawInput trustdomain.BatchUpdateFederationRelationshipRequest
	n, err := readRequestProtoJSON(r, &rawInput)
	if err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
		return
	}

	input := UpdateFederationRelationshipRequest(rawInput)
	if n == 0 {
		input = UpdateFederationRelationshipRequest{}
	}

	ret, err := s.UpdateFederationRelationship(input)
	if err != nil {
		retError(w, fmt.Sprintf("Error: %v", err.Error()), http.StatusInternalServerError)
		return
	}

	if err := writeResponseJSON(w, r, ret); err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
	}
}

// federationDelete deletes a federation relationship.
func (s *Server) federationDelete(w http.ResponseWriter, r *http.Request) {
	var input DeleteFederationRelationshipRequest
	n, err := readRequestJSON(r, &input)
	if err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if n == 0 {
		input = DeleteFederationRelationshipRequest{}
	}

	ret, err := s.DeleteFederationRelationship(input)
	if err != nil {
		retError(w, fmt.Sprintf("Error: %v", err.Error()), http.StatusInternalServerError)
		return
	}

	if err := writeResponseJSON(w, r, ret); err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
	}
}

// home returns a welcome message.
func (s *Server) home(w http.ResponseWriter, r *http.Request) {
	ret := "Welcome to the Tornjak Backend!"

	if err := writeResponseJSON(w, r, ret); err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
	}
}

// health returns a simple health message.
func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	ret := "Endpoint is healthy."
	if err := writeResponseJSON(w, r, ret); err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
	}
}

// tornjakSelectorsList lists selectors.
func (s *Server) tornjakSelectorsList(w http.ResponseWriter, r *http.Request) {
	var input ListSelectorsRequest
	n, err := readRequestJSON(r, &input)
	if err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
		return
	}
	if n == 0 {
		input = ListSelectorsRequest{}
	}

	ret, err := s.ListSelectors(input)
	if err != nil {
		retError(w, fmt.Sprintf("Error: %v", err.Error()), http.StatusBadRequest)
		return
	}

	if err := writeResponseJSON(w, r, ret); err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
	}
}

// tornjakPluginDefine defines selectors (plugins).
func (s *Server) tornjakPluginDefine(w http.ResponseWriter, r *http.Request) {
	var input RegisterSelectorRequest
	n, err := readRequestJSON(r, &input)
	if err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
		return
	}
	if n == 0 {
		input = RegisterSelectorRequest{}
	}

	if err := s.DefineSelectors(input); err != nil {
		retError(w, fmt.Sprintf("Error: %v", err.Error()), http.StatusBadRequest)
		return
	}

	if err := writeSuccessResponse(w, r); err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
	}
}

// tornjakAgentsList lists agent metadata.
func (s *Server) tornjakAgentsList(w http.ResponseWriter, r *http.Request) {
	var input ListAgentMetadataRequest
	n, err := readRequestJSON(r, &input)
	if err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
		return
	}
	if n == 0 {
		input = ListAgentMetadataRequest{}
	}

	ret, err := s.ListAgentMetadata(input)
	if err != nil {
		retError(w, fmt.Sprintf("Error: %v", err.Error()), http.StatusBadRequest)
		return
	}

	if err := writeResponseJSON(w, r, ret); err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
	}
}

// clusterList lists clusters.
func (s *Server) clusterList(w http.ResponseWriter, r *http.Request) {
	var input ListClustersRequest
	n, err := readRequestJSON(r, &input)
	if err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if n == 0 {
		input = ListClustersRequest{}
	}

	ret, err := s.ListClusters(input)
	if err != nil {
		retError(w, fmt.Sprintf("Error: %v", err.Error()), http.StatusBadRequest)
		return
	}

	if err := writeResponseJSON(w, r, ret); err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
	}
}

// clusterCreate creates a cluster.
func (s *Server) clusterCreate(w http.ResponseWriter, r *http.Request) {
	var input RegisterClusterRequest
	n, err := readRequestJSON(r, &input)
	if err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if n == 0 {
		input = RegisterClusterRequest{}
	}

	if err := s.DefineCluster(input); err != nil {
		retError(w, fmt.Sprintf("Error: %v", err.Error()), http.StatusBadRequest)
		return
	}

	if err := writeSuccessResponse(w, r); err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
	}
}

// clusterEdit edits a cluster.
func (s *Server) clusterEdit(w http.ResponseWriter, r *http.Request) {
	var input EditClusterRequest
	n, err := readRequestJSON(r, &input)
	if err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if n == 0 {
		input = EditClusterRequest{}
	}

	if err := s.EditCluster(input); err != nil {
		retError(w, fmt.Sprintf("Error: %v", err.Error()), http.StatusBadRequest)
		return
	}

	if err := writeSuccessResponse(w, r); err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
	}
}

// clusterDelete deletes a cluster.
func (s *Server) clusterDelete(w http.ResponseWriter, r *http.Request) {
	var input DeleteClusterRequest
	n, err := readRequestJSON(r, &input)
	if err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if n == 0 {
		input = DeleteClusterRequest{}
	}

	if err := s.DeleteCluster(input); err != nil {
		retError(w, fmt.Sprintf("Error: %v", err.Error()), http.StatusBadRequest)
		return
	}

	if err := writeSuccessResponse(w, r); err != nil {
		retError(w, err.Error(), http.StatusBadRequest)
	}
}
