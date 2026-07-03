# LLM audit module

Audits every place the codebase touches a language model: prompt construction and context, model selection and pinning, provider SDK mechanics, reliability, trust boundaries, agents and tools, RAG, structured output, cost, latency, evals, and observability. Feeds findings `F-LLM-n` and a 0-100 domain score into AUDIT.mdx. The orchestrator loads this module whenever the intake fingerprint finds a model or embeddings call site; archetypes with no LLM surface (cli-tool and marketing-site most often) exclude it with the reason recorded in the applicability matrix. Per intake, a provider dependency with no call site is a stack finding, not an llm pass.

## Lineage

Descends from llmauditor, the read-only end-to-end audit of LLM integrations, and mirrors the godplans LLM module one to one: `A-LLM-n` audits in code exactly what `R-LLM-n` demanded at plan time. The llmauditor disciplines carry over intact: verify against the shipped request payload, never the prompt's wording ("respond only with JSON" is not structured output, "only access this user's records" is not authorization); hunt paper controls as hard as absences; calibrate every severity to the lethal trifecta (private data plus untrusted content plus external action) and to the declared paradigm and exposure; cluster repeated leaves into one root-cause finding; score each defect once under its owning dimension; and let any open Critical cap the domain at 69. Its twelve dimensions (LLMSEC through AGENT) survive as this domain's scoring table.

## Surface map

Inventory before any check runs. The intake fingerprint already lists LLM call sites, providers, and surfaces; cite it, do not re-scan.

- Provider SDKs and gateways: `anthropic`, `openai`, `google-genai`, `mistralai`, `cohere`, Bedrock via `boto3`, Azure and Vertex wrappers, LiteLLM, OpenRouter, local runtimes (Ollama, vLLM, `llama.cpp`), plus raw HTTP to provider endpoints.
- Call sites and prompt assembly: `messages.create`, `chat.completions.create`, `generateContent`, `embeddings.create`; template files and `prompts/` modules; f-strings and template literals building system or user messages inline.
- Model configuration: model-id literals (grep `claude-`, `gpt-`, `gemini-`, `-latest`), env vars, config modules, routing and fallback tables.
- Agents and tools: `tools=`, `tool_use`, `tool_calls`, `function_declarations`; frameworks (LangChain, LangGraph, LlamaIndex, CrewAI, AutoGen, Pydantic-AI); MCP wiring (`mcp.json`, `mcpServers`).
- RAG: vector stores (pgvector, Pinecone, Qdrant, Weaviate, Chroma, FAISS, LanceDB), chunkers, rerankers, reindex scripts and their cron or deploy hooks.
- Output, eval, observability: `response_format`, `json_schema`, `responseSchema`, Zod and Pydantic schemas near call sites; `evals/`, promptfoo, RAGAS, DeepEval, CI workflows invoking them; Langfuse, LangSmith, Helicone, OpenTelemetry GenAI.

Two conditional sub-surfaces must be declared present or absent, with the reason recorded: RAG (activates A-LLM-20 and A-LLM-21) and agents or tool use (activates A-LLM-22). Absence drops their scoring dimensions with re-normalization.

## Checks

A-LLM-1 through A-LLM-23 mirror R-LLM-1 through R-LLM-23; A-LLM-24 and A-LLM-25 are audit-only. In plan-aware mode, also check the matching PLAN.mdx section and tag the R-id.

1. A-LLM-1: The trust-boundary architecture is real per LLM feature: every untrusted content source (RAG docs, tool results, web, files) is isolated from privileged channels, and every lethal-trifecta path has a structural mitigation, not a prompt line.
   Look: retrieval-to-prompt paths, agent orchestration, tool wiring; in plan-aware mode, the plan's trust-boundary map. Fail: a lethal-trifecta path guarded only by delimiters or instructions: Critical, filed as F-SEC per the ownership map and cited here.
2. A-LLM-2: Prompts flow through one versioned registry with strict role separation: durable instructions in the system role, untrusted values only in user-role slots delimited as data.
   Look: `prompts/` modules; grep system-message construction outside the registry; interpolation into system strings. Fail: user or retrieved content interpolated into the system role: High; inline prompt literals drifting across call sites: Medium.
3. A-LLM-3: Context assembly is budgeted and cache-stable: documents high, question last, token budget with windowing or summarization, byte-stable prefix with volatile values after the cache breakpoint.
   Look: message assembly code; timestamp, uuid, or user values near the prefix top; nondeterministic dict or set serialization. Fail: unbounded history or chunk stuffing with no budget: Medium; a volatile value before the cache breakpoint: Medium.
4. A-LLM-4: Every model-output sink validates: parameterized SQL, argv arrays, context-aware HTML encoding, URL allowlists on model-emitted fetches, no `eval` or `exec`, markdown auto-image egress controlled.
   Look: grep `eval(`, `exec(`, `shell=True`, `innerHTML`, `dangerouslySetInnerHTML`, string-built SQL, `fetch(` fed from response text. Fail: model output reaching a code, SQL, HTML, shell, or URL sink unvalidated: Critical, filed as F-SEC and cited here.
5. A-LLM-5: No secrets or authorization rules live in prompts; every security decision runs in deterministic code with the system prompt assumed public.
   Look: system prompt text for keys, connection strings, and "only admins" rules; the authz layer for the same rule in code. Fail: authorization enforced only by prompt instruction, or a secret in a prompt: Critical, filed as F-SEC and cited here.
6. A-LLM-6: Data governance is deliberate: PII minimized or redacted on the provider payload before send, provider data controls set (ZDR or store flags, region, executed DPA or BAA), retention TTLs on logs and traces, no cross-user memory sharing.
   Look: the request-path payload builder, client options such as `store`, redaction utils and their call sites, env and docs for agreements. Fail: raw regulated PII sent with no minimization and no agreement: Critical; redaction applied to logs but not the payload: High.
7. A-LLM-7: Model ids are pinned dated snapshots in one config constant with per-environment selection, a deprecation review noted, and eval-gated bumps.
   Look: grep `-latest` and bare family aliases; model literals outside the config module; test and dev tiers. Fail: a floating alias on a production path: Medium, High when the path is quality-critical and no eval gate exists; ids scattered across files: Medium.
8. A-LLM-8: Sampling and limits fit each task: temperature near 0 for extraction, classification, structured output, and tool arguments; the correct output-cap parameter sized to expected output; a per-path reasoning-budget policy.
   Look: call-site kwargs: `temperature`, `max_tokens`, `max_output_tokens`, `max_completion_tokens`, thinking budgets. Fail: default or high temperature on deterministic-extraction paths: Medium; missing or wrong output cap: Medium.
9. A-LLM-9: Routing and fallback are live: the escalation trigger reflects answer quality and can actually fire; every fallback model is reachable and request-shape compatible.
   Look: router modules, cascade conditionals, fallback lists and their request shapes. Fail: a trigger that never or always fires: Medium; a fallback naming a retired or shape-incompatible model (the failover itself 404s): High.
10. A-LLM-10: Every response consumption branches on `stop_reason`, `finish_reason`, and refusal before parsing, with truncation, `tool_use`, `pause_turn`, and `content_filter` handled distinctly.
    Look: response handling after each call site; grep `stop_reason` and `finish_reason` and read the branches. Fail: parsing on an unchecked stop reason, or a switch handling only `stop` with everything else falling through: High.
11. A-LLM-11: Native SDK mechanics are used: structured outputs or tool calling over prose parsing, prompt caching wired mechanically, Batch API for bulk offline work, one module-scope client with the async client in async paths, one embedding model shared by both paths.
    Look: `response_format` and tool schemas at call sites, `cache_control` or stable-prefix placement, loops over the sync endpoint, client construction inside handlers. Fail: bulk offline work looping the realtime endpoint: Medium; per-request client construction: Medium.
12. A-LLM-12: Reliability mechanics hold: a timeout on every call plus an overall deadline on multi-step operations, exponential backoff with jitter, a retry predicate covering `RateLimitError`, 429, 529, and 503 that honors `Retry-After` and never retries non-retryable 4xx, idempotency keys on side-effecting retries.
    Look: the client wrapper, retry decorators, catch clauses and their exception lists. Fail: no timeout on a model call: High; a predicate missing 429: High; a side-effecting retry with no stable idempotency key: High.
13. A-LLM-13: Failures surface: no except-pass or return-empty on model errors, bounded fan-out concurrency, a circuit breaker, a fallback or explicit degradation branch, recovery for truncation and refusal stops.
    Look: grep `except` blocks and `.catch(` around call sites, unbounded `gather` or `Promise.all`, breaker wiring. Fail: a model error swallowed into a silent empty answer: High; unbounded concurrent fan-out: Medium.
14. A-LLM-14: Every parsed response is schema-validated before downstream use with strict schemas (`additionalProperties: false`, all fields required), validation-error feedback on parse-failure retries, tool arguments re-validated after confirming the expected tool, no decision resting solely on a model-returned boolean.
    Look: parse sites, Pydantic, Zod, or jsonschema validation calls, schema definitions near call sites. Fail: parsed output crossing into app code unvalidated: High; a security decision gated on a model boolean: Critical, filed as F-SEC and cited here.
15. A-LLM-15: Cost is controlled: model tier mapped to task value, pre-call per-user or per-tenant quotas, loop budgets distinct from per-call caps, the `usage` block captured for attribution, caches keyed by content hash including every output-changing parameter.
    Look: quota checks upstream of call sites, `usage` reads, cache key builders, tier choices on high-volume paths. Fail: unbounded call volume with no pre-call quota (denial of wallet): High; usage discarded with no attribution: Medium.
16. A-LLM-16: Latency is engineered: unbuffered streaming on user-facing paths, parallel independent calls, embeddings batched as arrays, no sync client in async handlers, non-inline generation off the critical path, light models on latency-sensitive routes.
    Look: `stream=` usage and whether the stream is joined before returning, back-to-back awaits, per-row LLM loops, one-at-a-time embedding calls. Fail: no streaming on a user-facing chat path, or a sync client blocking an async handler: Medium.
17. A-LLM-17: An eval harness gates change: a golden dataset with negative, adversarial, and refusal cases per quality-critical feature, scoring fit to the output type, a CI gate with a committed baseline blocking prompt, few-shot, and model-id changes, cassettes instead of live calls, temperature 0 on asserted tests.
    Look: `evals/` and test dirs, CI workflows that invoke them, baseline files, provider hits in CI. Fail: no eval for a quality-critical feature, or a committed suite CI never runs: High.
18. A-LLM-18: Judges and specialized evals are sound: rubric, randomized pairwise order, and a different model family for any LLM judge; agent evals assert trajectory (tools, order, termination); RAG gets a retrieval eval (recall@k, precision@k, MRR, or nDCG) plus a grounding check.
    Look: judge prompts and model config inside eval code, trajectory assertions, labeled query-doc sets. Fail: a same-family judge with fixed order: Medium; a RAG feature with only end-to-end eval: Medium.
19. A-LLM-19: Observability is attached: a tracing wrapper on every call capturing prompt, response, model, latency, outcome, and usage; a shared trace id threaded through agent and RAG child steps; p95 and p99 latency plus typed error metrics with alerts; a feedback signal joinable to traces.
    Look: wrapper or decorator coverage versus raw call sites, trace-id threading, metric and alert config. Fail: raw SDK calls bypassing the tracer, or instrumentation constructed but never attached: Medium. Log redaction gaps file as F-SEC; fleet alerting shape as F-OBS, per the ownership map.
20. A-LLM-20 (RAG only): Embedding parity and lifecycle: one pinned model and dimension across ingestion and query with the version stored in the index, the index metric matching the embedding, a reindex path triggered by edits, deletes, and model bumps, structure-aware chunking with overlap under the token limit, provenance carried into the prompt.
    Look: embedding constants read by both paths, index config, reindex scripts and their deploy or cron wiring, the chunker. Fail: ingestion and query embedding with different models or dimensions (retrieval silently near-random): Critical; no reindex path: High.
21. A-LLM-21 (RAG only): Retrieval is tuned: hybrid dense plus BM25 with rank fusion where the corpus holds exact identifiers, reranker output actually ordering results, top-k with a relevance threshold and an explicit empty-result branch, ANN parameters sized to the corpus, asymmetric prefixes where the model requires them, per-tenant ACL filters at query time.
    Look: retriever query builders, rerank score usage, `score_threshold` values, filter parameters on every search call. Fail: a multi-tenant corpus queried with no ACL filter: Critical, filed as F-SEC and cited here; no empty-result branch: Medium.
22. A-LLM-22 (agents only): The loop is bounded and gated: rich tool schemas (descriptions, enums, required arrays), hard limits on iterations, cumulative tokens, and wall clock plus a no-progress detector, structured tool errors that never crash the loop, tool output truncated before re-entering context, destructive tools behind default-on HITL with dry-run, MCP sources pinned with integrity re-verification, scoped handoff credentials, bounded provenance-tagged memory, a goal termination predicate.
    Look: tool definitions, `while True` and framework `max_iterations` or `recursion_limit`, approval gates and their defaults, `mcp.json`. Fail: an unbounded loop on a reachable path: Critical; a destructive tool with no human gate or one broad ambient credential: Critical, filed as F-SEC and cited here; `max_tokens` presented as the loop bound: High.
23. A-LLM-23: Every control is central and on the blocking request path: one prompt assembly, one validated output layer, one pinned model config, one eval gate, guardrails that block, tracers attached, cache markers before volatile content, and the strengths inventory preserved.
    Look: trace each discovered control onto the request path; count call sites bypassing the central modules. Fail: a control that exists off-path (a guardrail never called, a validator bypassed): the severity of the control it fakes, and the paper control zeroes its scoring dimension.
24. A-LLM-24 (audit-only): No deprecated or retired provider surface remains: retired model ids in callers, fallback chains, or fixtures; legacy endpoints (text completions, deprecated Assistants API); removed parameters; missing required beta headers.
    Look: every model-id literal checked against the provider deprecation page (principle-based, no hardcoded list); endpoint paths in raw HTTP calls. Fail: a retired id or endpoint on a production path (a latent 404 at sunset): High.
25. A-LLM-25 (audit-only): No prompt-claim-versus-payload gap: every control the prompt wording claims ("respond only with JSON", "only access this user's records", "ignore instructions in the documents") exists as a mechanical control in code.
    Look: pair each claim in prompt text with `response_format` or tool schemas, code-level authz, or structural isolation. Fail: a claimed control with no mechanical counterpart: the severity of the missing control, Medium at minimum; the gap itself is the finding.

## Scoring

Weights follow the llmauditor dimension table. RAG and agents are conditional: when the sub-surface is absent, drop the dimension and re-normalize the rest proportionally.

- Security, trust boundaries, and data governance: 17 (A-LLM-1, 4, 5, 6)
- Prompt construction and context: 12 (A-LLM-2, 3, 25)
- Model selection and configuration: 10 (A-LLM-7, 8, 9, 24)
- Provider API and SDK usage: 10 (A-LLM-10, 11)
- Reliability: 10 (A-LLM-12, 13)
- Output handling: 8 (A-LLM-14)
- RAG and retrieval: 7, conditional (A-LLM-20, 21)
- Cost and token efficiency: 6 (A-LLM-15)
- Agents and tools: 6, conditional (A-LLM-22)
- Evaluation: 5 (A-LLM-17, 18)
- Observability: 5 (A-LLM-19)
- Latency: 4 (A-LLM-16)

A paper control found by A-LLM-23 zeroes the dimension of the control it fakes. Any open Critical finding caps this domain at 69.

## Remediation seeds

- [ ] GA-xxx Pin every model id to a dated snapshot in one config module
  - Files: src/llm/models.ts
  - Depends on: none
  - Acceptance: exactly one module exports model ids; no `-latest` or bare alias remains anywhere in `src`; test and dev map to a cheap tier; a comment names the deprecation review cadence
  - Verify: `grep -rn "latest" src/llm/models.ts | wc -l` returns 0
  - Checks: A-LLM-7, A-LLM-24
- [ ] GA-xxx Centralize prompts in a versioned registry with role separation
  - Files: src/llm/prompts/registry.ts, src/llm/prompts/versions/
  - Depends on: none
  - Acceptance: all templates live in the registry with version ids; system-role templates carry no user or retrieved-content slot; untrusted values inject only into user-role slots labeled as data; volatile values serialize after the cache breakpoint
  - Verify: `grep -rn "role: .system" src --include="*.ts" | grep -v "src/llm/prompts/" | wc -l` returns 0
  - Checks: A-LLM-2, A-LLM-3, A-LLM-25
- [ ] GA-xxx Gate all parsing on stop reason and schema-validate every output
  - Files: src/llm/output/schemas.ts, src/llm/output/parse.ts
  - Depends on: none
  - Acceptance: every parse branches on `stop_reason` first with named truncation, refusal, and `content_filter` branches; every schema sets `additionalProperties: false` with all fields required; parse-failure retries feed the validation error back
  - Verify: `grep -c "stop_reason" src/llm/output/parse.ts` is at least 1
  - Checks: A-LLM-10, A-LLM-14
- [ ] GA-xxx Wrap all model calls in one reliability and tracing client
  - Files: src/llm/client.ts, src/llm/tracing.ts
  - Depends on: none
  - Acceptance: a single module-scope client with per-call timeout and operation deadline; the retry predicate names `RateLimitError` plus 429, 529, and 503 and honors `Retry-After`; every call records model, latency, outcome, and the `usage` block under a shared trace id
  - Verify: `grep -c "Retry-After" src/llm/client.ts` is at least 1
  - Checks: A-LLM-12, A-LLM-13, A-LLM-15, A-LLM-19
- [ ] GA-xxx Stand up the eval harness with a CI baseline gate
  - Files: evals/golden/, evals/run.ts, .github/workflows/evals.yml, evals/baseline.json
  - Depends on: none
  - Acceptance: the golden set includes negative, adversarial, and refusal cases; CI invokes the eval on prompt, few-shot, and model-id changes; a committed baseline with a regression threshold blocks merge; tests use cassettes at temperature 0
  - Verify: `grep -c "evals/run" .github/workflows/evals.yml` is at least 1
  - Checks: A-LLM-17, A-LLM-18
- [ ] GA-xxx Bound the agent loop and gate destructive tools
  - Files: src/agent/loop.ts, src/agent/approval.ts
  - Depends on: none
  - Acceptance: the loop enforces max iterations, cumulative tokens, and wall clock as separate checks; destructive tools call the approval gate default-on with dry-run; tool errors return structured results; termination requires the goal predicate
  - Verify: `grep -c "maxIterations" src/agent/loop.ts` is at least 1
  - Checks: A-LLM-22
- [ ] GA-xxx Restore embedding parity and query-time tenant filtering
  - Files: src/rag/embeddings.ts, src/rag/query.ts, src/rag/reindex.ts
  - Depends on: none
  - Acceptance: one exported embedding model and dimension constant imported by ingestion and query; every search passes a tenant ACL filter; a reindex script is wired to a deploy hook or cron entry
  - Verify: `grep -rn "EMBEDDING_MODEL" src/rag | grep -c "import"` is at least 2
  - Checks: A-LLM-20, A-LLM-21

## Anti-patterns hunted

- Prompt-claim-as-control: "respond only with JSON" over a plain-text call, "only this user's records" with no authz code. Hunt via A-LLM-25; the gap is the finding, severity of the missing mechanism.
- Guardrail off-path: an injection classifier or moderation call defined but never invoked before the request, or run only on the direct user turn and never on retrieved or tool content. Trace the request path; off-path zeroes the dimension.
- Cache buster: `cache_control` or a stable prefix placed after a timestamp, uuid, or unsorted serialization. Check byte stability of the prefix, not the marker's presence.
- Decorative retry: a predicate listing only `ConnectionError` while `RateLimitError` and 429 fall through, or `Retry-After` parsed then discarded. Read the exception list, not the wrapper's name.
- `max_tokens` as loop bound: a per-call output cap presented as agent-loop control. Demand separate iteration, cumulative-token, and wall-clock budgets plus a termination predicate.
- ACL in metadata only: a tenant field stored on every vector but never passed as a query filter. Read the search call signature; storage is not enforcement.
- Eval theater: an `evals/` directory or RAGAS dependency no CI job invokes, scores with no committed baseline, a same-family judge in fixed order. Green-by-neglect is a High finding, not a pass.
- Dead instrumentation: a Langfuse or LangSmith handler constructed but never passed to the call, spans opened around an unconsumed iterator recording near-zero, sampling at zero in prod.
- Pinned in name only: a `MODEL_VERSION` constant whose value is still an alias, a `select_model()` whose every branch returns the flagship, a fallback list naming a retired id.
- Fake batch: a "batch" helper fanning out concurrent realtime calls with no Batch API and no discount. Check the endpoint, not the function name.
- Default-open gate: an approval or HITL flag that defaults to auto-approve, or an `interrupt()` helper absent from the destructive path. Read the default, not the capability.
- Auditor discipline: no finding that survives the substitution test unrewritten; no double-billing (injection-to-sink, authz-by-prompt, cross-tenant retrieval, and secrets file as F-SEC; log redaction F-SEC; alerting shape F-OBS; this pass cites, never re-scores); no severity inflation (calibrate to the paradigm and exposure from intake; absence of tiered routing under homogeneous load is not a defect); never include a working jailbreak or injection payload in a finding.
