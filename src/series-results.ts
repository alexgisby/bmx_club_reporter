import path from "path";
import fs from "fs";

import {getSeriesLeaders, writeSeriesBreakdown} from "./sqorz";

async function main() {
    const [, , seriesId] = process.argv;

    console.log(`Loading series results for ${seriesId}`);

    const results = await getSeriesLeaders(seriesId);
    console.log('  > Found series: ', results.name, 'with', results.classes.length, 'classes');

    const outputPath = path.join(__dirname, '..', 'out');
    if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath);
    }
    await writeSeriesBreakdown(outputPath, results);

    console.log('Done');
}

main().catch(console.error);
