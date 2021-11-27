import axios, { Axios } from 'axios';
import path from "path";
import {stringify} from "csv-stringify/sync";
import fs from "fs";

const sqorzClient = axios.create({
    baseURL: 'https://our.sqorz.com/json',
    headers: {
        'Accept': 'application/json',
        'User-Agent': 'https://github.com/alexgisby/bmx_club_reporter/1.0.0'
    }
});

interface SqorzClubEventsResponse {
    events: Array<{
        eventName: string,
        eventDate: string,
        entered: number;
        registered: number;
        peopleCount: { entered: number; registered: number; };
        completeRaces: number;
        enabledClasses: number;
    }>;
}

export interface ClubEvent {
    name: string,
    date: string,
    entries: number;
    registered: number;
    people: number;
    peopleRegistered: number;
    classesCount: number;
    completeRaces: number;
}

export async function getClubEvents(org: string, reportingYear: number): Promise<Array<ClubEvent>> {
    const resp = await sqorzClient.get<SqorzClubEventsResponse>(`/org/${org}`);
    return resp.data.events
        .filter(e => new Date(e.eventDate).getFullYear() === reportingYear)
        .map((e) => ({
            name: e.eventName,
            date: e.eventDate,
            entries: e.entered,
            registered: e.registered,
            people: e.peopleCount.entered,
            peopleRegistered: e.peopleCount.registered,
            completeRaces: e.completeRaces,
            classesCount: e.enabledClasses
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
}

export function writeEventBreakdown(outputDir: string, events: Array<ClubEvent>) {
    const outputFilename = path.join(outputDir, 'event-breakdown.csv');
    const output = stringify([
        ['Name', 'Date', 'Total Entries', 'Total Classes', 'Total Races'],
        ...events.map(e => [
            e.name, e.date, e.entries, e.classesCount, e.completeRaces
        ])
    ], { delimiter: ',' });
    fs.writeFileSync(outputFilename, output);
}
