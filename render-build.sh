#!/bin/bash
# Render.com build script

echo "Installing dependencies..."
cd backend
npm ci --only=production

echo "Build complete!"
