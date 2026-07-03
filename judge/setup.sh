#!/usr/bin/env bash
# nc-judge one-shot VM setup — Ubuntu 24.04 arm64 (Oracle A1.Flex Always Free).
# Run as the default `ubuntu` user from inside judge/:  bash setup.sh
set -euo pipefail

echo "==> Installing Docker (official convenience script)"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
fi

echo "==> Opening ports 80/443 in the host firewall"
# Oracle Ubuntu images ship restrictive iptables rules (REJECT all but 22).
# NOTE: you must ALSO add 80+443 ingress rules in the OCI subnet Security List.
sudo iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null ||
  sudo iptables -I INPUT 5 -p tcp --dport 80 -j ACCEPT
sudo iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null ||
  sudo iptables -I INPUT 5 -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save 2>/dev/null || true

echo "==> Pre-pulling sandbox images (~3GB, one-time)"
sudo docker pull gcc:14
sudo docker pull eclipse-temurin:21
sudo docker pull python:3.12-slim

echo "==> Creating sandbox work directory"
sudo mkdir -p /srv/nc-judge/work
sudo chmod 777 /srv/nc-judge/work

if [ ! -f .env ]; then
  echo "==> Generating .env"
  ip="$(curl -fsS https://api.ipify.org)"
  {
    echo "JUDGE_SECRET=$(openssl rand -hex 32)"
    echo "JUDGE_DOMAIN=${ip//./-}.sslip.io"
  } > .env
fi

echo "==> Building and starting nc-judge + Caddy"
sudo docker compose up -d --build

echo
echo "Done. Values for the Next app (Vercel env):"
# shellcheck disable=SC1091
source .env
echo "  JUDGE_URL=https://${JUDGE_DOMAIN}"
echo "  JUDGE_SECRET=${JUDGE_SECRET}"
echo
echo "Smoke test:  curl https://${JUDGE_DOMAIN}/healthz"
