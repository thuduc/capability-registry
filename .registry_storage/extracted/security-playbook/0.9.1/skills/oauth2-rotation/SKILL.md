# Skill: OAuth2 Secret Rotation
Procedural guide to rotating active API gateway client secrets without downtime.

## Step-by-Step Procedure
1. Provision secondary client secret in the identity portal.
2. Deploy the secondary secret to all consumer client stores.
3. Monitor traffic. Once secondary secret accounts for 100% of calls, deprecate primary secret.
