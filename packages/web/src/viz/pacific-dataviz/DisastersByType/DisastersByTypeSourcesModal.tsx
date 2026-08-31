import { Modal } from "../../../components/Modal";
import emdatByTypeCitation from "../data/disaster_emdat_by_type.json.md?raw";
import emdatRegionalEventsCitation from "../data/disaster_emdat_regional_events.json.md?raw";

import { parse } from "../../../utils/string";

const contentMarkdown = `
Disaster types and the regional event annotations come from EM-DAT, which has a higher inclusion threshold than the UNDRR reporting used above — very small events may be missing.

All events were included in the totals, but only events with deaths are rendered events circle packed layout.

---

${emdatByTypeCitation}

---

${emdatRegionalEventsCitation}`;

const markdownHTML = parse(contentMarkdown);

export function DisastersByTypeSourcesModal() {
  return <Modal labelClass="text-[12px] text-accent hover:opacity-75 cursor-pointer" label="Notes & citations" title="Disasters by type — notes and citations" html={markdownHTML} />
}
