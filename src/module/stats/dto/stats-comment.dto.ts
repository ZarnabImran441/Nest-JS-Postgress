export class CommentsCountDto {
    comments: number;
    assigneeId: string;
    assigneeName: string;
    month?: number;
}

export class StatsCommentsCountDto {
    month: number;
    data: Array<CommentsCountDto>;
}
