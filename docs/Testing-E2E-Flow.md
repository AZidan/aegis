  Create a Slack App for Testing                                                                                                                       
                                                                                                            
  1. Go to https://api.slack.com/apps and click "Create New App"                                                                                       
                                                                                                                                                       
  Choose "From scratch", name it something like Aegis Dev, and select your test workspace.

  2. Enable Socket Mode

  - Go to Settings > Socket Mode in the left sidebar
  - Toggle "Enable Socket Mode" ON
  - You'll be prompted to create an app-level token with connections:write scope
  - Name it socket-mode-token and click Generate
  - Copy the xapp-... token — this is your SLACK_APP_TOKEN

  3. Set up OAuth & Permissions

  - Go to Features > OAuth & Permissions
  - Under Redirect URLs, add: http://localhost:3000/api/integrations/slack/callback - https://f5d3-156-214-228-58.ngrok-free.app/api/integrations/slack/callback
  - Under Bot Token Scopes, add these scopes:
    - chat:write
    - channels:read
    - groups:read
    - im:read
    - im:write
    - app_mentions:read

  4. Enable Event Subscriptions

  - Go to Features > Event Subscriptions
  - Toggle "Enable Events" ON
  - Under Subscribe to bot events, add:
    - message.channels
    - message.groups
    - message.im
    - app_mention

  5. Create Slash Command

  - Go to Features > Slash Commands
  - Click "Create New Command"
    - Command: /aegis
    - Description: Interact with Aegis AI agents
    - Usage Hint: ask|status|help

  6. Collect Your Credentials

  Go to Settings > Basic Information:
  - Client ID → SLACK_CLIENT_ID (copy from Slack app settings)
  - Client Secret → SLACK_CLIENT_SECRET (copy from Slack app settings)
  - Signing Secret → SLACK_SIGNING_SECRET (copy from Slack app settings)
  - From step 2: App Token → SLACK_APP_TOKEN (the xapp-... token you generated)


  7. Install to Workspace

  - Go to Settings > Install App
  - Click "Install to Workspace" and authorize

  8. Update your .env

  Once you have all 4 values, edit the .env file at:
  /Users/azidan/Work/Repos/AIProjects/ClawdBotSandbox/workspace/projects/ai-transformation-sprint9/backend/.env

  Fill in:
  SLACK_CLIENT_ID=<your-client-id>
  SLACK_CLIENT_SECRET=<your-client-secret>
  SLACK_SIGNING_SECRET=<your-signing-secret>
  SLACK_APP_TOKEN=xapp-1-...

  ---
  What's Ready Now
  ┌────────────────────┬───────────────────────────────────────────────────────────────┐
  │     Component      │                            Status                             │
  ├────────────────────┼───────────────────────────────────────────────────────────────┤
  │ Docker daemon      │ Running                                                       │
  ├────────────────────┼───────────────────────────────────────────────────────────────┤
  │ PostgreSQL + Redis │ Running (via docker-compose)                                  │
  ├────────────────────┼───────────────────────────────────────────────────────────────┤
  │ Backend code       │ Merged (Container + Slack + all sprints)                      │
  ├────────────────────┼───────────────────────────────────────────────────────────────┤
  │ 1191 tests         │ All passing                                                   │
  ├────────────────────┼───────────────────────────────────────────────────────────────┤
  │ Container runtime  │ CONTAINER_RUNTIME=docker configured                           │
  ├────────────────────┼───────────────────────────────────────────────────────────────┤
  │ OpenClaw image     │ clawdbotsandbox_clawdbot-gateway-secure-test:latest available │
  ├────────────────────┼───────────────────────────────────────────────────────────────┤
  │ Age key injection  │ Wired (HKDF + X25519 + putArchive)                            │
  ├────────────────────┼───────────────────────────────────────────────────────────────┤
  │ Secrets master key │ Set in .env                                                   │
  ├────────────────────┼───────────────────────────────────────────────────────────────┤
  │ Slack env vars     │ Placeholders ready, awaiting your Slack app credentials       │
  └────────────────────┴───────────────────────────────────────────────────────────────┘
  Once you have the Slack credentials and update the .env, you can start the backend with:
  cd /Users/azidan/Work/Repos/AIProjects/ClawdBotSandbox/workspace/projects/ai-transformation-sprint9/backend
  npx prisma migrate dev
  npm run start:dev
