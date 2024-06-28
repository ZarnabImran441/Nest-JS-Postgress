import {WidgetFilterDatePartOptions} from '../enum/widget-filter.enum';

export function getWidgetInterval(period: WidgetFilterDatePartOptions): string {
    let interval = '';

    switch (period) {
        case WidgetFilterDatePartOptions.DAY:
            interval = `1 ${WidgetFilterDatePartOptions.DAY.toUpperCase()}`;
            break;
        case WidgetFilterDatePartOptions.WEEK:
            interval = `1 ${WidgetFilterDatePartOptions.WEEK.toUpperCase()}`;
            break;
        case WidgetFilterDatePartOptions.MONTH:
            interval = `1 ${WidgetFilterDatePartOptions.MONTH.toUpperCase()}`;
            break;
        case WidgetFilterDatePartOptions.YEAR:
            interval = `1 ${WidgetFilterDatePartOptions.YEAR.toUpperCase()}`;
            break;
    }

    return interval;
}
