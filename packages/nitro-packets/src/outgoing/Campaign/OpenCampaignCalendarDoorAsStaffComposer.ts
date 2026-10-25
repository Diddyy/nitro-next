// From the AS3 `OpenCampaignCalendarDoorAsStaffComposer`: the campaign's name, then the door's day index.
import { IOutgoingPacket } from '@nitrodevco/nitro-api';

export type OpenCampaignCalendarDoorAsStaffComposerType = {
    campaignName: string;
    dayIndex: number;
};

export class OpenCampaignCalendarDoorAsStaffComposer implements IOutgoingPacket<OpenCampaignCalendarDoorAsStaffComposerType> {
    public constructor(private params: OpenCampaignCalendarDoorAsStaffComposerType) { }

    public compose(): (number | string | boolean)[] {
        return [
            this.params.campaignName,
            this.params.dayIndex,
        ];
    }
}
