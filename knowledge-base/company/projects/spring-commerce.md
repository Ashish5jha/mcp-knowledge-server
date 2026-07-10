---
id: proj-spring-commerce
title: Spring Commerce — E-Commerce Backend
type: project
tags: [ecommerce, spring-boot, java, postgresql, docker]
keywords: [ecommerce, shop, product, order, cart, spring, commerce, backend]
related: [skill-spring-boot, skill-postgresql]
summary: Full e-commerce backend built with Spring Boot 3.3, JPA, Hibernate, MySQL, Docker, and Spring Security. Handles products, orders, users, and payments.
priority: 2
updated_at: 2026-06-15
---

# Spring Commerce — E-Commerce Backend

## Stack

- Spring Boot 3.3 / Java 17
- JPA + Hibernate (MySQL)
- Spring Security (JWT)
- Docker + Docker Compose
- REST API with OpenAPI docs

## Key Features

- Product catalogue with category hierarchy
- Shopping cart with inventory validation
- Order lifecycle management (placed → paid → shipped → delivered)
- JWT authentication + refresh tokens
- Admin panel endpoints for inventory management

## Architecture

```
Client → API Gateway → Controllers → Services → Repositories → DB
```

Stateless REST API, horizontally scalable.
