import { Modal } from "../../../components/Modal";
import populationCitation from "../data/population_by_country.json.md?raw";
import gdpCitation from "../data/gdp_by_country.json.md?raw";
import disasterAffectedMergedCitation from "../data/disaster_affected_merged.json.md?raw";
import disasterLossMergedCitation from "../data/disaster_loss_pct_gdp_merged.json.md?raw";

import { parse } from "../../../utils/string";

const contentMarkdown = `
Disaster impact combines affected-population and economic-loss data (UNDRR Sendai reporting via SPC, gap-filled with EM-DAT) with population and GDP denominators (SPC).

Data for 2026 has been dropped.

---

${disasterAffectedMergedCitation}

---

${gdpCitation}

---

${populationCitation}

---

${disasterLossMergedCitation}`;

const markdownHTML = parse(contentMarkdown);

export function DisasterImpactSourcesModal() {
  return <Modal labelClass="text-[12px] text-accent hover:opacity-75 cursor-pointer" label="Notes & citations" title="Disaster impact — notes and citations" html={markdownHTML} />
}
