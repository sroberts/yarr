package main

import "testing"

func TestOutpostGateway(t *testing.T) {
	const issuer, jwks = "https://outpost.example", "http://127.0.0.1:8443/.well-known/jwks.json"

	g, err := outpostGateway("", issuer, jwks, "")
	if err != nil || g != nil {
		t.Fatalf("no $OUTPOST_AUTH: got %v, %v; want no gateway", g, err)
	}

	g, err = outpostGateway("gateway", issuer, jwks, "rss.outpost.example")
	if err != nil {
		t.Fatal(err)
	}
	if g.Issuer != issuer || g.JWKSURL != jwks || g.Audience != "rss.outpost.example" {
		t.Fatalf("gateway = %+v", g)
	}

	for _, tt := range []struct{ mode, issuer, jwks string }{
		{"gateway", "", jwks},
		{"gateway", issuer, ""},
		{"oidc", issuer, jwks},
	} {
		if _, err := outpostGateway(tt.mode, tt.issuer, tt.jwks, ""); err == nil {
			t.Errorf("outpostGateway(%q, %q, %q) should refuse to start", tt.mode, tt.issuer, tt.jwks)
		}
	}
}
