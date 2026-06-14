import json
import os

json_path = r"d:\Rexell\artifacts\contracts\Rexell.sol\Rexell.json"
ts_path = r"d:\Rexell\frontend\blockchain\abi\rexell-abi.ts"
# Getting current address from file or using the known one
address = "0xc6Be85Cf311613D3Db8A4FBECa30A13AD2308F1E"

if not os.path.exists(json_path):
    print(f"Error: {json_path} does not exist")
    exit(1)

with open(json_path, 'r') as f:
    data = json.load(f)
    abi = data['abi']

print(f"Read ABI with {len(abi)} entries")

content = f"""export const contractAddress = "{address}";
export const rexellAbi = {json.dumps(abi, indent=2)};
"""

with open(ts_path, 'w') as f:
    f.write(content)

print("Updated rexell-abi.ts")
