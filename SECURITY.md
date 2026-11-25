# Security and privacy

Files stay in browser memory and are not uploaded, logged or saved to browser storage. The production application has no API, analytics, external fonts or third-party requests. Opening the source link navigates to GitHub at the user's request. OBJ material names and library references are ignored and never fetched.

Meshes are untrusted input. The application restricts extensions, file size, triangle count, coordinate range and polygon vertex count. Parsing and topology analysis run in a disposable worker with a deadline. Replacing a document terminates the previous worker. A malformed file produces an error without replacing the last successful inspection.

These budgets reduce resource exhaustion risk but do not guarantee bounded peak memory in every browser. A 16 MiB text file expands during tokenization. The browser and GPU driver remain part of the trust boundary. Do not open files from untrusted sources in an outdated browser.

The development server binds to loopback. It is not a production server and should not be exposed to the internet. Production deployment consists only of the compiled `dist/` assets over HTTPS.

To report a security issue, contact the repository owner through their GitHub profile contact. Please avoid placing sensitive file contents or credentials in a public issue. Include a minimal synthetic reproducer when possible.
