# Security policy

## Supported versions

Only the latest `vX.Ys` release of this fork receives security fixes. If
you run an older build, upgrade first and check whether the problem is
still there.

## Reporting a vulnerability

Please **don't** open a public issue for a security problem.

Report it privately through [GitHub's private vulnerability reporting](https://github.com/sroberts/yarr/security/advisories/new).
Include what you found, how to reproduce it, and the impact you expect.

Areas where a report is especially useful:

- authentication and sessions (`-auth`, the Fever API, the MCP token)
- the HTML sanitizer for feed content and readability extraction
- the crawler fetching arbitrary URLs (SSRF)
- OPML import and the feed parsers

yarr is maintained in spare time. You'll get an acknowledgement as soon as
the report is seen, and the fix ships in the next `vX.Ys` release, after
which the advisory is published. Problems that also affect upstream
[nkanaev/yarr](https://github.com/nkanaev/yarr) are passed on there.
