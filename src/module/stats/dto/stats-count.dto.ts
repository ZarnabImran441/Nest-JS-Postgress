export class StatsCountDto {
    currentMonth: number;
    prevMonth: number;
    pastMonths: number;
    title: 'New folders' | 'New Tasks' | 'Completed Tasks' | 'Attachments' | 'Comments' | 'Approvals';
}
