#!/bin/bash
# Render.com build script

echo "Installing dependencies..."
cd backend
npm install

echo "Creating database directory..."
mkdir -p ../database

echo "Build complete!"
