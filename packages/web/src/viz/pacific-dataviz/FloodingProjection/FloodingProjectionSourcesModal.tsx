import { Modal } from "../../../components/Modal";
import riskTrajectoryCitation from "../data/risk_trajectory_2050.json.md?raw";
import affectedProjectionCitation from "../data/affected_projection_2050.json.md?raw";
import popLeczCitation from "../data/pop_lecz_by_country.json.md?raw";

import { parse } from "../../../utils/string";

const contentMarkdown = `
The projections apply the flood amplification factor method (Vitousek et al. 2017; Taherkhani et al. 2020) to IPCC AR6 sea-level projections and SPC population projections. They are illustrative, not site-calibrated.

---

${riskTrajectoryCitation}

---

${affectedProjectionCitation}

---

${popLeczCitation}`;

const markdownHTML = parse(contentMarkdown);

export function FloodingProjectionSourcesModal() {
  return <Modal labelClass="text-[12px] text-accent hover:opacity-75 cursor-pointer" label="Notes & citations" title="Flooding projection — notes, data sources & method" html={markdownHTML} />
}
