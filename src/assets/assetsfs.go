//go:build !debug

package assets

import "embed"

//go:embed *.html
//go:embed sw.js
//go:embed graphicarts
//go:embed javascripts
//go:embed stylesheets
//go:embed fonts
var embedded embed.FS

func init() {
	FS.embedded = &embedded
}
