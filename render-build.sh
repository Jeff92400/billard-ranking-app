#!/bin/bash
# Render.com build script

echo "Installing dependencies..."
cd backend
npm install --omit=dev

echo "Build complete!"
