import * as fs from 'fs';
import * as path from 'path';
import rimraf from 'rimraf';

import {
    getClubCoaches,
    getClubFirstAiders, getClubOfficials,
    getMemberLevelBreakdown,
    getTotals,
    parseCsv,
    writeContactTotals, writeCurrentExpired,
    writeMemberLevelBreakdown
} from "./contacts";
import {getClubEvents, writeEventBreakdown} from "./sqorz";

async function main() {
    const [, , contactsFilename, sqorzOrg, year] = process.argv;
    const reportingYear = parseInt(year, 10);

    console.log(`Generating report for: ${sqorzOrg} (${reportingYear})`);
    console.log(`  - Using ${contactsFilename}`);

    // --------------- Process Contacts -------------------

    const contacts = await parseCsv(contactsFilename);
    console.log(contacts.size, 'contacts found');

    console.log('------------------');

    const totals = getTotals(contacts, reportingYear);
    console.log('Membership breakdown:');
    console.log(totals);

    console.log('------------------');

    const levelBreakdown = getMemberLevelBreakdown(contacts);
    console.log('Membership Level breakdown:');
    console.log(levelBreakdown);

    // Grab some other useful stuff:
    const firstAiders = getClubFirstAiders(contacts);
    const coaches = getClubCoaches(contacts);
    const officials = getClubOfficials(contacts);

    console.log('------------------');

    console.log('Generating event information... This may take a moment...');
    const events = [] as any; // await getClubEvents(sqorzOrg, reportingYear);
    console.log(events.length, 'club events found.');

    console.log('------------------');

    const baseOutputPath = path.join(__dirname, '..', 'out');
    if (!fs.existsSync(baseOutputPath)) {
        fs.mkdirSync(baseOutputPath);
    }
    const outputPath = path.join(baseOutputPath, year);
    if (fs.existsSync(outputPath)) {
        await new Promise<void>(res => rimraf(outputPath, () => res()));
    }
    fs.mkdirSync(outputPath);

    console.log('Writing CSVs to the output dir: ', outputPath);
    writeContactTotals(outputPath, totals, reportingYear);
    writeCurrentExpired(outputPath, firstAiders, 'first-aid');
    writeCurrentExpired(outputPath, coaches, 'coaches');
    writeCurrentExpired(outputPath, officials, 'officials');
    writeMemberLevelBreakdown(outputPath, levelBreakdown);
    writeEventBreakdown(outputPath, events);

    // --------------- Grab series results ----------------

    console.log('-----------------');
    console.log('Done');
}

main().catch(console.error);
