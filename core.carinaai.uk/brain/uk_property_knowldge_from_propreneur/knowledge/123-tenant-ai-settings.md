# Tenant AI Settings

**Last updated:** 2026-05-17

## Overview
Configure your workspace's Carina AI experience. Choose which AI provider and model powers Carina, write custom system prompts to shape her personality and knowledge, and view rate limit status. Supports bring-your-own-key (BYOK) for tenants who want to use their own AI API keys.

## Core Features
- **AI provider & model selection** - Choose from supported providers (OpenAI, Anthropic, Google) and specific models
- **Bring-your-own-key (BYOK)** - Use your own API key for the AI provider
- **Custom system prompts** - Write tailored prompts that define how Carina behaves and what knowledge she prioritises
- **Default prompt management** - Set one custom prompt as the default for all conversations
- **Rate limit controls** - View and manage usage limits per workspace and per user
- **Provider availability** - See which providers and models are available

## Getting Started
1. Go to AI Settings in your workspace
2. Select your preferred provider and model
3. Optionally add your own API key
4. Write custom system prompts if you need Carina to have specific knowledge or behaviour
5. Review rate limit usage

## Key Workflows

### Setting up a custom system prompt
Write a system prompt that instructs Carina on how to behave, what to prioritise, and what domain knowledge to use. Save multiple prompts and set one as the default. The default prompt applies to all new conversations unless a specific brain modifier overrides it.

### Bring-your-own-key
Enter your own API key for the AI provider. This means your usage is billed directly to your provider account rather than through the platform. Keys are encrypted at rest. You can switch between BYOK and platform-provided keys at any time.

### Checking rate limits
View your workspace's current rate limit usage - hourly and daily limits per workspace and per user. Limits show how many messages have been used and what's remaining.

## Business Rules
- Only one default system prompt per workspace at a time
- Setting a new default automatically unsets the previous one
- BYOK keys take priority over platform-provided keys
- Rate limits are enforced per workspace and per user
- Provider/model selection applies to all Carina conversations in the workspace
- System prompts can be created, edited, and deleted independently

## Best Practices
- Write system prompts that reflect your property business focus and tone
- Use BYOK if you have high-volume AI needs and want direct billing
- Create separate prompts for different use cases (deal analysis, mentoring, support)
- Test new prompts with a few conversations before setting as default
- Monitor rate limit usage during peak periods

## Related Features
- **Carina Agent** - The AI agent that uses these settings
- **Carina Conversation Insights** - Insights extracted from conversations
- **Subscriptions & Billing** - AI usage limits tied to subscription plan
