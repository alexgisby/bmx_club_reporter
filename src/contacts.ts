import * as fs from 'fs';
import { parse } from "csv-parse";
import { stringify } from "csv-stringify/sync";
import * as path from "path";

const isExpired = (date: string): boolean => new Date(date).getTime() < Date.now();
const expiredInYear = (date: string, reportingYear: number): boolean =>
    isExpired(date) && new Date(date).getFullYear() === reportingYear;

const ucFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type TidyHQRecord = [
    /* name */ string,
    /* memberNo */ string,
    /* email */ string,
    /* phone */ string,
    /* d-o-b */ string,
    /* first-aid-expiry */ string,
    /* first-aid-cert */ string,
    /* hold-accred */ string,
    /* coaching-level */ string,
    /* coaching-expiry */ string,
    /* official-level */ string,
    /* official-expiry */ string,
    /* memberLevel */ string,
    /* status */ string,
];
type TidyHQCsvRecords = Array<TidyHQRecord>;

interface Membership {
    name: string,
    status: string,
}

export interface Contact {
    name: string,
    memberNo: string,
    active: boolean;
    dateOfBirth: string | null;
    race: string | boolean,
    volunteer: string | boolean,
    firstAid?: {
        expires: string;
        expired: boolean;
    };
    official?: {
        type: string;
        expiry: string;
        expired: boolean;
    };
    coach?: {
        type: string;
        expiry: string;
        expired: boolean;
    };
    memberLevels: Array<Membership>
}

export type ContactMap = Map<String, Contact>; // memberNo => Contact.

export function parseCsv(filename: string): Promise<ContactMap> {
    if (!fs.existsSync(filename)) {
        throw Error(`${filename} not found, cannot parse contacts`);
    }

    return new Promise<any>((res, rej) => {
        parse(fs.readFileSync(filename), (err, records) => {
            if (err) {
                return rej(err);
            }
            res(records as TidyHQCsvRecords);
        });
    }).then((records: TidyHQCsvRecords) => {
        const map: ContactMap = new Map<String, Contact>();

        records.forEach((record) => {
            const [name, memberNo, email, phone, dob, firstAidExpiry, firstAidCert, accred, coachingLevel, coachingExpiry, officialLevel, officialExpiry, memberLevel, status] = record;
            const contact: Contact = map.has(memberNo) ? map.get(memberNo)! : {
                name,
                memberNo,
                dateOfBirth: dob,
                active: false,
                race: false,
                volunteer: false,
                memberLevels: [],
            };

            if (status === 'Active') {
                if (!memberLevel.match(/Add-On/i) && !memberLevel.match(/^CA/) && !memberLevel.match(/Non-Riding/)) {
                    contact.race = memberLevel;
                }

                if (memberLevel.match(/Non-Riding/)) {
                    contact.volunteer = memberLevel;
                }

                contact.active = true;
            }

            // First aid:
            if (firstAidExpiry !== "" && (!contact.firstAid || contact.firstAid?.expired)) {
                contact.firstAid = {
                    expires: firstAidExpiry,
                    expired: isExpired(firstAidExpiry)
                }
            }

            // Coaching:
            if (coachingLevel !== "" && (!contact.coach || contact.coach?.expired)) {
                contact.coach = {
                    type: coachingLevel,
                    expiry: coachingExpiry,
                    expired: isExpired(coachingExpiry)
                }
            }

            // Official:
            if (officialLevel !== "" && (!contact.official || contact.official?.expired)) {
                contact.official = {
                    type: officialLevel,
                    expiry: officialExpiry,
                    expired: isExpired(officialExpiry)
                };
            }


            contact.memberLevels.push({
                name: memberLevel,
                status
            });

            map.set(memberNo, contact);
        });

        return map;
    });
}

export interface ContactTotals {
    totalActive: number;
    totalExpired: number;
    totalRiding: number;
    totalVolunteers: number;
    totalRidingVolunteers: number;
    totalFirstAid: number;
    totalExpiredFirstAid: number;
    totalCoaches: number;
    totalExpiredCoaches: number;
    totalOfficials: number;
    totalOfficialsExpired: number;
}

export function getTotals(contacts: ContactMap, reportingYear: number): ContactTotals {
    const res: ContactTotals = {
        totalActive: 0,
        totalExpired: 0,
        totalRiding: 0,
        totalVolunteers: 0,
        totalRidingVolunteers: 0,
        totalFirstAid: 0,
        totalExpiredFirstAid: 0,
        totalCoaches: 0,
        totalExpiredCoaches: 0,
        totalOfficials: 0,
        totalOfficialsExpired: 0,
    };

    for (const [, contact] of contacts) {
        if (contact.race || contact.volunteer) {
            res.totalActive ++;
        } else {
            res.totalExpired ++;
        }

        if (contact.race && contact.volunteer) {
            res.totalRidingVolunteers ++;
        } else if (contact.race) {
            res.totalRiding ++;
        } else if (contact.volunteer) {
            res.totalVolunteers ++;
        }

        if (contact.firstAid) {
            !contact.active || expiredInYear(contact.firstAid.expires, reportingYear) ? res.totalExpiredFirstAid ++ : res.totalFirstAid ++;
        }

        if (contact.coach) {
            !contact.active || expiredInYear(contact.coach.expiry, reportingYear) ? res.totalExpiredCoaches ++ : res.totalCoaches ++;
        }

        if (contact.official) {
            !contact.active || expiredInYear(contact.official.expiry, reportingYear) ? res.totalOfficialsExpired ++ : res.totalOfficials ++;
        }
    }

    return res;
}

export interface MemberLevelBreakdown {
    [levelName: string]: number;
}

export function getMemberLevelBreakdown(contacts: ContactMap): MemberLevelBreakdown {
    const res: MemberLevelBreakdown = {};
    for (const [, contact] of contacts) {
        contact.memberLevels.map(({ name, status}) => {
            if (status === 'Active') {
                if (!res[name]) {
                    res[name] = 0;
                }
                res[name] ++;
            }
        });
    }
    return res;
}

export function getSprocketGraduates(contacts: ContactMap, reportingYear: number): Array<Contact> {
    const birthYear = reportingYear + 1 - 8;
    const sprockets: Array<Contact> = [];
    for (const [, contact] of contacts) {
        if (contact.dateOfBirth && contact.active) {
            const dobActual = new Date(contact.dateOfBirth);
            if (dobActual.getFullYear() === birthYear) {
                sprockets.push(contact);
            }
        }
    }
    return sprockets;
}

interface CurrentExpired<T> {
    current: Array<T>;
    expired: Array<T>;
}

interface FirstAider {
    name: string;
    expiry: string;
    licensed: string;
}

type Transformer<T> = (contact: Contact) => T;

function buildCurrentExpiredList<T>(
    contacts: ContactMap,
    checkKey: 'firstAid' | 'official' | 'coach',
    transformer: Transformer<T>
): CurrentExpired<T> {
    const res: CurrentExpired<T> = {
        current: [],
        expired: []
    };
    for (const [, contact] of contacts) {
        if (contact[checkKey]) {
            const item = transformer(contact);
            if (!contact.active || contact[checkKey]?.expired) {
                res.expired.push(item);
            } else {
                res.current.push(item);
            }
        }
    }
    return res;
}

export const getClubFirstAiders = (contacts: ContactMap) => buildCurrentExpiredList<FirstAider>(
    contacts,
    'firstAid',
    contact => ({
        name: contact.name,
        expiry: contact.firstAid?.expires ?? '',
        licensed: contact.active ? 'Yes' : 'No'
    })
);

interface Coach {
    name: string;
    type: string;
    expiry: string;
    licensed: string;
}

export const getClubCoaches = (contacts: ContactMap) => buildCurrentExpiredList<Coach>(
    contacts,
    'coach',
    contact => ({
        name: contact.name,
        type: contact.coach?.type ?? '',
        expiry: contact.coach?.expiry ?? '',
        licensed: contact.active ? 'Yes' : 'No'
    })
);

interface Official {
    name: string;
    type: string;
    expiry: string;
    licensed: string;
}

export const getClubOfficials = (contacts: ContactMap) => buildCurrentExpiredList<Official>(
    contacts,
    'official',
    contact => ({
        name: contact.name,
        type: contact.official?.type ?? '',
        expiry: contact.official?.expiry ?? '',
        licensed: contact.active ? 'Yes' : 'No'
    })
);


export function writeContactTotals(outputDir: string, totals: ContactTotals) {
    const outputFilename = path.join(outputDir, 'member-totals.csv');
    const output = stringify([
        ['Type', 'Total'],
        ['Active Members (Race + Volunteer)', totals.totalActive],
        ['Expired Members', totals.totalExpired],
        ['Active Riding Members', totals.totalRiding],
        ['Active Volunteer Members', totals.totalVolunteers],
        ['Active Riding + Volunteer Members', totals.totalRidingVolunteers],
        ['First Aiders', totals.totalFirstAid],
        [`First Aiders Expired`, totals.totalExpiredFirstAid],
        ['Coaches', totals.totalCoaches],
        [`Coaches Expired`, totals.totalExpiredCoaches],
        ['Officials', totals.totalOfficials],
        [`Officials Expired`, totals.totalOfficialsExpired],
    ], { delimiter: ',' });
    fs.writeFileSync(outputFilename, output);
}

export function writeMemberLevelBreakdown(outputDir: string, breakdown: MemberLevelBreakdown) {
    const outputFilename = path.join(outputDir, 'membership-breakdown.csv');
    const output = stringify([
        ['Membership Type', 'Count'],
        ...Object.keys(breakdown).map(name => [
            name, breakdown[name]
        ])
    ], { delimiter: ',' });
    fs.writeFileSync(outputFilename, output);
}

export function writeSprocketGraduates(outputPath: string, sprockets: Array<Contact>) {
    const outputFilename = path.join(outputPath, 'grad-sprockets.csv');
    const output = stringify([
        ['Name', 'DoB'],
        ...sprockets.map(c => [c.name, c.dateOfBirth])
    ], { delimiter: ',' });
    fs.writeFileSync(outputFilename, output);
}

export function writeCurrentExpired<T>(outputPath: string, items: CurrentExpired<T>, prefix: string) {
    const keys: Array<keyof CurrentExpired<T>> = ['current', 'expired'];
    keys.forEach(k => {
        if (items[k].length > 0) {
            const outputFilename = path.join(outputPath, `${prefix}-${k}.csv`);
            const output = stringify([
                // Headers from the object keys:
                [...Object.keys(items[k][0]).map(kk => ucFirst(kk))],

                // Contents by just getting the values:
                ...items[k].map(item => Object.values(item))
            ], { delimiter: ',' });
            fs.writeFileSync(outputFilename, output);
        }
    });
}
