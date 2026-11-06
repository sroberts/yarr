package server

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/nkanaev/yarr/src/server/router"
)

// gatewayOriginGuard refuses a state-changing request a browser sent from
// another origin. Behind Outpost's login gateway every app shares one site,
// and the gateway adds the user's identity to whatever reaches it, so a page
// served by a sibling app could otherwise write here as the user. (Outpost
// service spec, section 3: check the origin of your own forms.)
func gatewayOriginGuard(c *router.Context) {
	switch c.Req.Method {
	case "GET", "HEAD", "OPTIONS":
		c.Next()
		return
	}
	if !sameOriginRequest(c.Req) {
		c.Out.WriteHeader(http.StatusForbidden)
		return
	}
	c.Next()
}

// sameOriginRequest reports whether the request's Origin (or, lacking one,
// its Referer) names the host it was sent to. A request with neither is not
// from a browser -- a Fever client, an MCP client, curl with an Outpost
// token -- and has no ambient session to ride, so it passes; a browser
// always sends Origin on the requests this guards.
func sameOriginRequest(r *http.Request) bool {
	source := r.Header.Get("Origin")
	if source == "" {
		source = r.Header.Get("Referer")
	}
	if source == "" {
		return true
	}
	u, err := url.Parse(source)
	if err != nil || u.Host == "" {
		// includes Origin: null (sandboxed frames, opaque redirects)
		return false
	}
	// The gateway preserves Host and sets X-Forwarded-Host to the same
	// name; a cross-origin page can't set either without a CORS preflight,
	// which yarr never answers.
	for _, host := range []string{r.Host, r.Header.Get("X-Forwarded-Host")} {
		if host != "" && strings.EqualFold(u.Host, host) {
			return true
		}
	}
	return false
}
