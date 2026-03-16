#!/bin/bash
set -e

echo "=========================================="
echo "   Evo AI Platform — Environment Setup"
echo "=========================================="

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

step() { echo -e "\n${GREEN}[✓] $1${NC}"; }
warn() { echo -e "${YELLOW}[!] $1${NC}"; }

# ── Prerequisites ──
echo ""
echo "Checking prerequisites..."
command -v node >/dev/null 2>&1 || { echo "Node.js 20+ required"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "Python 3.11+ required"; exit 1; }
command -v docker >/dev/null 2>&1 || warn "Docker not found — needed for infrastructure"
step "Prerequisites OK"

# ── Infrastructure (Docker) ──
if command -v docker >/dev/null 2>&1; then
    echo ""
    echo "Starting infrastructure..."
    cd "$(dirname "$0")/../docker"
    docker compose up -d mongodb redis qdrant ollama
    step "Infrastructure running"
    cd ..
fi

# ── Pull Ollama models ──
if command -v docker >/dev/null 2>&1; then
    echo ""
    echo "Pulling Ollama models (this takes a while)..."
    docker exec evo_ollama ollama pull llama3 || warn "Could not pull llama3"
    docker exec evo_ollama ollama pull nomic-embed-text || warn "Could not pull nomic-embed-text"
    docker exec evo_ollama ollama pull llava || warn "Could not pull llava"
    step "Models pulled"
fi

# ── Server (Express) ──
echo ""
echo "Setting up Express server..."
cd server
[ ! -f .env ] && cp .env.example .env && step "Created server .env"
npm install
step "Server dependencies installed"
cd ..

# ── AI Service (Python) ──
echo ""
echo "Setting up Python AI service..."
cd ai-service
[ ! -f .env ] && cp .env.example .env && step "Created ai-service .env"
python3 -m venv .venv
source .venv/bin/activate 2>/dev/null || source .venv/Scripts/activate
pip install -e ".[dev]"
step "AI service dependencies installed"
cd ..

# ── Client (React) ──
echo ""
echo "Setting up React client..."
cd client
[ ! -f .env ] && cp .env.example .env && step "Created client .env"
npm install
step "Client dependencies installed"
cd ..

# ── Done ──
echo ""
echo "=========================================="
echo "   Evo AI Platform — Setup Complete!"
echo "=========================================="
echo ""
echo "  Start server:      cd server && npm run dev"
echo "  Start AI service:  cd ai-service && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000"
echo "  Start client:      cd client && npm run dev"
echo ""
echo "  Client:    http://localhost:3000"
echo "  Server:    http://localhost:5000"
echo "  AI API:    http://localhost:8000"
echo "  API docs:  http://localhost:8000/docs"
echo ""
