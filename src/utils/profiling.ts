export class Profiling {
    public static getCurrentTime(): string {
        const currentTime = new Date();
        const hours = currentTime.getHours();
        const minutes = currentTime.getMinutes();

        // Format the hours and minutes as HH:MM
        const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        return formattedTime;
    }

    public static async measureMilliseconds(asyncFn: () => Promise<void>): Promise<number> {
        const startTime = performance.now();
        await asyncFn();
        const endTime = performance.now();
        return endTime - startTime;
    }
}
