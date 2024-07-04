# だらずさん LLM

LLM 版だらずさん

## インストール

Step 1
: [Create New Slack App](https://api.slack.com/apps?new_app=1&manifest_yaml={display_information:%20{name:%20darazllm},%20features:%20{bot_user:%20{display_name:%20darazllm}},%20oauth_config:%20{scopes:%20{bot:%20[%27channels:history%27,%20%27chat:write%27]}},%20settings:%20{event_subscriptions:%20{request_url:%20%27https://darazllm.deno.dev/slack/events%27,%20bot_events:%20[message.channels]}}}) > Select a workspace > Create > Install to Workspace

Step 2
: [Fork to Edit](https://dash.deno.com/playground/darazllm) > Settings > Environment Variables

Step 3
: [Slack Applications](https://api.slack.com/apps) > "darazllm" > Event Subscriptions ページの URL を Deno Deploy の URL (例: `https://darazllm.deno.dev/slack/events`) に変更

## ライセンス

WTFPL
