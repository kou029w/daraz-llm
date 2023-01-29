# だらずさん GPT

GPT 版だらずさん

## インストール

Step 1
: Slack アプリの作成

[Slack Applications](https://api.slack.com/apps) → Create New App → From an app manifest

下記の Manifest をコピペして、Slack アプリを作成

```yaml
display_information:
  name: daraz-gpt
features:
  bot_user:
    display_name: daraz-gpt
oauth_config:
  scopes:
    bot:
      - app_mentions:read
      - chat:write
settings:
  event_subscriptions:
    request_url: https://daraz-gpt.vercel.app/api/slack/events
    bot_events:
      - app_mention
```

Step 2

: Vercel へのデプロイ

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fkou029w%2Fdaraz-gpt&env=SLACK_BOT_TOKEN,SLACK_SIGNING_SECRET,OPENAI_API_KEY)

- `SLACK_BOT_TOKEN` ... [Slack Applications](https://api.slack.com/apps) → "daraz-gpt" → Permissions ページにある `xoxb-` から始まるボットトークン
- `SLACK_SIGNING_SECRET` ... [Slack Applications](https://api.slack.com/apps) → "daraz-gpt" → Basic Information ページにある Signing Secret
- `OPENAI_API_KEY` … [OpenAI API Key](https://beta.openai.com/account/api-keys)

## ライセンス

WTFPL
