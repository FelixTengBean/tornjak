package api

import (
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gorilla/mux"
	"github.com/hashicorp/hcl/hcl/ast"

	"github.com/spiffe/tornjak/pkg/agent/authentication/authenticator"
	"github.com/spiffe/tornjak/pkg/agent/authorization"
	agentdb "github.com/spiffe/tornjak/pkg/agent/db"
	"github.com/spiffe/tornjak/pkg/agent/spirecrd"
)

// Server represents a Tornjak server with associated configurations and plugins.
type Server struct {
	SpireServerAddr string
	SpireServerInfo TornjakSpireServerInfo
	TornjakConfig   *TornjakConfig

	Db            agentdb.AgentDB
	CRDManager    spirecrd.CRDManager
	Authenticator authenticator.Authenticator
	Authorizer    authorization.Authorizer
}

// hclPluginConfig mirrors SPIRE plugin configuration structure.
type hclPluginConfig struct {
	PluginCmd      string   `hcl:"plugin_cmd"`
	PluginArgs     []string `hcl:"plugin_args"`
	PluginChecksum string   `hcl:"plugin_checksum"`
	PluginData     ast.Node `hcl:"plugin_data"`
	Enabled        *bool    `hcl:"enabled"`
}

// cors sets CORS and Content-Type headers for responses and writes a 200 OK status.
func cors(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json;charset=UTF-8")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, DELETE, PATCH")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, access-control-allow-origin, access-control-allow-headers, access-control-allow-credentials, Authorization, access-control-allow-methods")
	w.Header().Set("Access-Control-Expose-Headers", "*, Authorization")
	w.WriteHeader(http.StatusOK)
}

// retError sets appropriate headers and writes an error message with the given status code.
func retError(w http.ResponseWriter, emsg string, status int) {
	w.Header().Set("Content-Type", "application/json;charset=UTF-8")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, DELETE, PATCH")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, access-control-allow-origin, access-control-allow-headers, access-control-allow-credentials, Authorization, access-control-allow-methods")
	w.Header().Set("Access-Control-Expose-Headers", "*, Authorization")
	http.Error(w, emsg, status)
}

// verificationMiddleware handles OPTIONS requests and enforces authentication/authorization.
func (s *Server) verificationMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "OPTIONS" {
			cors(w, r)
			return
		}

		userInfo := s.Authenticator.AuthenticateRequest(r)
		err := s.Authorizer.AuthorizeRequest(r, userInfo)
		if err != nil {
			emsg := fmt.Sprintf("Error authorizing request: %v", err.Error())
			retError(w, emsg, http.StatusUnauthorized)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// tornjakGetServerInfo retrieves Tornjak server info. Returns 204 if no server info is available.
func (s *Server) tornjakGetServerInfo(w http.ResponseWriter, r *http.Request) {
	var input GetTornjakServerInfoRequest
	buf := new(strings.Builder)
	n, err := io.Copy(buf, r.Body)
	if err != nil {
		retError(w, fmt.Sprintf("Error parsing data: %v", err.Error()), http.StatusBadRequest)
		return
	}
	data := buf.String()

	if n == 0 {
		input = GetTornjakServerInfoRequest{}
	} else {
		if err := json.Unmarshal([]byte(data), &input); err != nil {
			retError(w, fmt.Sprintf("Error parsing data: %v", err.Error()), http.StatusBadRequest)
			return
		}
	}

	ret, err := s.GetTornjakServerInfo(input)
	if err != nil {
		// Return 204 if server info is empty (no --spire-config passed)
		retError(w, fmt.Sprintf("Error: %v", err.Error()), http.StatusNoContent)
		return
	}

	cors(w, r)
	je := json.NewEncoder(w)
	if err := je.Encode(ret); err != nil {
		retError(w, fmt.Sprintf("Error: %v", err.Error()), http.StatusBadRequest)
		return
	}
}

// spaHandler serves a Single Page Application, routing non-existing paths to index.html.
type spaHandler struct {
	staticPath string
	indexPath  string
}

// ServeHTTP serves static files. If a file doesn't exist, serves index.html.
func (h spaHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	relPath := r.URL.Path
	absPath, err := filepath.Abs(filepath.Join(h.staticPath, relPath))
	if err != nil || !strings.HasPrefix(absPath, h.staticPath) {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	_, err = os.Stat(absPath)
	if os.IsNotExist(err) {
		http.ServeFile(w, r, filepath.Join(h.staticPath, h.indexPath))
		return
	} else if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	http.FileServer(http.Dir(h.staticPath)).ServeHTTP(w, r)
}

// GetRouter configures and returns the main HTTP router.
func (s *Server) GetRouter() http.Handler {
	rtr := mux.NewRouter()
	apiRtr := rtr.PathPrefix("/").Subrouter()
	healthRtr := rtr.PathPrefix("/healthz").Subrouter()

	// Healthcheck (no auth)
	healthRtr.HandleFunc("", s.health)

	// Home
	apiRtr.HandleFunc("/", s.home)

	// SPIRE server endpoints
	apiRtr.HandleFunc("/api/v1/spire/serverinfo", s.debugServer).Methods(http.MethodGet, http.MethodOptions)
	apiRtr.HandleFunc("/api/v1/spire/healthcheck", s.healthcheck).Methods(http.MethodGet, http.MethodOptions)

	// Agents
	apiRtr.HandleFunc("/api/v1/spire/agents", s.agentList).Methods(http.MethodGet, http.MethodOptions)
	apiRtr.HandleFunc("/api/v1/spire/agents/ban", s.agentBan).Methods(http.MethodPost, http.MethodOptions)
	apiRtr.HandleFunc("/api/v1/spire/agents", s.agentDelete).Methods(http.MethodDelete, http.MethodOptions)
	apiRtr.HandleFunc("/api/v1/spire/agents/jointoken", s.agentCreateJoinToken).Methods(http.MethodPost, http.MethodOptions)

	// Entries
	apiRtr.HandleFunc("/api/v1/spire/entries", s.entryList).Methods(http.MethodGet, http.MethodOptions)
	apiRtr.HandleFunc("/api/v1/spire/entries", s.entryCreate).Methods(http.MethodPost)
	apiRtr.HandleFunc("/api/v1/spire/entries", s.entryDelete).Methods(http.MethodDelete)

	// Bundles
	apiRtr.HandleFunc("/api/v1/spire/bundle", s.bundleGet).Methods(http.MethodGet, http.MethodOptions)
	apiRtr.HandleFunc("/api/v1/spire/federations/bundles", s.federatedBundleList).Methods(http.MethodGet, http.MethodOptions)
	apiRtr.HandleFunc("/api/v1/spire/federations/bundles", s.federatedBundleCreate).Methods(http.MethodPost)
	apiRtr.HandleFunc("/api/v1/spire/federations/bundles", s.federatedBundleUpdate).Methods(http.MethodPatch)
	apiRtr.HandleFunc("/api/v1/spire/federations/bundles", s.federatedBundleDelete).Methods(http.MethodDelete)

	// Federations
	apiRtr.HandleFunc("/api/v1/spire/federations", s.federationList).Methods(http.MethodGet, http.MethodOptions)
	apiRtr.HandleFunc("/api/v1/spire/federations", s.federationCreate).Methods(http.MethodPost)
	apiRtr.HandleFunc("/api/v1/spire/federations", s.federationUpdate).Methods(http.MethodPatch)
	apiRtr.HandleFunc("/api/v1/spire/federations", s.federationDelete).Methods(http.MethodDelete)

	// Tornjak
	apiRtr.HandleFunc("/api/v1/tornjak/serverinfo", s.tornjakGetServerInfo).Methods(http.MethodGet, http.MethodOptions)
	apiRtr.HandleFunc("/api/v1/tornjak/selectors", s.tornjakPluginDefine).Methods(http.MethodPost, http.MethodOptions)
	apiRtr.HandleFunc("/api/v1/tornjak/selectors", s.tornjakSelectorsList).Methods(http.MethodGet)
	apiRtr.HandleFunc("/api/v1/tornjak/agents", s.tornjakAgentsList).Methods(http.MethodGet, http.MethodOptions)

	// Clusters
	apiRtr.HandleFunc("/api/v1/tornjak/clusters", s.clusterList).Methods(http.MethodGet, http.MethodOptions)
	apiRtr.HandleFunc("/api/v1/tornjak/clusters", s.clusterCreate).Methods(http.MethodPost)
	apiRtr.HandleFunc("/api/v1/tornjak/clusters", s.clusterEdit).Methods(http.MethodPatch)
	apiRtr.HandleFunc("/api/v1/tornjak/clusters", s.clusterDelete).Methods(http.MethodDelete)

	// Apply AuthN/AuthZ middleware
	apiRtr.Use(s.verificationMiddleware)

	// UI SPA
	spa := spaHandler{staticPath: "ui-agent", indexPath: "index.html"}
	rtr.PathPrefix("/").Handler(spa)

	return rtr
}

// redirectHTTP redirects HTTP requests to HTTPS.
func (s *Server) redirectHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != "HEAD" {
		http.Error(w, "Use HTTPS", http.StatusBadRequest)
		return
	}
	target := "https://" + s.stripPort(r.Host) + r.URL.RequestURI()
	http.Redirect(w, r, target, http.StatusFound)
}

// stripPort removes the port from the hostport string if present, adding the HTTPS port from config.
func (s *Server) stripPort(hostport string) string {
	host, _, err := net.SplitHostPort(hostport)
	if err != nil {
		return hostport
	}
	addr := fmt.Sprintf("%d", s.TornjakConfig.Server.HTTPSConfig.ListenPort)
	return net.JoinHostPort(host, addr)
}

// HandleRequests configures and starts the server with HTTP/HTTPS listeners.
func (s *Server) HandleRequests() {
	if err := s.Configure(); err != nil {
		log.Fatal("Cannot Configure: ", err)
	}

	errChannel := make(chan error, 2)
	serverConfig := s.TornjakConfig.Server

	if serverConfig.HTTPConfig == nil {
		err := fmt.Errorf("HTTP Config error: no port configured")
		errChannel <- err
		return
	}

	httpHandler := s.GetRouter()
	numPorts := 1

	// Check HTTPS configuration
	if serverConfig.HTTPSConfig == nil {
		log.Print("WARNING: Consider configuring HTTPS for encrypted traffic!")
	} else {
		numPorts++
		httpHandler = http.HandlerFunc(s.redirectHTTP)
		canStartHTTPS := true
		httpsConfig := serverConfig.HTTPSConfig
		var tlsConfig *tls.Config

		// HTTPS port must be configured
		if httpsConfig.ListenPort == 0 {
			err := fmt.Errorf("HTTPS Config error: no port configured. Starting insecure HTTP only...")
			errChannel <- err
			httpHandler = s.GetRouter()
			canStartHTTPS = false
		} else {
			var err error
			tlsConfig, err = httpsConfig.Parse()
			if err != nil {
				err = fmt.Errorf("failed parsing HTTPS config: %w. Starting insecure HTTP only...", err)
				errChannel <- err
				httpHandler = s.GetRouter()
				canStartHTTPS = false
			}
		}

		if canStartHTTPS {
			go func() {
				addr := fmt.Sprintf(":%d", httpsConfig.ListenPort)
				server := &http.Server{
					Handler:   s.GetRouter(),
					Addr:      addr,
					TLSConfig: tlsConfig,
				}

				fmt.Printf("Starting https on %s...\n", addr)
				if err := server.ListenAndServeTLS(httpsConfig.Cert, httpsConfig.Key); err != nil {
					errChannel <- fmt.Errorf("server error serving on https: %w", err)
				}
			}()
		}
	}

	// Start HTTP listener
	go func() {
		addr := fmt.Sprintf(":%d", serverConfig.HTTPConfig.ListenPort)
		fmt.Printf("Starting to listen on %s...\n", addr)
		if err := http.ListenAndServe(addr, httpHandler); err != nil {
			errChannel <- err
		}
	}()

	// Wait for errors from either HTTP or HTTPS servers
	for i := 0; i < numPorts; i++ {
		err := <-errChannel
		log.Printf("%v", err)
	}
}
