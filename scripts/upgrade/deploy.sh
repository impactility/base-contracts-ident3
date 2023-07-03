#!/bin/bash

#get params from input file
commit=$(jq .$1.commit scripts/upgrade/input-params.json | sed 's/"//g') 
deployScript=$(jq .$1.deployScript scripts/upgrade/input-params.json | sed 's/"//g')
abiPath=$(jq .$1.abiPath scripts/upgrade/input-params.json | sed 's/"//g')
outputContractName=$(jq .$1.outputContractName scripts/upgrade/input-params.json | sed 's/"//g')
echo 'abi ' $abiPath
return 0
#store current branch
currBranch=$(git rev-parse --abbrev-ref HEAD)

#checkout to prev commit & compile and deploy StateV2 contract
git checkout $commit
npx hardhat compile
npx hardhat run --network localhost $deployScript

#store abi to file & deployed contract address
abi=$(jq .abi artifacts/contracts/$abiPath)
echo $abi > scripts/upgrade/state/abi-$commit.json
contract_addr=$(jq .$outputContractName scripts/deploy_output.json)

#move back to branch & prepare and run upgrade unit test
git checkout $currBranch
npx hardhat compile
cp test/upgrade/state-upgrade-template.ts test/upgrade/state-upgrade-$commit.ts
sed -i '' "s/.skip//gi" test/upgrade/state-upgrade-$commit.ts  
sed -i '' "s/{commit_hash}/$commit/gi" test/upgrade/state-upgrade-$commit.ts
sed -i '' "s/'contract_address_placeholder'/$contract_addr/gi" test/upgrade/state-upgrade-$commit.ts
npx hardhat test test/upgrade/state-upgrade-$commit.ts --network localhost
sed -i '' "s/{commit_hash}/$commit/gi" scripts/upgrade/state/state-upgrade.ts 