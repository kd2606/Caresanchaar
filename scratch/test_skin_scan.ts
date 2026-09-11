import { analyzeSkinScan } from "../src/ai/flows/skin-scan";

async function main() {
  const dummyBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAUA"; // placeholder image data
  const result = await analyzeSkinScan({
    imageBase64: dummyBase64,
    itchingLevel: "moderate",
    spreadRate: "slow",
    recentChanges: "none",
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => console.error(e));
