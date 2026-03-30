# Sprint Review -- 2026-03-28

**Date:** 2026-03-28
**Attendees:** Alice, Bob, Carol, Dave
**Facilitator:** Alice

## Discussion

### Backend API Performance
The API latency dropped from 450ms to 120ms after switching to connection pooling.

- Bob investigated the root cause
- Carol deployed the fix to staging on Monday
- Production deploy planned for next sprint

### Mobile App Release
Version 2.5 is ready for App Store review.

- Dave submitted the build on Wednesday
- Waiting for Apple review approval
- Crashlytics shows 0.1% crash rate on beta

## Decisions

- Adopt Vitest for all new test suites
- Deprecate the legacy /v1 API by end of Q2
- Move standup from 10:00 to 09:30

## Action Items

- [ ] Bob: Set up connection pooling monitoring dashboard by Apr 2
- [ ] Carol: Write migration guide for /v1 to /v2 by Apr 5
- [ ] Dave: Schedule App Store release for Apr 1
- [ ] Alice: Update sprint board with new velocity metrics
