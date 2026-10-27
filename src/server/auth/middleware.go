package auth

import (
	"net/http"
	"strings"

	"github.com/nkanaev/yarr/src/assets"
	"github.com/nkanaev/yarr/src/server/router"
	"github.com/nkanaev/yarr/src/storage"
)

type Middleware struct {
	Username      string
	Password      string
	BasePath      string
	Public        []string
	DB            *storage.Storage
	SecretKeyBase string
	SecureCookie  bool
	// SecureCookieAuto decides Secure per request instead, from whether the
	// browser reached us over https. See SecureRequest.
	SecureCookieAuto bool
	// Gateway, when set, lets a request signed by Outpost's login gateway in
	// without yarr's own login.
	Gateway *Gateway
}

// SecureRequest reports whether the browser's side of the request was https.
// X-Forwarded-Proto is taken on trust: a client that forges it can only choose
// to mark its own cookie Secure, or not.
func SecureRequest(req *http.Request) bool {
	return req.TLS != nil || strings.EqualFold(req.Header.Get("X-Forwarded-Proto"), "https")
}

func unsafeMethod(method string) bool {
	return method == "POST" || method == "PUT" || method == "DELETE"
}

func (m *Middleware) Handler(c *router.Context) {
	for _, path := range m.Public {
		if strings.HasPrefix(c.Req.URL.Path, m.BasePath+path) {
			c.Next()
			return
		}
	}
	if _, ok := m.Gateway.Verify(c.Req); ok {
		c.Next()
		return
	}
	if IsAuthenticated(c.Req, m.Username, m.Password, m.SecretKeyBase) {
		c.Next()
		return
	}

	rootUrl := m.BasePath + "/"

	if c.Req.URL.Path != rootUrl {
		c.Out.WriteHeader(http.StatusUnauthorized)
		return
	}

	if c.Req.Method == "POST" {
		username := c.Req.FormValue("username")
		password := c.Req.FormValue("password")
		if StringsEqual(username, m.Username) && StringsEqual(password, m.Password) {
			secure := m.SecureCookie
			if m.SecureCookieAuto {
				secure = SecureRequest(c.Req)
			}
			Authenticate(c.Out, m.Username, m.Password, m.BasePath, m.SecretKeyBase, secure)
			c.Redirect(rootUrl)
			return
		} else {
			c.HTML(http.StatusOK, assets.Template("login.html"), map[string]interface{}{
				"username": username,
				"error":    "Invalid username/password",
				"settings": m.DB.GetSettings(),
			})
			return
		}
	}
	c.HTML(http.StatusOK, assets.Template("login.html"), map[string]interface{}{
		"settings": m.DB.GetSettings(),
	})
}
