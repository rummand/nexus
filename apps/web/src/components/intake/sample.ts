/**
 * A sample meeting, so the pipeline can be seen working before anyone has a transcript to hand.
 * Written to contain what a real architecture meeting contains: systems the graph already knows,
 * systems it does not, a decision, a risk, an owner and an open question.
 */
export const SAMPLE_TRANSCRIPT = `Jesper Solberg   0:04
Right, target architecture for metering. Today Maximo depends on SCADA for the outage data, and the billing capability sits on top of both.

Mette Lund   0:41
My concern is that Maximo is out of support from next year. That is a real risk if we are still running the meter data flow through it.

Anders Vig   1:12
The Kamstrup platform could take over the meter data. It already integrates with SCADA, and it sends data to the settlement system every hour.

Jesper Solberg   1:58
Agreed. We decided to replace Maximo with the Kamstrup platform for meter data, and keep Maximo for work orders until 2027.

Mette Lund   2:30
Who owns the billing capability today? I don't think we have an owner written down anywhere.

Anders Vig   2:44
I will prepare a migration plan for the meter data flow before the next architecture board.

Jesper Solberg   3:05
We need to map every integration that touches Maximo. There is an open question about whether the GIS system reads from it directly.
`;
