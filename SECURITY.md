# Security and responsible use

Relay Desk is a bring-your-own-bot tool. It accepts Discord **bot tokens** and Discord **webhook URLs**. It does not support personal account tokens or self-bots.

## Credentials and sessions

- A credential reaches the server over the connection you provide. Host the public site over HTTPS.
- The server keeps credentials in memory for at most two hours after connection. Disconnecting deletes the session; restarting the process clears all sessions.
- A random session ID is stored in an `HttpOnly`, `SameSite=Strict` cookie. In production it is also `Secure`.
- Credentials are not sent back in API responses or written by the application to disk or logs.
- The server operator can still inspect process memory or traffic at the TLS endpoint. Only use an instance you trust.

## Scope

The app checks POST origins, validates Discord IDs and webhook hosts, limits JSON request size and message length, and disables automatic mentions on outgoing messages. It relies on Discord's permissions and rate limits for API access. It has no account system or per-visitor quota.

Run one Node process. A multi-instance deployment requires a shared, secure session store. A public deployment should also have normal operational controls, such as HTTPS, access logs that redact request bodies, and abuse monitoring.

## Reporting a vulnerability

Please email [hi@rizamohamed.com](mailto:hi@rizamohamed.com) with a short reproduction. Do not post real tokens or webhook URLs in an issue.
