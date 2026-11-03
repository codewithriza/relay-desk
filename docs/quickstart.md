# How to chat as your Discord bot

[Open Relay Desk](https://rizamohamed.com/discord-bot) to read messages and manually reply through your bot account from a browser. No installation is required for the hosted dashboard.

## Connect a bot account

1. Open the dashboard and select **Bot token**.
2. Paste the token for a Discord bot you own. Get it from the **Bot** page for your application in the [Discord Developer Portal](https://discord.com/developers/applications).
3. Select **Start session**. The app loads the channels returned for your bot.
4. Choose a channel, read the messages, and type a response.
5. Select **Send**. The message appears in Discord under your bot's name, with the BOT badge.

Invite the bot to your server first. It needs **View Channel**, **Read Message History**, and **Send Messages** for the chosen channel. Access to other users' server message text may also require the **Message Content** intent and Discord approval where applicable.

Use **Refresh** to load new messages. Relay Desk does not display a real-time typing feed.

## Read and reply to a bot DM

Select **DM** beside a recent user, or expand **Open by user ID** and enter the recipient's Discord user ID. Relay Desk opens the conversation between that user and your bot. Type a response and send it as the bot.

This is not an inbox listing every DM received by the bot. You need a recent user entry or the sender's user ID. Discord's privacy settings and access rules can prevent a bot from messaging a user.

## Send a Discord webhook message

Select **Webhook**, paste a webhook URL you control, and send your message. A webhook can post to its configured channel; it cannot browse channels, read messages, or open bot DMs.

## Hosted app or your own server

The hosted app sends your credential to Riza Mohamed's server to call Discord on your behalf. Use it only if you trust that operator. To control the server yourself, follow the [local installation instructions](../README.md#run-it-locally).

Use bot credentials only, never a personal Discord account token. Disconnect when you are done. If you exposed a token publicly, reset it in the Developer Portal.

[Connection troubleshooting](troubleshooting.md) · [Source code and screenshots](../README.md)
