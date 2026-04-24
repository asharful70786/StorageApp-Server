# StorageApp — Production-Grade Cloud Storage Platform (Serverless Architecture)

## Executive Summary

StorageApp is a production-ready cloud storage platform designed and built end-to-end with a strong focus on **cost efficiency, scalability, and operational simplicity**.

The system originally ran on an always-on **AWS EC2 + Nginx** setup. While technically robust and capable of zero-downtime deployments, that architecture proved **economically inefficient for a low-to-moderate traffic workload**. To eliminate unnecessary 24×7 infrastructure costs, the backend was migrated to a **fully serverless architecture using AWS Lambda and API Gateway**, without changing the core application code, APIs, or data model.

Today, StorageApp operates as a **stateless, event-driven backend** that scales automatically with demand and incurs cost **only when used**.

---

## Architecture Overview

### Current (Production) Architecture — Serverless

* **Frontend**: React SPA served via **S3 + CloudFront**
* **API Gateway**: AWS **HTTP API Gateway** as the single public entry point
* **Compute**: AWS **Lambda** running the existing Express application via `serverless-http`
* **Database**: MongoDB (unchanged)
* **Cache / Sessions**: Redis (unchanged)
* **Object Storage**: AWS S3 with CloudFront CDN
* **Authentication**: Email OTP + Google OAuth with Redis-backed sessions

This architecture is **horizontally scalable by design** and eliminates idle infrastructure costs.

---

### Legacy Architecture — EC2 + Nginx (Deprecated)

* AWS EC2 instance running Node.js + Express
* Nginx as reverse proxy and TLS terminator
* Always-on server (24×7)
* GitHub Actions for zero-downtime deployments

While stable and production-grade, this model incurred **continuous compute costs regardless of traffic volume**, making it inefficient for early-stage or bursty workloads.

---

## Why the Migration to Serverless

The decision to migrate was **cost-driven and workload-driven**, not trend-driven.

### Observed Problems with EC2

* EC2 instances run 24×7 even during idle periods
* Low user traffic did not justify fixed monthly compute costs
* Occasional CPU spikes required manual tuning and headroom provisioning

### Benefits Achieved with Lambda

* **Pay-per-request pricing** instead of fixed infrastructure cost
* Automatic horizontal scaling without server management
* No change required to application logic or APIs
* CPU spikes handled automatically by Lambda’s execution model

Cold starts have **not been noticeable in production usage** under current traffic patterns.

---

## What Changed vs What Didn’t

### Unchanged

* Application codebase (Express.js)
* REST APIs and routes
* Database schema and data
* Redis usage (sessions, caching)
* Authentication and authorization logic
* Business rules and billing workflows

### Changed

* Deployment model: EC2 → AWS Lambda
* Request entry point: Nginx → API Gateway
* Scaling strategy: manual / instance-based → event-driven auto-scaling

This ensured **minimal migration risk** while achieving immediate cost reduction.

---

## Frontend & CDN

The frontend is a **React single-page application** deployed separately from the backend:

* Build artifacts stored in **AWS S3**
* Globally distributed via **CloudFront CDN**
* No server-side rendering (pure SPA)
* CI/CD-friendly and continuously deployable

This keeps frontend delivery fast, inexpensive, and operationally simple.

---

## CI/CD Status

* **Frontend**: CI/CD-ready with automated builds and deployments to S3 + CloudFront
* **Backend (Serverless)**: CI/CD pipeline **not yet implemented**

Planned backend CI/CD 

This is intentionally deferred to avoid premature tooling complexity during early usage.

---

## Performance Characteristics

* Stateless backend enables horizontal scaling
* Redis minimizes database reads and authentication latency
* Pre-signed S3 URLs offload heavy file traffic from compute layer
* API Gateway provides built-in throttling and request isolation

The system is optimized for **low-to-moderate traffic with burst capability**, aligning with current usage patterns.

---

## Tech Stack

| Layer       | Technologies                     |
| ----------- | -------------------------------- |
| Frontend    | React, React Router, TailwindCSS |
| Backend     | Node.js, Express.js              |
| Compute     | AWS Lambda                       |
| API Gateway | AWS HTTP API                     |
| Database    | MongoDB                          |
| Cache       | Redis                            |
| Storage     | AWS S3                           |
| CDN         | CloudFront                       |
| Auth        | Email OTP, Google OAuth          |

---

## Roadmap

* Split monolithic Lambda into domain-specific functions as traffic grows
* Add backend CI/CD with safe rollback
* Introduce request-level observability and tracing
* Optional containerized deployment for sustained high-throughput workloads

---


## Author

**Ashraful Momin**
Backend-first Full-Stack Engineer
Designing cost-efficient, production-ready cloud systems

[https://www.ashraful.in/](https://www.ashraful.in/)
