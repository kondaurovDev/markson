# Why We Switched from REST to GraphQL

A practical guide based on our migration experience.

## The Problem

Our REST API had 47 endpoints. Mobile clients made 5-6 requests per screen. Performance suffered, and maintaining multiple BFF layers became unsustainable.

## What We Tried

### API Gateway with Aggregation
Added an API gateway to merge responses. Reduced client requests but introduced a new bottleneck.

- Latency increased by 80ms per aggregated call
- Gateway became a single point of failure
- Schema drift between services was hard to detect

### GraphQL Migration
Replaced the gateway with a single GraphQL endpoint backed by federated subgraphs.

- Clients fetch exactly what they need in one request
- Schema is the contract -- breaking changes are caught at build time
- Federation lets each team own their subgraph independently

## Results

- Mobile app load time dropped from 2.4s to 1.1s
- API endpoint count reduced from 47 to 1
- Developer onboarding time cut in half thanks to self-documenting schema

## Recommendations

- Start with a single subgraph, migrate incrementally
- Use persisted queries in production for security
- Invest in schema linting from day one
- Don't migrate if your API surface is small and stable
