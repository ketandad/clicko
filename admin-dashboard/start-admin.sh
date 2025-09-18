#!/bin/bash

cd /workspaces/clicko/admin-dashboard

echo "Installing dependencies with --force flag to resolve version conflicts"
npm install --force

echo "Starting the admin dashboard application"
npm start