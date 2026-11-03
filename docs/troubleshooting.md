# Discord bot dashboard connection troubleshooting

[Open Relay Desk](https://rizamohamed.com/discord-bot) · [Connection guide](quickstart.md)

| Symptom | What to check |
| --- | --- |
| Token rejected or `401: Unauthorized` | Select Bot token mode and use the current token from your own Discord application's Bot page. Do not paste a client secret, public key, or personal account token. Reconnect after resetting a bot token. |
| No channels listed | Confirm the bot is installed in the intended server. Check its channel permissions. If you know a channel the bot can access, enter its ID in Fallback channel ID and reconnect. |
| Channel listed but reading fails | Listing a channel does not prove the bot can read it. Check View Channel and Read Message History, including channel-specific overrides. |
| Message text is blank | Check Message Content intent access in the Developer Portal. Discord can omit message content even when a channel is visible. |
| Reading works but sending fails | Check Send Messages in that channel. A timeout, rate limit, or other Discord API error may also prevent sending. |
| Bot DM will not open or send | Confirm the user ID and that Discord permits the bot to message that user. The dashboard does not bypass privacy settings. |
| New messages are missing | Press Refresh. The app loads up to 50 recent messages and does not stream updates. |
| No incoming DM list | Use Open by user ID or a recent user's DM button. There is no automatic all-DM inbox. |
| Webhook cannot read messages | Webhook mode is send-only. Connect a bot token to read accessible channels and bot DMs. |
| Session expired | Reconnect. In the standalone server, sessions expire after two hours and are cleared by a server restart. |
| Rate limited | Wait before retrying; repeated refreshes can prolong API pressure. |

## Reporting a reproducible problem

Include the mode (bot or webhook), whether you used the hosted app or self-hosted version, the action you attempted, and the displayed error. Redact tokens, webhook URLs, cookies, and private message content from screenshots and logs.

Report regular bugs in [GitHub Issues](https://github.com/codewithriza/relay-desk/issues). Report security issues using [SECURITY.md](../SECURITY.md).

## Discord references

- [Bot data access](https://support.discord.com/hc/en-us/articles/7933951485975-Visibility-of-Bot-Data-Access)
- [Message API and permissions](https://discord.com/developers/docs/resources/message)
- [Privileged intents](https://support-dev.discord.com/hc/en-us/articles/6207308062871-What-are-Privileged-Intents)
