/**
 * The help window - `TopicsFlowHelpController` over `habbo-help-com/topics_flow_help_xml`, built as a
 * modal dialog (`HabboHelp.getModalXmlWindow("topics_flow_help")`, centred over the darkened client).
 *
 * `toggleWindow` opens it on `start_container`: `showContainer` hides every other container of the
 * flow (`help_container`, `users_container`, `user`, `reason_container`, `message_container`,
 * `chat_container`, `summary_container`) and the back and continue buttons, and `openWindow` hides the
 * reports status link and its icon unless `my.reports.status.enabled`. The layout itself hides
 * `button_habbo_help`, so the start page offers "Someone is misbehaving" and the support centre.
 *
 * `windowEventProcedure` on the start page:
 * - `button_account` opens `zendesk.url` in the hotel's main browser window and closes the window.
 * - `faq_link` opens `cfh.faq.url` (`openCfhFaq`, nothing when it is empty); the window stays.
 * - `sanction_info_link` asks for the sanction status (`requestSanctionInfo`) and closes the window.
 * - `reports_status` asks for the reports status (`requestReportsStatus`) and closes the window.
 * - `button_user_report` starts the report flow (the users seen chatting, then their chat lines,
 *   a topic and a summary), which needs the client's chat and user registries; the port has not got
 *   them yet, so the button does nothing.
 */
import { requestCfhReportsStatus, requestSanctionStatus } from '#base/commands/helpCommands';
import { useWebSocketContext } from '#base/context/communication';
import { useConfigValue } from '#base/context/system';
import { ModalDialog, TemplateBindings, TemplateWindow, useTemplateFrame } from '#base/theme';

const TEMPLATE = 'habbo-help-com/topics_flow_help_xml';

/** `_containers` and the continue button: everything `showContainer("start_container")` leaves hidden. */
const HIDDEN_ON_START = [ 'help_container', 'users_container', 'user', 'reason_container', 'message_container', 'chat_container', 'back_button', 'summary_container', 'continue_button' ];

/** `HabboWebTools.openWebPage(url, "habboMain")`. */
const openWebPage = (url: string | undefined) => {
    if (url?.length) window.open(url, 'habboMain');
};

export interface HelpViewProps {
    onClose: () => void;
}

export const HelpView = ({ onClose }: HelpViewProps) => {
    const { send } = useWebSocketContext();
    const zendeskUrl = useConfigValue<string>('zendesk.url');
    const faqUrl = useConfigValue<string>('cfh.faq.url');
    const reportsStatusEnabled = useConfigValue<boolean>('my.reports.status.enabled') === true;
    const frame = useTemplateFrame({ id: 'help_topics_flow', modal: true, rememberPosition: false, resizeDirection: 'none', onClose });

    const bindings: TemplateBindings = {
        // The layout builds `start_container` hidden too; `showContainer` shows it.
        start_container: { visible: true },
        ...Object.fromEntries(HIDDEN_ON_START.map(name => [ name, { visible: false } ])),
        reports_status_bitmap: { visible: reportsStatusEnabled },
        reports_status: {
            visible: reportsStatusEnabled,
            onPointerTap: () => {
                requestCfhReportsStatus(send);
                onClose();
            },
        },
        button_account: {
            onPointerTap: () => {
                openWebPage(zendeskUrl);
                onClose();
            },
        },
        faq_link: { onPointerTap: () => openWebPage(faqUrl) },
        sanction_info_link: {
            onPointerTap: () => {
                requestSanctionStatus(send);
                onClose();
            },
        },
    };

    return (
        <ModalDialog>
            <TemplateWindow
                id={TEMPLATE}
                frame={frame}
                bindings={bindings}
            />
        </ModalDialog>
    );
};
