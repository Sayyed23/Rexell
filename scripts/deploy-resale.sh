#!/bin/bash

# Resale System Deployment Script
# This script helps deploy the updated Rexell contract with resale verification system

echo "========================================="
echo "Rexell Resale System Deployment"
echo "========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "contracts/Rexell.sol" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

echo "📋 Pre-deployment Checklist:"
echo "  ✓ Smart contract updated with organizer authorization"
echo "  ✓ Helper functions added (getEventOrganizerForToken, etc.)"
echo "  ✓ Frontend components updated"
echo "  ✓ Market and owner dashboard pages updated"
echo ""

# Step 1: Compile contracts
echo "Step 1: Compiling contracts..."
npx hardhat compile

if [ $? -ne 0 ]; then
    echo "❌ Compilation failed. Please fix errors and try again."
    exit 1
fi

echo "✅ Compilation successful"
echo ""

# Step 2: Deploy to testnet
echo "Step 2: Deploying to Celo Sepolia testnet..."
echo "⚠️  Make sure you have:"
echo "  - CELO tokens in your deployer wallet for gas"
echo "  - Private key set in .env file"
echo ""
read -p "Press Enter to continue with deployment, or Ctrl+C to cancel..."

# Deploy the contract
npx hardhat run scripts/deploy.ts --network Sepolia

if [ $? -ne 0 ]; then
    echo "❌ Deployment failed. Please check your configuration and try again."
    exit 1
fi

echo ""
echo "✅ Deployment successful!"
echo ""

# Step 3: Update frontend
echo "Step 3: Updating frontend configuration..."
echo "⚠️  IMPORTANT: You need to manually update the contract address in:"
echo "  - /app/frontend/blockchain/abi/rexell-abi.ts"
echo "  - Change: export const contractAddress = \"YOUR_NEW_ADDRESS\";"
echo ""
read -p "Press Enter after you've updated the contract address..."

# Step 4: Install dependencies if needed
echo "Step 4: Checking frontend dependencies..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi
cd ..

echo ""
echo "========================================="
echo "✅ Deployment Complete!"
echo "========================================="
echo ""

echo "📝 Next Steps:"
echo "  1. Test resale request flow:"
echo "     - Buy a ticket"
echo "     - Request resale verification"
echo "     - Check status updates"
echo ""

echo "  2. Test organizer dashboard:"
echo "     - Visit /owner/resale-requests as event organizer"
echo "     - Approve/reject resale requests"
echo ""

echo "  3. Test market purchase:"
echo "     - Visit /market page"
echo "     - Purchase an approved resale ticket"
echo "     - Verify cUSD payment and ownership transfer"
echo ""

echo "  4. Verify events on blockchain explorer:"
echo "     - https://Sepolia.celoscan.io/"
echo ""

echo "📖 For detailed documentation, see:"
echo "  - /app/RESALE_IMPLEMENTATION.md"
echo "  - /app/RESALE_ROYALTY_HISTORY.md"
echo ""

echo "🎉 Happy reselling!"