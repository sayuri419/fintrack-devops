# FinTrack API – Jenkins DevOps Pipeline (SIT223/SIT753 Task 7.3HD)

FinTrack is a personal finance and budgeting REST API (Node.js 20 / Express 5). Users register, sign in with JWT, record income and expense transactions, set monthly category budgets and get a monthly summary with savings rate and budget warnings. The app exposes health, readiness and Prometheus metrics endpoints so it can be deployed, tested and monitored end to end.

The repository contains the application **and** everything needed to run a 7-stage Jenkins pipeline on a laptop: Build → Test → Code Quality → Security → Deploy (staging) → Release (production) → Monitoring & Alerting.

```
GitHub ──poll──▶ Jenkins ─┬─ Build ── npm ci, build-info, docker build ──▶ local registry (localhost:5000) + archived .tar.gz
                          ├─ Test ── Jest unit + integration, JUnit + Cobertura, coverage gate
                          ├─ Code Quality ── ESLint (custom rules) + SonarQube quality gate
                          ├─ Security ── npm audit gate + Trivy fs (vuln/secret/misconfig) + Trivy image
                          ├─ Deploy ── docker compose → fintrack-staging:3001, smoke test, auto-rollback
                          ├─ Release ── promote same image → fintrack-prod:3000, semver tags, git tag, release notes
                          └─ Monitoring ── Prometheus + Alertmanager + Grafana, incident drill proves alerting
```

## Technology

| Area | Tools |
|---|---|
| Application | Node.js 20, Express 5, Joi validation, bcryptjs, jsonwebtoken, helmet, express-rate-limit, pino logging, prom-client |
| Tests | Jest 30 (unit + integration projects), Supertest, jest-junit, Istanbul coverage |
| Code quality | ESLint 10 (complexity/depth/params rules), SonarQube LTS Community + custom quality gate |
| Security | npm audit + custom gate script, Trivy (filesystem, secrets, Dockerfile misconfig, container image) |
| Build / deploy | Docker multi-stage image (non-root, healthcheck), Docker Compose, private Docker registry |
| Release | Immutable image promotion, semantic version tags, Git tags, generated release notes, automatic rollback |
| Monitoring | Prometheus, Alertmanager, Grafana (provisioned dashboard), webhook alert receiver, optional email |
| CI/CD | Jenkins LTS (declarative pipeline), Pipeline Stage View, JUnit, Coverage, SonarQube Scanner, Email Extension |

## API

| Method | Path | Notes |
|---|---|---|
| GET | `/health`, `/ready`, `/metrics` | liveness, readiness, Prometheus metrics |
| POST | `/api/v1/auth/register`, `/api/v1/auth/login` | returns a JWT |
| GET/POST | `/api/v1/transactions` | list (filter `month`, `category`, `type`) / create |
| GET/PATCH/DELETE | `/api/v1/transactions/:id` | owner only |
| PUT/GET | `/api/v1/reports/budgets` | monthly limit per category |
| GET | `/api/v1/reports/summary?month=YYYY-MM` | totals, savings rate, budget status |
| GET/POST | `/chaos` | incident simulation (needs `CHAOS_ENABLED=true` and `X-Chaos-Token`) |

## Run the app locally (no Docker)

```bash
npm ci
npm test          # 44 tests, coverage report in coverage/
npm start         # http://localhost:3000/health
```

## Set up the pipeline

Prerequisites: Docker Desktop (with WSL2 on Windows), Git, about 8 GB RAM free.

1. **Clone**
   ```bash
   git clone https://github.com/<your-user>/fintrack-devops.git
   cd fintrack-devops
   ```
2. **Start the DevOps lab** (Jenkins, SonarQube, registry and the shared `devops-net` network)
   ```bash
   docker compose -f jenkins/docker-compose.yml up -d --build
   ```
3. **Unlock Jenkins** at http://localhost:8080
   ```bash
   docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
   ```
   Choose *Install suggested plugins* (the required plugins are already baked in) and create your admin user.
4. **SonarQube** at http://localhost:9000 (admin/admin, then change the password)
   - *My Account → Security*: generate a **Global Analysis Token**.
   - *Quality Gates → Create* `FinTrack Gate` with conditions on **New Code**: Coverage < 80% fails, Duplicated Lines > 3% fails, Maintainability Rating worse than A fails, Reliability Rating worse than A fails, Security Hotspots Reviewed < 100% fails. Set it as **Default**.
   - *Administration → Configuration → Webhooks → Create*: `http://jenkins:8080/sonarqube-webhook/`
5. **Jenkins configuration**
   - *Manage Jenkins → Credentials → (global) → Add*:
     - Secret text `fintrack-jwt-secret` (any long random string)
     - Secret text `fintrack-chaos-token` (any random string)
     - Secret text `sonar-token` (the SonarQube token)
     - Username/password `github-creds` (GitHub user + personal access token with `repo` scope, used to push release tags)
   - *Manage Jenkins → System → SonarQube servers*: name `SonarQube`, URL `http://sonarqube:9000`, token `sonar-token`.
   - *Manage Jenkins → Tools → SonarQube Scanner installations*: name `SonarScanner`, *Install automatically*.
   - *Manage Jenkins → System → Extended E-mail Notification*: SMTP `smtp.gmail.com`, port 465, SSL, Gmail app password (optional).
6. **Create the job**: *New Item → Pipeline* `fintrack-pipeline` → *Pipeline script from SCM* → Git → repo URL → branch `*/main` → script path `Jenkinsfile` → Save → **Build with Parameters**.

The first build takes longer (SonarQube scanner download, Trivy vulnerability database, base images).

## Where to look after a green build

| What | URL |
|---|---|
| Jenkins stage view, test results, coverage trend | http://localhost:8080/job/fintrack-pipeline/ |
| SonarQube project and quality gate history | http://localhost:9000/dashboard?id=fintrack-api |
| Staging | http://localhost:3001/health |
| Production | http://localhost:3000/health |
| Prometheus targets / alerts | http://localhost:9090/targets, http://localhost:9090/alerts |
| Alertmanager | http://localhost:9093 |
| Grafana dashboard *FinTrack – Production* | http://localhost:3030 (admin/admin) |
| Alerts received by on-call webhook | http://localhost:5001/alerts (`docker logs alert-logger`) |
| Registry tags | http://localhost:5000/v2/fintrack-api/tags/list |

## Security finding that the pipeline caught

The first commit used `jsonwebtoken@8.5.1`. The Security stage failed on one HIGH-severity package (advisories GHSA-8cf7-32gw-wr33, GHSA-hjrf-2m68-5959, GHSA-qwph-4952-7xr6: legacy key types, RSA→HMAC confusion, insecure default algorithm in `jwt.verify`). Commit 2 upgrades to 9.0.3, pins `HS256` on sign and verify, and adds a regression test that rejects `alg: none` tokens. To replay it, build commit `0150a75` and then the latest commit.

## Rollback

`scripts/deploy.sh` records the last good tag per environment. If the readiness check or smoke test fails, it redeploys the previous tag automatically and fails the stage. To test it manually: `bash scripts/deploy.sh staging does-not-exist`.

## Troubleshooting

- `permission denied /var/run/docker.sock`: the lab runs Jenkins as root on purpose; recreate the container with `docker compose -f jenkins/docker-compose.yml up -d --force-recreate`.
- SonarQube exits on Linux: `sudo sysctl -w vm.max_map_count=262144`.
- Port already in use: change the left side of the `ports:` mapping in the compose file.
- `waitForQualityGate` hangs: check the SonarQube webhook URL in step 4.
