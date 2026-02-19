# Ticket Triage

> Automatically classify and route incoming support tickets.

## Trigger

When invoked with input containing `ticket`.

### Expected Input

| Field              | Type   | Required | Description                     |
|--------------------|--------|----------|---------------------------------|
| ticket.id          | string | yes      | Ticket ID from source system    |
| ticket.title       | string | yes      | Ticket subject line             |
| ticket.body        | string | yes      | Full ticket description         |
| ticket.customer    | string | no       | Customer name or email          |
| ticket.source      | string | no       | Channel: email, chat, web       |

---

## Steps

### 1. Load Routing Rules

- **Action:** read_asset
- **File:** assets/routing-rules.json
- **Store as:** `routing_rules`

### 2. Classify Ticket

- **Action:** llm_prompt
- **Template:** templates/classify.hbs
- **Input:**
  - title: `{{input.ticket.title}}`
  - body: `{{input.ticket.body}}`
  - rules: `{{routing_rules}}`
- **Store as:** `classification`
- **Expected output:**
  ```json
  {
    "priority": "high | medium | low",
    "confidence": 0.85,
    "team": "billing | engineering | security | general",
    "reasoning": "..."
  }
  ```

### 3. Apply Confidence Threshold

- **Action:** conditional
- **If:** `{{classification.confidence}} >= {{config.confidence_threshold}}`
  - **Then:** use `{{classification.priority}}`
  - **Else:** use `{{config.default_priority}}`
- **Store as:** `final_priority`

### 4. Enrich with History

- **Action:** run_script
- **Script:** scripts/lookup-customer.js
- **Input:**
  - customer: `{{input.ticket.customer}}`
  - routing_rules: `{{routing_rules}}`
- **Store as:** `customer_context`
- **Description:** Looks up customer tier and recent ticket count from routing rules data.

### 5. Update Ticket in Linear

- **Action:** http_post
- **URL:** `https://api.linear.app/graphql`
- **Headers:**
  - Authorization: `Bearer {{env.LINEAR_API_KEY}}`
  - Content-Type: `application/json`
- **Body:**
  ```json
  {
    "query": "mutation { issueUpdate(id: \"{{input.ticket.id}}\", input: { priority: {{final_priority_int}}, teamId: \"{{team_id}}\" }) { success } }"
  }
  ```
- **Store as:** `linear_response`

### 6. Notify Slack (Optional)

- **Action:** conditional
- **If:** `{{config.notify_slack}} == true AND {{final_priority}} == "high"`
  - **Then:**
    - **Action:** http_post
    - **URL:** `{{env.SLACK_WEBHOOK_URL}}`
    - **Body template:** templates/slack-alert.hbs
    - **Input:**
      - ticket: `{{input.ticket}}`
      - classification: `{{classification}}`
      - customer: `{{customer_context}}`

---

## Error Handling

| Step | On Failure | Action |
|------|-----------|--------|
| 2. Classify Ticket | LLM timeout or parse error | Retry once, then assign `{{config.default_priority}}` |
| 4. Enrich with History | Script error | Continue without enrichment (non-blocking) |
| 5. Update Linear | API error | Return error with Linear response body |
| 6. Notify Slack | Webhook failure | Log warning, do not fail the skill |

---

## Output

| Field              | Source                          | Description                   |
|--------------------|---------------------------------|-------------------------------|
| priority           | `{{final_priority}}`            | Assigned priority level       |
| team               | `{{classification.team}}`       | Routed team                   |
| confidence         | `{{classification.confidence}}` | Classification confidence     |
| reasoning          | `{{classification.reasoning}}`  | Why this classification       |
| customer_tier      | `{{customer_context.tier}}`     | Customer tier (if found)      |
| linear_updated     | `{{linear_response.success}}`   | Whether Linear was updated    |
| slack_notified     | boolean                         | Whether Slack was notified    |
