# Deploying Carina on AWS EC2

This is the simplest AWS path. No ECS, no Fargate, no complex managed services.
The Docker Compose stacks run identically to the Contabo VPS. Moving to AWS costs
more per month but gives better uptime SLAs and the ability to snapshot and restore.

## Recommended EC2 spec

| Config | Minimum | Recommended |
|--------|---------|-------------|
| Instance type | t3.medium (2 vCPU, 4 GB) | t3.large (2 vCPU, 8 GB) |
| OS | Ubuntu 24.04 LTS (AMI: search "ubuntu-noble-24.04-amd64") | same |
| Storage | 30 GB gp3 | 60 GB gp3 |
| Region | eu-west-1 (Ireland - close to UK) | same |

## Security Group rules

| Port | Source | Purpose |
|------|--------|---------|
| 22 | Your IP only | SSH admin access |
| 80 | 0.0.0.0/0 | HTTP (nginx redirects to HTTPS) |
| 443 | 0.0.0.0/0 | HTTPS (Docker nginx) |

Do NOT open Docker daemon port (2375/2376) to the internet.

## Setup procedure

1. Launch EC2 instance (Ubuntu 24.04 LTS AMI, t3.large, 60 GB gp3)
2. Allocate an Elastic IP and associate it with the instance
3. Update DNS: point carinaai.uk and labyrinthscout.com wildcards to the Elastic IP
4. SSH in: `ssh -i your-key.pem ubuntu@<ELASTIC_IP>`
5. Change the default user if desired: `adduser malike; usermod -aG sudo malike`
6. Run the bootstrap script: `sudo APPS_DIR=/home/malike/apps APPS_USER=malike bash scripts/bootstrap-server.sh`
7. Issue certs, copy .env files, run deploy (same as VPS; see bootstrap output)

## Data persistence

Postgres data: Docker named volume `pgdata` (on EC2 instance storage).

Before decommissioning an instance, back up volumes:

```bash
docker run --rm -v corecarinaaiuk_pgdata:/data -v /backup:/backup alpine \
  tar czf /backup/pgdata-$(date +%Y%m%d).tar.gz -C /data .
```

Restore on new instance:

```bash
docker run --rm -v corecarinaaiuk_pgdata:/data -v /backup:/backup alpine \
  tar xzf /backup/pgdata-20260101.tar.gz -C /data
```

## Cost estimate (eu-west-1, June 2026)

| Item | Monthly |
|------|---------|
| t3.large (reserved 1yr) | ~$50 |
| 60 GB gp3 EBS | ~$5 |
| Elastic IP (attached) | free |
| Data transfer (10 GB/mo) | ~$1 |
| Total | ~$56/mo |

Contabo VPS comparison: ~$14/mo for similar specs. AWS costs more but has:
- Better uptime SLAs (99.99%)
- Snapshot-based AMI backups (instant server restore)
- VPC network isolation
- Native CloudWatch monitoring
- Easy vertical scaling (resize instance type)

## Optional: ECS Fargate (advanced)

Only consider ECS Fargate if you need:
- Auto-scaling based on CPU/memory
- Zero-downtime blue/green deploys
- Native AWS managed container scheduling

ECS requires:
- ECR (Elastic Container Registry) to push images
- ECS task definitions (replaces docker-compose.prod.yml)
- ALB (Application Load Balancer) to replace Dockerised nginx and handle SSL via ACM
- RDS PostgreSQL and ElastiCache Redis to replace containerised databases
- Estimated cost: $150-300/mo (ALB ~$20, RDS ~$80, Fargate ~$60, ElastiCache ~$40)

Verdict: ECS is overkill until you have enough traffic to need auto-scaling.
EC2 + Docker Compose handles 10,000 monthly active users comfortably on a t3.large.
