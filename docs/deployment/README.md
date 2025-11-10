# Campaign Manager - Deployment Documentation

This directory contains comprehensive production deployment and scaling documentation for the Campaign Manager system.

## Document Guide

### 1. **SCALING_GUIDE.md** (2040 lines)

**Start here for comprehensive scaling information**

The main scaling guide covering:

- Horizontal scaling patterns (API, Rules Engine, Scheduler)
- Service statelessness and load balancing
- Session/state management (JWT, WebSocket, subscriptions)
- Connection pooling (PostgreSQL, Redis)
- Multi-layer caching architecture (4 tiers)
- Cache invalidation patterns and strategies
- Performance optimization (database, GraphQL, frontend, real-time)
- Rules Engine performance characteristics
- Monitoring and observability
- Scaling to specific load tiers (Small → Extreme)
- Troubleshooting and optimization steps
- Complete reference configurations

### 2. **SCALING_RESEARCH_SUMMARY.md** (555 lines)

**Verification of all claims in the main guide**

Evidence-based research showing:

- Source code locations for each architecture component
- Concrete code examples from the codebase
- Production configuration details from docker-compose
- Health check implementations
- Environment variable configurations
- Performance metrics and targets
- Key findings summary with source verification

### 3. **SCALING_CODE_EXAMPLES.md** (725 lines)

**Copy-paste ready implementation examples**

Production-ready code for:

- Cache usage patterns (basic operations, cascading invalidation)
- Health check implementation (indicator, controller, module)
- DataLoader patterns (using existing, creating new)
- WebSocket configuration (room subscriptions, updates)
- Nginx load balancer configuration
- PgBouncer connection pooling
- Docker Compose scaling setup
- Monitoring and metrics collection
- Debugging and troubleshooting utilities

---

## Quick Start by Use Case

### "I need to understand how this system scales"

→ Read **SCALING_GUIDE.md** - Part 1 (Horizontal Scaling Patterns)

### "I need to optimize database performance"

→ Read **SCALING_GUIDE.md** - Part 3.1 (Database Query Optimization)

### "I need to improve cache hit rates"

→ Read **SCALING_GUIDE.md** - Part 2 (Multi-Layer Caching Architecture)

### "I need to set up monitoring"

→ Read **SCALING_GUIDE.md** - Part 4 (Monitoring and Observability)

### "I need code examples for caching"

→ Read **SCALING_CODE_EXAMPLES.md** - Section 1 (Cache Usage Examples)

### "I need to deploy to production"

→ Read **SCALING_CODE_EXAMPLES.md** - Section 5 (Production Deployment)

### "I want proof this actually works"

→ Read **SCALING_RESEARCH_SUMMARY.md** (all sections with source code references)

### "My system is slow - where do I start?"

→ Read **SCALING_GUIDE.md** - Part 6 (Troubleshooting and Optimization)

### "I need to scale from 100 to 10,000 users"

→ Read **SCALING_GUIDE.md** - Part 5 (Scaling to Specific Load Tiers)

---

## Key Architecture Insights

### The System is Built for Horizontal Scaling

**API Service** (`@campaign/api`):

- ✅ Stateless (no in-process session storage)
- ✅ Scales to 2-10+ replicas
- ✅ Requires load balancer
- ✅ All state in PostgreSQL + Redis

**Rules Engine Worker** (`@campaign/rules-engine`):

- ⚠️ Per-instance caching (not shared)
- ⚠️ Keep at 1 replica unless CPU-bound
- ✅ gRPC interface stateless
- ✅ Can scale to 2-3 if needed

**Scheduler Worker** (`@campaign/scheduler`):

- ⚠️ Cron jobs need distributed locking if scaled
- ✅ Bull job queue distributes work
- ✅ Keep at 1 replica for simplicity
- ✅ Can scale to 2+ with locking implemented

**Frontend**:

- ✅ Stateless (single-page app)
- ✅ Scales to 2+ replicas
- ✅ All state in client (Zustand) or server (API)

### Multi-Tier Caching Strategy

```
Browser Cache (Apollo Client)
    ↓
Request-Scoped Cache (DataLoader)
    ↓
Cross-Request Redis Cache
    ↓
Rules Engine In-Memory Cache
    ↓
PostgreSQL (source of truth)
```

**Impact**: Well-tuned caching can reduce database load by 50-80%

### Real-time Updates via Redis Coordination

```
API-1 publishes event → Redis Pub/Sub → API-2 delivers to clients
                      → Websocket Rooms → API-3 delivers to clients
```

**No sticky sessions needed**: Clients can disconnect/reconnect to different replicas

---

## Performance Targets by Tier

### Small (1-100 concurrent users)

- P99 latency: <200ms
- Cache hit rate: >60%
- Resource: 1 API replica

### Medium (100-1000 concurrent users)

- P99 latency: <150ms
- Cache hit rate: >70%
- Resource: 3 API replicas

### Large (1000-10000 concurrent users)

- P99 latency: <100ms
- Cache hit rate: >75%
- Resource: 5-10 API replicas + read replicas

### Extreme (10000+ concurrent users)

- P99 latency: <50ms
- Cache hit rate: >80%
- Resource: Multi-region deployment

---

## Critical Configuration Parameters

### Cache TTL

```env
CACHE_DEFAULT_TTL=300        # Default: 5 minutes
# Adjust based on data change frequency
# - Rapidly changing: 60s
# - Slowly changing: 600s
```

### Rules Engine Cache

```env
CACHE_TTL_SECONDS=300        # Default: 5 minutes
CACHE_MAX_KEYS=10000         # Default: 10,000 expressions
RULES_ENGINE_CONCURRENCY=5   # Adjust based on load
```

### Database Connections

```env
# PostgreSQL
max_connections=200          # Set based on API replica count
# Formula: (api_replicas * 25) + buffer

# PgBouncer (connection pooler)
DEFAULT_POOL_SIZE=25         # Per API replica
MAX_CLIENT_CONN=500          # Total clients
```

### Redis Memory

```env
maxmemory=512mb              # Set based on cache size
maxmemory-policy=allkeys-lru # Evict LRU items when full
```

---

## Monitoring Checklist

### Health Metrics to Track

- [ ] API P50/P95/P99 latency
- [ ] Error rate (<0.1% target)
- [ ] Cache hit rate (>70% target)
- [ ] Database connection usage
- [ ] Redis memory usage
- [ ] WebSocket connection count
- [ ] Subscription count
- [ ] Rules Engine evaluation latency

### Alerts to Configure

- [ ] High error rate (>1%)
- [ ] Low cache hit rate (<50%)
- [ ] High database connection usage (>80%)
- [ ] High Redis memory usage (>80%)
- [ ] Slow queries (>100ms p95)
- [ ] WebSocket connection drops
- [ ] Rules Engine timeout
- [ ] Scheduler job failures

### Logs to Monitor

- [ ] Cache invalidation storms (pattern deletes >1000 per minute)
- [ ] Slow queries (>100ms)
- [ ] Redis connection issues
- [ ] Rules Engine errors
- [ ] Scheduler job failures
- [ ] Database replication lag (>100ms)

---

## Common Optimization Wins

### Quick Wins (implement first)

1. **Add missing database indexes** (10-50x improvement)
   - `@@index([kingdomId])` on Settlement
   - `@@index([deletedAt])` for soft delete filtering
   - `@@index([campaignId, entityType])` on FieldCondition

2. **Implement DataLoader batching** (5-20x improvement on nested queries)
   - Already implemented in codebase
   - Ensure all nested resolvers use DataLoader

3. **Increase cache TTL** (2-5x improvement on hit rate)
   - Set to match data change frequency
   - 300s for frequently changing data
   - 600s for slowly changing data

### Medium Effort Wins

4. **Enable query caching** (3-10x improvement)
   - Cache computed fields (already implemented)
   - Cache entity lists
   - Cache spatial queries

5. **Optimize expensive queries** (varies, 2-10x)
   - Remove SELECT \* queries
   - Join instead of subqueries
   - Use connection pooling

### High Effort Wins

6. **Scale database** (linear improvement)
   - Add read replicas
   - Implement read-write splitting
   - Consider sharding for massive scale

7. **Scale API replicas** (linear improvement)
   - Add replicas when P99 latency > threshold
   - Monitor CPU/memory per replica
   - Use load balancer for distribution

---

## File Organization

```
docs/deployment/
├── README.md                          (this file)
├── SCALING_GUIDE.md                   (comprehensive guide)
├── SCALING_RESEARCH_SUMMARY.md        (evidence/verification)
└── SCALING_CODE_EXAMPLES.md           (implementation examples)
```

---

## Version Information

**Campaign Manager Version**: 1.0.0
**Documentation Last Updated**: 2025-11-09
**Based on Codebase**: main branch

This documentation covers the production architecture as of the latest commit.

---

## Getting Help

### For specific questions about:

**Architecture decisions**: See SCALING_GUIDE.md Part 1-2
**Performance issues**: See SCALING_GUIDE.md Part 6 (Troubleshooting)
**Implementation details**: See SCALING_CODE_EXAMPLES.md
**Source code verification**: See SCALING_RESEARCH_SUMMARY.md

### For production deployment:

1. Start with SCALING_GUIDE.md - Part 5 (Scaling to Specific Load Tiers)
2. Use SCALING_CODE_EXAMPLES.md - Section 5 (Production Deployment Examples)
3. Set up monitoring using SCALING_GUIDE.md - Part 4
4. Run load tests before going to production
5. Monitor health checks from day 1

---

## Next Steps

1. **Understand the architecture**: Read SCALING_GUIDE.md Sections 1-2
2. **Review current performance**: Capture baseline metrics
3. **Identify bottlenecks**: Use SCALING_GUIDE.md Part 6 (Troubleshooting)
4. **Implement optimizations**: Start with quick wins from optimization checklist
5. **Set up monitoring**: Use examples from SCALING_CODE_EXAMPLES.md
6. **Scale gradually**: Follow tier progression in SCALING_GUIDE.md Part 5
7. **Load test before scaling**: Ensure changes handle target load
8. **Monitor in production**: Track metrics from health check section

---

End of README
