#!/bin/bash
# Stop immediately if any command fails
set -e

echo "=================================================="
echo "Setting up AI Multilingual Transcription Studio..."
echo "=================================================="

# Check for python3
if ! command -v python3 &> /dev/null; then
    echo "Error: python3 is not installed. Please install it first."
    exit 1
fi

# Check for npm
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed. Please install Node.js and npm first."
    exit 1
fi

# 1. Setup Backend
echo ""
echo "--> Configuring Python virtual environment and dependencies..."
cd backend
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
cd ..

# 2. Setup Frontend
echo ""
echo "--> Installing frontend Node.js packages..."
cd frontend
npm install
cd ..

echo ""
echo "=================================================="
echo "Setup complete! You can now start the services."
echo "=================================================="
