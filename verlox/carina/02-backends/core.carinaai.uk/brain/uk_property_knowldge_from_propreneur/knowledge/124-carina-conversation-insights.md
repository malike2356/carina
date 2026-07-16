# Carina Conversation Insights

**Last updated:** 2026-05-17

## Overview
An automatic pipeline that extracts knowledge, patterns, and trends from Carina conversations. Conversations are analysed for valuable insights, personal data is redacted, quality is scored, and approved insights are promoted to Carina's brain knowledge files so she becomes smarter over time.

## Core Features
- **Automatic insight extraction** - Recent conversations are analysed to identify knowledge, patterns, trends, and common questions
- **PII redaction** - Personal data (emails, phone numbers, names, postcodes) is automatically removed before analysis
- **Quality scoring** - Each insight is scored 0-100% for quality and usefulness
- **Human review pipeline** - Insights are staged for review; platform admins approve or reject before promotion
- **Brain knowledge promotion** - Approved insights are formatted as markdown and added to Carina's knowledge base
- **Incognito exclusion** - Conversations in incognito mode are skipped

## Getting Started
Insight extraction runs automatically in the background. Platform admins can:
1. Review staged insights in the admin dashboard
2. Approve or reject each insight
3. Promote approved insights to Carina's brain knowledge
4. View extraction statistics and quality distribution

## Key Workflows

### The extraction pipeline
1. Recent conversations with sufficient messages are selected
2. Personal data is automatically redacted (replaced with placeholders like [EMAIL], [NAME])
3. The conversation is sent to Carina for insight analysis
4. Insights are scored for quality
5. Insights meeting quality thresholds are saved as "staged" for human review

### Promoting insights
Platform admins review staged insights. Each insight shows a quality score, domain tags, and content preview. Admins can approve (moves to promotion ready), reject (discards), or promote directly to the knowledge base. Promoted insights are written as markdown files that Carina can reference.

## Business Rules
- PII is always redacted before any LLM extraction
- Insights have a minimum quality threshold for promotion eligibility
- Source conversations are blinded (not directly identifiable)
- Incognito mode conversations are excluded from extraction
- Extraction runs in batches, logged per batch
- Two-stage pipeline: AI extracts and stages, humans review and promote

## Best Practices
- Review staged insights regularly - every few days
- Approve insights that capture genuinely useful property knowledge
- Reject low-quality or redundant insights
- Monitor extraction statistics to see what topics generate the most insights
- Use the quality score to prioritise which insights to review first

## Related Features
- **Carina Agent** - The conversations that feed into insight extraction
- **Tenant AI Settings** - Configure which provider powers extraction
- **Compliance** - PII redaction aligns with GDPR data protection
