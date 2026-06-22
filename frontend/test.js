const formatEther = (wei) => (Number(wei) / 1e18).toString();

const testPrices = (vipPriceRaw, basePrice) => {
  const vipPrice = vipPriceRaw ? parseFloat(formatEther(vipPriceRaw)) : basePrice * 2.0;
  console.log({ vipPriceRaw, basePrice, vipPrice });
}

testPrices(0n, 10);
testPrices("0", 10);
testPrices(undefined, 10);
testPrices({ value: "0" }, 10);
