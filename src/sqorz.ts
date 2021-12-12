import axios from 'axios';
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

enum SeriesStatus {
    Unqualified = 1,
    SemiQualified = 2,
    Qualified = 3
}

interface SqorzSeriesClass {
    className: string;
    participationOnly: boolean;
    seriesRankCompetitors: Array<{
        lastName: string;
        firstName: string;
        seriesQualificationStatus: SeriesStatus;
        seriesRank: number;
    }>;
}

interface SqorzSeriesResult {
    seriesId: string;
    seriesDescription: {
        seriesName: string;
    };
    seriesRankClasses: Array<SqorzSeriesClass>;
}

export interface SeriesResult {
    id: string;
    name: string;
    classes: Array<SeriesClassResult>;
}

export interface SeriesClassResult {
    className: string;
    qualifiedRiders: Array<{
        lastName: string;
        firstName: string;
        rank: number;
    }>;
}

export async function getSeriesLeaders(seriesId: string): Promise<SeriesResult> {
    const resp = await sqorzClient.get<SqorzSeriesResult>(`/series/${seriesId}`);
    return {
        id: seriesId,
        name: resp.data.seriesDescription.seriesName,
        classes: resp.data.seriesRankClasses.map(classResult => ({
            className: classResult.className,
            qualifiedRiders: classResult.seriesRankCompetitors
                .filter(rider =>
                    rider.seriesQualificationStatus === SeriesStatus.Qualified
                    && (classResult.participationOnly || rider.seriesRank <= 8)
                )
                .sort((a, b) => a.seriesRank - b.seriesRank)
                .map((rider, i) => ({
                    lastName: rider.lastName,
                    firstName: rider.firstName,
                    rank: classResult.participationOnly ? rider.seriesRank : i + 1
                }))

        }))
    };
}

export function writeSeriesBreakdown(outputDir: string, series: SeriesResult) {
    const outputFilename = path.join(outputDir, `series-${series.id}.csv`);
    const output = stringify([
        ['Class', 'First Name', 'Last Name', 'Rank'],
        ...series.classes.flatMap(c => c.qualifiedRiders.map(rider => {
            return [c.className, rider.firstName, rider.lastName, rider.rank];
        }))
    ], { delimiter: ',' });
    fs.writeFileSync(outputFilename, output);
}

